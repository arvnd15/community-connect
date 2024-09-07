const express = require("express");
const path = require("path");
const session = require("express-session");
const { collection, Profile, EventRegistration, Event } = require("./config");  // Ensure consistent naming
const bcrypt = require('bcrypt');
const { error } = require("console");

const crypto = require('crypto');
const { register } = require("module");
const secret = crypto.randomBytes(32).toString('hex');

const ExcelJS = require('exceljs'); // Import the exceljs module
const app = express();

// convert data into json format
app.use(express.json());

// Static file
app.use(express.static("public"));

app.use(express.urlencoded({ extended: false }));

// use EJS as the view engine
app.set("view engine", "ejs");

// Session middleware setup
app.use(session({
    secret: secret, // Use the generated secret
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: null // Session cookie will expire when the browser closes
    }
}));

// Authentication middleware
async function checkAuth(req, res, next) {
    if (req.session.user) {
        try {
            // Fetch the user from the database
            const user = await collection.findOne({ email: req.session.user.email });

            if (user) {
                // Store the role in the request object
                req.userRole = user.role;

                // Proceed to the next middleware or route handler
                next();
            } else {
                // If user not found in the database, redirect to login
                res.redirect('/login');
            }
        } catch (error) {
            console.error('Error fetching user:', error);
            res.redirect('/login');
        }
    } else {
        res.redirect('/login'); // If user is not authenticated, redirect to login
    }
}

app.get("/login", (req, res) => {
    res.render("login", { error: null });
});

app.get("/signup", (req, res) => {
    res.render("signup", { error: null });
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.render("login", { error: null });
});

// Apply checkAuth middleware to protected route
app.get("/", checkAuth, (req, res) => {
    // Check the user's role stored in req.userRole
    if (req.userRole === 'admin') {
        res.render("admin");
    } else {
        res.render("home");
    }
});

app.get("/admin", (req, res) => {
    res.render("admin");
});


app.get("/events", checkAuth, async (req, res) => {
    const searchQuery = req.query.search || '';

    try {
        // Get today's date in 'yyyy-mm-dd' format
        const today = new Date().toISOString().split('T')[0];

        // Construct a regex pattern for case-insensitive search
        const searchPattern = new RegExp(searchQuery, 'i');

        // Fetch events with eventDate >= today and matching the search query
        const events = await Event.find({
            eventDate: { $gte: today },
            $or: [
                { eventName: searchPattern },
                { location: searchPattern }
            ]
        }).sort({ eventDate: 1 }); // Sort by eventDate in ascending order

        // Check the user's role stored in req.userRole
        if (req.userRole === 'admin') {
            res.render("adminevents", { events: events, searchQuery: searchQuery });
        } else {
            res.render("events", { events: events, searchQuery: searchQuery });
        }
    } catch (error) {
        console.error("Error fetching events:", error);
        res.render("events", { events: [], error: "An error occurred while fetching events.", searchQuery: searchQuery });
    }
});




app.get("/profile", checkAuth, async (req, res) => {
    try {
        const userProfile = await Profile.findOne({ email: req.session.user.email });
        if (!userProfile) {
            return res.render("profile", {
                error: "Profile not found.",
            });
        }
        res.render("profile", { profile: userProfile });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.redirect('/');
    }
});

app.get("/about", checkAuth, (req, res) => {
    res.render("about");
});

app.get("/contact", checkAuth, (req, res) => {
    res.render("contact");
});

