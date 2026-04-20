// Add background to navbar on scroll
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Simple Tabs functionality
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const offeringsSection = document.getElementById('offerings');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            // Add to clicked tab
            tab.classList.add('active');

            // Hide all contents
            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // Show the target content
            const targetId = tab.getAttribute('data-target');
            if (targetId) {
                const targetContent = document.getElementById(targetId);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            }

            // Update background image
            const bgImage = tab.getAttribute('data-bg');
            if (bgImage && offeringsSection) {
                offeringsSection.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url('${bgImage}')`;
            }
        });
    });
});


// Pricing Toggle Logic
const pricingSwitch = document.getElementById('pricing-switch');
const individualLabel = document.getElementById('monthly-label');
const officeLabel = document.getElementById('annually-label');
const individualView = document.getElementById('individual-view');
const officeView = document.getElementById('office-view');

if (pricingSwitch) {
    pricingSwitch.addEventListener('change', () => {
        if (pricingSwitch.checked) {
            officeLabel.classList.add('active');
            individualLabel.classList.remove('active');
            officeView.classList.add('active');
            individualView.classList.remove('active');
        } else {
            individualLabel.classList.add('active');
            officeLabel.classList.remove('active');
            individualView.classList.add('active');
            officeView.classList.remove('active');
        }
    });
}
