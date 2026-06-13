/*
 * Public "Events & Updates" logic.
 * - events-updates.html : lists all PUBLISHED updates as cards
 * - update-details.html : shows a single update by ?slug=...
 *
 * Requires: supabaseClient.js loaded first.
 */

/* ---------- small helpers ---------- */

function fmtDate(value) {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    } catch (e) {
        return value;
    }
}

// Escape user text before injecting into HTML (prevents broken markup / XSS).
function esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function categoryClass(cat) {
    return 'cat-' + String(cat || 'general').toLowerCase().replace(/[^a-z]+/g, '-');
}


/* =====================================================================
   LISTING PAGE  (events-updates.html)
===================================================================== */
async function initUpdatesList() {
    const grid = document.getElementById('updates-grid');
    const stateBox = document.getElementById('updates-state');
    if (!grid) return; // not on this page

    if (!supabaseClient) {
        stateBox.innerHTML = errorState('Could not connect to the server. Please try again later.');
        return;
    }

    // Loading state
    stateBox.innerHTML = loadingState('Loading updates…');
    stateBox.style.display = '';
    grid.innerHTML = '';

    try {
        const { data, error } = await supabaseClient
            .from('updates')
            .select('*')
            .eq('is_published', true)
            .order('update_date', { ascending: false, nullsFirst: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            stateBox.innerHTML = emptyState();
            return;
        }

        stateBox.style.display = 'none';
        grid.innerHTML = data.map(renderCard).join('');
    } catch (err) {
        console.error('Failed to load updates:', err);
        stateBox.innerHTML = errorState('Something went wrong while loading updates.');
    }
}

function renderCard(u) {
    const cover = u.cover_image_url
        ? `<img src="${esc(u.cover_image_url)}" alt="${esc(u.title)}" loading="lazy">`
        : `<div class="upd-card-noimg"><i class="fas fa-newspaper"></i></div>`;

    const dateStr = fmtDate(u.update_date) || fmtDate(u.created_at);

    return `
    <article class="upd-card">
        <a class="upd-card-media" href="/update-details?slug=${encodeURIComponent(u.slug)}">
            ${cover}
        </a>
        <div class="upd-card-body">
            ${u.category ? `<span class="upd-badge ${categoryClass(u.category)}">${esc(u.category)}</span>` : ''}
            ${dateStr ? `<span class="upd-card-date"><i class="far fa-calendar"></i> ${esc(dateStr)}</span>` : ''}
            <h3 class="upd-card-title">${esc(u.title)}</h3>
            ${u.short_description ? `<p class="upd-card-desc">${esc(u.short_description)}</p>` : ''}
            <a class="upd-readmore" href="/update-details?slug=${encodeURIComponent(u.slug)}">
                Read More <i class="fas fa-arrow-right"></i>
            </a>
        </div>
    </article>`;
}


/* =====================================================================
   DETAILS PAGE  (update-details.html?slug=...)
===================================================================== */
async function initUpdateDetails() {
    const root = document.getElementById('update-detail');
    if (!root) return; // not on this page

    const params = new URLSearchParams(window.location.search);
    const slug = params.get('slug');

    if (!slug) {
        root.innerHTML = notFoundState();
        return;
    }

    if (!supabaseClient) {
        root.innerHTML = errorState('Could not connect to the server. Please try again later.');
        return;
    }

    root.innerHTML = loadingState('Loading…');

    try {
        const { data, error } = await supabaseClient
            .from('updates')
            .select('*')
            .eq('slug', slug)
            .eq('is_published', true)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            root.innerHTML = notFoundState();
            return;
        }

        renderDetail(root, data);
    } catch (err) {
        console.error('Failed to load update:', err);
        root.innerHTML = errorState('Something went wrong while loading this update.');
    }
}

