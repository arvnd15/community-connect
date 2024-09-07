/********* WELCOME MESSAGE ************/
window.addEventListener("load", function() {
    // Check if the popup has been shown before in the current session
    if (!sessionStorage.getItem("popupShown")) {
        // Display the popup after 1 second
        setTimeout(function open(event) {
            document.querySelector(".popup").style.display = "block";
        }, 1000);

        // Set a flag in sessionStorage to indicate the popup has been shown
        sessionStorage.setItem("popupShown", "true");
    }

    // Add event listeners for closing the popup
    document.querySelector("#close").addEventListener("click", function() {
        document.querySelector(".popup").style.display = "none";
    });

    document.querySelector(".popupbtn button").addEventListener("click", function() {
        document.querySelector(".popup").style.display = "none";
    });
});


/************** NAV BAR **************/
const navbarMenu = document.querySelector(".navbar .links");
const hamburgerBtn = document.querySelector(".hamburger-btn");
const hideMenuBtn = navbarMenu.querySelector(".close-btn");

// Show mobile menu
hamburgerBtn.addEventListener("click", () => {
    navbarMenu.classList.toggle("show-menu");
});

// Hide mobile menu
hideMenuBtn.addEventListener("click", () =>  hamburgerBtn.click());

// Gallery Scroll
const slider = document.querySelector('.slider');
const slides = document.querySelectorAll('.slide');
const prevBtn = document.querySelector('.left-arrow');
const nextBtn = document.querySelector('.right-arrow');

let currentIndex = 0;

function updateSlider() {
    const slideWidth = slides[0].clientWidth;
    slider.scrollTo({
        left: slideWidth * currentIndex,
        behavior: 'smooth'
    });
}

prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        updateSlider();
    }
});

nextBtn.addEventListener('click', () => {
    if (currentIndex < slides.length - 1) {
        currentIndex++;
        updateSlider();
    }
});