// Register User
app.post("/signup", async (req, res) => {
    const data = new collection({
        email: req.body.email,
        password: req.body.password,
        confirmpassword: req.body.confirmpassword,
        role: 'user' // By default, we assign the user role, and admin can change it to admin in the db
    });

    // Check if the username already exists in the database
    const existingUser = await collection.findOne({ email: data.email });

    if (existingUser) {
        return res.render("signup", {
            error: "User already exists. Please choose a different email.",
        });
    } else {
        // Hash the password using bcrypt
        const saltRounds = 10; // Number of salt rounds for bcrypt
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);
        const hashedConfirmPassword = await bcrypt.hash(data.confirmpassword, saltRounds);

        data.password = hashedPassword; // Replace the original password with the hashed one
        data.confirmpassword = hashedConfirmPassword; // Replace the original password with the hashed one

        const userdata = await data.save(data);

        // Create an empty profile for the new user
        const profileData = new Profile({
            email: userdata.email,  // Use Profile model
            name: null,
            age: null,
            mobile: null,
            address: null
        });
        await profileData.save();

        console.log(userdata);
        res.render("login", { error: null, message: "Signup successful! Please log in." });
    }
});

// Login user
app.post("/login", async (req, res) => {
    try {
        const check = await collection.findOne({ email: req.body.email });
        if (!check) {
            return res.render("login", {
                error: "Email does not exist",
            });
        }
        // Compare the hashed password from the database with the plaintext password
        const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);
        if (!isPasswordMatch) {
            return res.render("login", {
                error: "Wrong Password",
            });
        }

        const profileData = await Profile.findOne({ email: check.email });  // Use Profile model

        // If the profile is incomplete, redirect to updateProfile page
        if (!profileData.name || !profileData.age || !profileData.mobile || !profileData.address) {
            req.session.user = check;
            return res.redirect("/profile");
        }

        const role = check.role;

        if (role === "admin") {
            req.session.user = check;
            res.redirect("admin");
        } else {
            req.session.user = check;
            res.redirect("/");
        }
    } catch (error) {
        console.error("Login error:", error);
        res.render("login", { error: "An error occurred. Please try again." });
    }
});

// Update Profile Details
app.post("/updateProfile", checkAuth, async (req, res) => {
    try {
        const { name, age, mobile, address } = req.body;

        await Profile.updateOne(  // Use Profile model
            { email: req.session.user.email },
            {
                $set: {
                    name: name,
                    age: age,
                    mobile: mobile,
                    address: address
                }
            }
        );

        res.render("profile", {
            profile: { name, age, mobile, address },
            message: "Profile updated successfully."
        });
    } catch (error) {
        console.error("Error updating profile:", error);
        res.render("profile", {
            profile: req.body,
            error: "An error occurred while updating your profile. Please try again."
        });
    }
});

// Add New Event
app.post("/add-event", checkAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied.');
    }

    try {
        const { eventName, eventDate, description, location, time, volunteers } = req.body;

        // Create a new event
        const newEvent = new Event({
            eventName: eventName,
            eventDate: eventDate,
            description: description,
            location: location,
            time: time,
            volunteers: volunteers
        });

        // Save the event to the database
        await newEvent.save();

        // Redirect to the admin events page
        res.redirect("/events");
    } catch (error) {
        console.error("Error adding event:", error);
        res.render("adminevents", { events: [], error: "An error occurred while adding the event. Please try again." });
    }
});

