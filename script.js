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

    // Preload all tab background images so they're cached before user clicks
    tabs.forEach(tab => {
        const bgImage = tab.getAttribute('data-bg');
        if (bgImage) {
            const img = new Image();
            img.src = bgImage;
        }
    });

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

/*
 * Supabase client is provided by js/supabaseClient.js (loaded before this file).
 * That file defines the global `supabaseClient`. We reference it here so we
 * don't duplicate the config in two places.
 */
if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.error('supabaseClient not found. Ensure js/supabaseClient.js is loaded before script.js');
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

// FAQ Accordion Logic
document.addEventListener('DOMContentLoaded', () => {
    const faqQuestions = document.querySelectorAll('.faq-question');

    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.closest('.faq-item');
            const isOpen = item.classList.contains('active');
            const answer = question.nextElementSibling;

            // Close all other open items
            document.querySelectorAll('.faq-item').forEach(i => {
                i.classList.remove('active');
                i.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
                i.querySelector('.faq-answer').classList.remove('open');
            });

            // Toggle current item
            if (!isOpen) {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
                answer.classList.add('open');
            }
        });
    });
});

// Offering Card Modal Logic
document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    const closeBtn = overlay ? overlay.querySelector('.modal-close') : null;

    if (!overlay || !modalContent) return;

    const openModal = (modalId) => {
        const template = document.getElementById('modal-' + modalId);
        if (!template) return;
        modalContent.innerHTML = '';
        modalContent.appendChild(template.content.cloneNode(true));
        overlay.classList.add('active');
        document.body.classList.add('modal-open');
    };

    const closeModal = () => {
        overlay.classList.remove('active');
        document.body.classList.remove('modal-open');
        // Clear content after animation
        setTimeout(() => { modalContent.innerHTML = ''; }, 350);
    };

    // Open modal when clicking Read More button or anywhere on the card
    document.querySelectorAll('.card[data-modal]').forEach(card => {
        const modalId = card.getAttribute('data-modal');

        // Click on Read More button
        const readMoreBtn = card.querySelector('.card-read-more');
        if (readMoreBtn) {
            readMoreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(modalId);
            });
        }

        // Also allow clicking the whole card (since it has cursor:pointer)
        card.addEventListener('click', () => {
            openModal(modalId);
        });
    });

    // Close on close button
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    // Close when clicking overlay backdrop (not the box itself)
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            closeModal();
        }
    });

    // Smooth scroll & close when clicking modal CTAs that link to anchors
    modalContent.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (link) closeModal();
    });
});

// Mobile Navigation Drawer
document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    if (!toggle || !navLinks) return;

    // Insert backdrop element
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    const openMenu = () => {
        toggle.classList.add('active');
        navLinks.classList.add('open');
        backdrop.classList.add('active');
        toggle.setAttribute('aria-expanded', 'true');
        document.body.style.overflow = 'hidden';
    };

    const closeMenu = () => {
        toggle.classList.remove('active');
        navLinks.classList.remove('open');
        backdrop.classList.remove('active');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    };

    toggle.addEventListener('click', () => {
        if (navLinks.classList.contains('open')) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    backdrop.addEventListener('click', closeMenu);

    // Close when any nav link is tapped
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navLinks.classList.contains('open')) {
            closeMenu();
        }
    });
});