function renderDetail(root, u) {
    // SEO: update document title + meta description dynamically
    document.title = `${u.title} — LABOURITES`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && u.short_description) metaDesc.setAttribute('content', u.short_description);

    const dateStr = fmtDate(u.update_date) || fmtDate(u.created_at);

    let gallery = [];
    try {
        gallery = Array.isArray(u.gallery_images)
            ? u.gallery_images
            : JSON.parse(u.gallery_images || '[]');
    } catch (e) { gallery = []; }

    // Build sidebar detail rows
    const sidebarRows = [];
    if (dateStr) sidebarRows.push(`
        <div class="upd-sidebar-detail-row">
            <i class="far fa-calendar"></i>
            <div><strong>Date</strong><span>${esc(dateStr)}</span></div>
        </div>`);
    if (u.venue) sidebarRows.push(`
        <div class="upd-sidebar-detail-row">
            <i class="fas fa-location-dot"></i>
            <div><strong>Venue</strong><span>${esc(u.venue)}</span></div>
        </div>`);
    if (u.category) sidebarRows.push(`
        <div class="upd-sidebar-detail-row">
            <i class="fas fa-tag"></i>
            <div><strong>Category</strong><span>${esc(u.category)}</span></div>
        </div>`);

    root.innerHTML = `
        <div class="upd-detail-inner">

            <!-- LEFT: main content -->
            <div class="upd-detail-main">
                <a class="upd-back" href="/events-updates">
                    <i class="fas fa-arrow-left"></i> Back to Events &amp; Updates
                </a>

                ${u.category ? `<span class="upd-detail-category">
                    <i class="fas fa-tag"></i> ${esc(u.category)}
                </span>` : ''}

                <h1 class="upd-detail-title">${esc(u.title)}</h1>

                <div class="upd-detail-meta">
                    ${dateStr ? `<div class="upd-detail-meta-item">
                        <i class="far fa-calendar"></i> ${esc(dateStr)}
                    </div>` : ''}
                    ${u.venue ? `<div class="upd-detail-meta-item">
                        <i class="fas fa-location-dot"></i> ${esc(u.venue)}
                    </div>` : ''}
                </div>

                ${u.cover_image_url ? `
                <div class="upd-detail-cover">
                    <img src="${esc(u.cover_image_url)}" alt="${esc(u.title)}">
                </div>` : ''}

                ${u.short_description ? `
                <p class="upd-detail-lead">${esc(u.short_description)}</p>` : ''}

                <div class="upd-detail-content">${formatContent(u.full_description)}</div>

                ${gallery.length ? `
                <h2 class="upd-gallery-title">Gallery</h2>
                <div class="upd-gallery">
                    ${gallery.map(src => `
                    <a href="${esc(src)}" target="_blank" rel="noopener">
                        <img src="${esc(src)}" alt="${esc(u.title)} image" loading="lazy">
                    </a>`).join('')}
                </div>` : ''}
            </div>

            <!-- RIGHT: sticky sidebar -->
            <aside class="upd-detail-sidebar">
                ${sidebarRows.length ? `
                <div class="upd-sidebar-card">
                    <h4>Update Details</h4>
                    ${sidebarRows.join('')}
                </div>` : ''}

                <div class="upd-sidebar-cta">
                    <h4>Interested in our space?</h4>
                    <p>Book a private tour and experience LABOURITES firsthand — no commitment required.</p>
                    <a href="/#contact">Book a Tour <i class="fas fa-arrow-right"></i></a>
                </div>

                <div class="upd-sidebar-card">
                    <h4>More Updates</h4>
                    <div class="upd-sidebar-detail-row">
                        <i class="fas fa-newspaper"></i>
                        <div>
                            <span><a href="/events-updates" style="color:var(--primary-color);font-weight:700;">
                                View all events &amp; announcements →
                            </a></span>
                        </div>
                    </div>
                </div>
            </aside>

        </div>
    `;
}

// Turn plain-text full_description into paragraphs (respects line breaks).
function formatContent(text) {
    if (!text) return '';
    return String(text)
        .split(/\n\s*\n/)
        .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
        .join('');
}


/* =====================================================================
   shared state markup
===================================================================== */
function loadingState(msg) {
    return `<div class="upd-state"><div class="upd-spinner"></div><p>${esc(msg)}</p></div>`;
}
function emptyState() {
    return `<div class="upd-state">
        <i class="far fa-newspaper upd-state-icon"></i>
        <h3>No updates yet</h3>
        <p>We haven't posted anything yet. Check back soon for events, announcements, and news from LABOURITES.</p>
    </div>`;
}
function notFoundState() {
    return `<div class="upd-state">
        <i class="fas fa-circle-question upd-state-icon"></i>
        <h3>Update not found</h3>
        <p>The update you're looking for doesn't exist or may have been removed.</p>
        <a class="btn-cta-light" href="/events-updates">Back to Events &amp; Updates</a>
    </div>`;
}
function errorState(msg) {
    return `<div class="upd-state">
        <i class="fas fa-triangle-exclamation upd-state-icon"></i>
        <h3>Oops</h3>
        <p>${esc(msg)}</p>
    </div>`;
}


/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
    initUpdatesList();
    initUpdateDetails();
});