// Register for Event
app.post("/register-event", checkAuth, async (req, res) => {

    const today = new Date().toISOString().split('T')[0];
    const searchQuery = req.query.search || ''; // Capture the search query

    try {
        const eventId = req.body.event_id;
        const userEmail = req.session.user.email;
        const profileData = await Profile.findOne({ email: userEmail });  // Use Profile model

        // Check if the event exists
        const event = await Event.findById(eventId);

        if (!event) {
            return res.render("events", {                
                events: await Event.find({
                    eventDate: { $gte: today }
                }).sort({ eventDate: 1 }), // Sort by eventDate in ascending order 
                error: "Event not found.",
                searchQuery // Pass the search query to the template
            });
        }

        // If the profile is incomplete, throw error
        if (!profileData.name || !profileData.age || !profileData.mobile || !profileData.address) {
            return res.render("events", {                
                events: await Event.find({
                    eventDate: { $gte: today }
                }).sort({ eventDate: 1 }), // Sort by eventDate in ascending order 
                error: "Please update your profile before Registration.",
                searchQuery // Pass the search query to the template
                });
        }

        // Check if the user has already registered for this event
        const existingRegistration = await EventRegistration.findOne({
            userEmail: userEmail,
            eventName: event.eventName,
            eventDate: event.eventDate
        });

        if (existingRegistration) {
            return res.render("events", {
                events: await Event.find({
                    eventDate: { $gte: today }
                }).sort({ eventDate: 1 }), // Sort by eventDate in ascending order 
                error: "You have already registered for this event.",
                searchQuery // Pass the search query to the template
            });
        }

        // Create a new event registration
        const eventRegistration = new EventRegistration({
            userEmail: userEmail,
            eventName: event.eventName,
            eventDate: event.eventDate,
            confirmationstatus: 'Pending'
        });

        await eventRegistration.save();

        // Pass a success message to the events page
        res.render("events", {
            events: await Event.find({
                eventDate: { $gte: today }
            }).sort({ eventDate: 1 }), // Sort by eventDate in ascending order , 
            success: "You have successfully registered for the event.",
            searchQuery // Pass the search query to the template
        });
    } catch (error) {
        console.error("Error registering for event:", error);
        res.render("events", {
            events: await Event.find({
                eventDate: { $gte: today }
            }).sort({ eventDate: 1 }), // Sort by eventDate in ascending order , 
            error: "An error occurred while registering for the event. Please try again.",
            searchQuery // Pass the search query to the template
        });
    }
});


// Requests page for admin to approve user's event registration
app.get("/requests", checkAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied.');
    }

    try {
        // Fetch pending event registrations
        const pendingRequests = await EventRegistration.find({ 
            confirmationstatus: 'Pending' 
        }).sort({ eventDate: 1, registrationDate: 1 }); // Sort by eventDate & registrationDate in ascending order

        // Format the registrationDate to yyyy-mm-dd
        const formattedRequests = pendingRequests.map(request => {
            return {
                ...request._doc,
                registrationDate: new Date(request.registrationDate).toISOString().split('T')[0]
            };
        });

        // Pass the formatted requests variable to the EJS template
        res.render("requests", { requests: formattedRequests });
    } catch (error) {
        console.error("Error fetching requests:", error);
        res.render("requests", { requests: [], error: "An error occurred while fetching requests." });
    }
});


app.post("/approve-request", checkAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied.');
    }

    try {
        const { requestId } = req.body;

        // Update the request status to 'Approved'
        await EventRegistration.updateOne(
            { _id: requestId },
            { $set: { confirmationstatus: 'Approved' } }
        );

        res.redirect("/requests");
    } catch (error) {
        console.error("Error approving request:", error);
        res.redirect("/requests");
    }
});

app.post("/reject-request", checkAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied.');
    }

    try {
        const { requestId } = req.body;

        // Update the request status to 'Rejected'
        await EventRegistration.updateOne(
            { _id: requestId },
            { $set: { confirmationstatus: 'Rejected' } }
        );

        res.redirect("/requests");
    } catch (error) {
        console.error("Error rejecting request:", error);
        res.redirect("/requests");
    }
});

// Users Registered Events Page
app.get("/registered-events", checkAuth, async (req, res) => {
    try {
        // Find all event registrations for the logged-in user
        const registrations = await EventRegistration.find({ 
            userEmail: req.session.user.email 
        }).sort({ eventDate: 1 }); // Sort by eventDate in ascending order

        // If event details are directly stored in EventRegistration, use them directly
        const regevents = registrations.map(registration => ({
            ...registration.toObject(),
            eventDate: new Date(registration.eventDate).toDateString() // Convert date to a readable format
        }));

        res.render("registered-events", { regevents: regevents });
    } catch (error) {
        console.error("Error fetching registered events:", error);
        res.render("registered-events", { regevents: [], error: "An error occurred while fetching registered events." });
    }
});

// Delete Event
app.post('/delete-event', checkAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied.');
    }

    try {
        const { event_id } = req.body;

        // Delete the event from the database
        const result = await Event.deleteOne({ _id: event_id });

        if (result.deletedCount === 0) {
            console.error("No event was deleted, possibly an invalid event ID.");
        }

        // Redirect to the admin events page
        res.redirect("/events");
    } catch (error) {
        console.error("Error deleting event:", error);
        res.render("events", { events: [], error: "An error occurred while deleting the event. Please try again." });
    }
});


