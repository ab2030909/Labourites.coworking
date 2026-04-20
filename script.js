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

// Supabase Configuration
const SUPABASE_URL = 'https://jaldxqqplawmexwbpark.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphbGR4cXFwbGF3bWV4d2JwYXJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2Nzg1NTIsImV4cCI6MjA5MjI1NDU1Mn0.d2H-P4i3xtsm2X0N9spJzyk3S652HAbZG0Us6GcHr9o';

// Initialize Supabase Client
let supabaseClient;
if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    console.error('Supabase library not loaded! Make sure the CDN script in index.html is working.');
}

// Form Submission Logic
document.addEventListener('DOMContentLoaded', () => {
    const leadForm = document.getElementById('lead-form');
    const formMessage = document.getElementById('form-message');
    
    if (leadForm) {
        const submitBtn = leadForm.querySelector('button[type="submit"]');

        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!supabaseClient) {
                formMessage.innerText = 'System error: Database client not initialized.';
                formMessage.className = 'form-message error';
                return;
            }

            // Set loading state
            submitBtn.disabled = true;
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'Sending...';
            formMessage.innerText = '';
            formMessage.className = 'form-message';

            // Get form data
            const formData = new FormData(leadForm);
            const data = {};
            formData.forEach((value, key) => {
                if (value) data[key] = value;
            });

            console.log('Attempting to submit to Supabase:', data);

            try {
                const { data: responseData, error } = await supabaseClient
                    .from('leads')
                    .insert([data]);

                if (error) {
                    console.error('Supabase Insert Error:', error);
                    throw error;
                }

                console.log('Submission successful:', responseData);

                // Success
                formMessage.innerText = "Thank you for choosing Labourites. We'll get back to you shortly!";
                formMessage.className = 'form-message success';
                leadForm.reset();
            } catch (error) {
                // Detailed Error
                console.error('Full Error Object:', error);
                
                let errorMsg = 'Oops! Something went wrong.';
                if (error.code === '42501') {
                    errorMsg = 'Permission denied (RLS). Please enable INSERT policies for the anon role in Supabase.';
                } else if (error.message) {
                    errorMsg = `Error: ${error.message}`;
                }
                
                formMessage.innerText = errorMsg;
                formMessage.className = 'form-message error';
            } finally {
                // Reset button
                submitBtn.disabled = false;
                submitBtn.innerText = originalBtnText;
            }
        });
    }
});
