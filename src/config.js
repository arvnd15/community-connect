const mongoose = require('mongoose');
const connect = mongoose.connect("mongodb+srv://guruaravind15:rQi3K3AjBbh0mXFt@community-connect.5ld7t.mongodb.net/community-connect?retryWrites=true&w=majority&appName=community-connect");

// Check database connected or not
connect.then(() => {
    console.log("Database Connected Successfully");
})
.catch(() => {
    console.log("Database cannot be Connected");
})

// Create Schema
// Login 
const Loginschema = new mongoose.Schema({
    email: {
        type:String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    confirmpassword: {
        type: String,
        required: true
    },
    role: {
        type: String,
    },
}, { versionKey: false }); // Set versionKey to false to remove __v'

// Profile
const profileSchema = new mongoose.Schema({
    email: {
        type:String,
        required: true,
        unique: true
    },
    name: {
        type: String,
    },
    age: {
        type: Number,
    },
    mobile: {
        type: String,
    },
    address: {
        type: String,
    }
});

// Event Register
const eventRegistrationSchema = new mongoose.Schema({
    userEmail: { type: String, required: true },
    eventName: { type: String, required: true },
    eventDate: { type: String, required: true },
    registrationDate: { type: Date, default: Date.now },
    confirmationstatus: { type: String } 
});

// Events
const eventSchema = new mongoose.Schema({
    eventName: { type: String, required: true },
    eventDate: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    time: { type: String, required: true },
    volunteers: { type: String, required: true }

});

// collection part
const collection = new mongoose.model("login", Loginschema);
const Profile = mongoose.model('profile', profileSchema);
const EventRegistration = mongoose.model('EventRegistration', eventRegistrationSchema);
const Event = mongoose.model('Event', eventSchema);

module.exports = {
    collection,
    Profile,
    EventRegistration,
    Event,
};