// Edit Event
app.post("/edit-event", checkAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied.');
    }

    try {
        const { event_id, eventName, eventDate, description, location, time, volunteers } = req.body;

        // Update the event in the database
        await Event.updateOne(
            { _id: event_id },
            {
                $set: {
                    eventName: eventName,
                    eventDate: eventDate,
                    description: description,
                    location: location,
                    time: time,
                    volunteers: volunteers
                }
            }
        );

        // Redirect to the admin events page
        res.redirect("/events");
    } catch (error) {
        console.error("Error updating event:", error);
        res.render("adminevents", { events: [], error: "An error occurred while updating the event. Please try again." });
    }
});

app.get("/reports", checkAuth, async (req, res) => {
    if (req.userRole !== 'admin') {
        return res.status(403).send('Access denied.');
    }

    try {
        // Fetch all events and their registrations
        const events = await Event.find().sort({ eventDate: 1 });
        const registrations = await EventRegistration.find({ confirmationstatus: 'Approved' });

        // Create a mapping of event names and dates to the number of volunteers registered
        const volunteerCount = {};
        registrations.forEach(registration => {
            // Use a composite key of eventName and eventDate
            const key = `${registration.eventName}|${registration.eventDate}`;
            if (!volunteerCount[key]) {
                volunteerCount[key] = 0;
            }
            volunteerCount[key]++;
        });

        // Get today's date and format it to match the eventDate format
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset the time part to ensure accurate comparison

        // Process event data to include volunteer count, remaining seats, and status
        const reportData = events.map(event => {
            // Use a composite key of eventName and eventDate to match with registrations
            const key = `${event.eventName}|${event.eventDate}`;
            
            // Determine the status of the event based on the eventDate
            let status;
            const eventDate = new Date(event.eventDate);
            eventDate.setHours(0, 0, 0, 0); // Reset the time part to ensure accurate comparison

            if (eventDate < today) {
                status = 'Completed';
            } else if (eventDate.getTime() === today.getTime()) {
                status = 'Ongoing';
            } else {
                status = 'Upcoming';
            }

            return {
                eventName: event.eventName,
                eventDate: event.eventDate,
                location: event.location,
                time: event.time,
                volunteers: volunteerCount[key] || 0,
                seatsLeft: event.volunteers - (volunteerCount[key] || 0),
                status: status
            };
        });
         
        // Store report data in the session
         req.session.reportData = reportData;

        res.render("reports", { reports: reportData });
    } catch (error) {
        console.error("Error fetching reports:", error);
        res.render("reports", { reports: [], error: "An error occurred while fetching reports." });
    }
});

app.get("/download-report", checkAuth, async (req, res) => {
    try {
        // Retrieve report data from the session
        const reportData = req.session.reportData;

        if (!reportData) {
            return res.status(400).send("No report data available.");
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Event Reports');

        worksheet.columns = [
            { header: 'Event Name', key: 'eventName', width: 30 },
            { header: 'Event Date', key: 'eventDate', width: 15 },
            { header: 'Location', key: 'location', width: 20 },
            { header: 'Time', key: 'time', width: 10 },
            { header: 'Volunteers Registered', key: 'volunteers', width: 25 },
            { header: 'Seats Left', key: 'seatsLeft', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
        ];

        reportData.forEach(report => {
            worksheet.addRow({
                eventName: report.eventName,
                eventDate: report.eventDate,
                location: report.location,
                time: report.time,
                volunteers: report.volunteers,
                seatsLeft: report.seatsLeft,
                status: report.status,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=event_reports.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Error generating Excel report:', error);
        res.status(500).send('An error occurred while generating the report.');
    }
});


// Define Port for Application
const port = 5000;
app.listen(port,  () => {
    console.log(`Server listening on port ${port}`)
});
