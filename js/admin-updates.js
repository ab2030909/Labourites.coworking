/*
 * Admin logic — calls the /api/updates and /api/uploads Vercel functions
 * instead of Supabase directly. This completely bypasses RLS because the
 * API functions use the service role key server-side.
 *
 * Requires: supabaseClient.js loaded first (for auth only — login/logout).
 */

const ADMIN_SECRET  = 'Labourites@68';  // must match ADMIN_SECRET env var in Vercel
const API_BASE      = '/api';           // Vercel functions base path

/* ---------- helpers ---------- */

function adminEsc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function slugify(text) {
    return String(text || '')
        .toLowerCase().trim()
        .replace(/['"]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function fmtAdminDate(value) {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('en-GB',
            { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return value; }
}

/* ---------- API wrappers ---------- */

async function apiGet(path) {
    const res = await fetch(API_BASE + path);
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(API_BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
}

async function apiPut(path, body) {
    const res = await fetch(API_BASE + path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
}

async function apiDelete(path) {
    const res = await fetch(API_BASE + path, {
        method: 'DELETE',
        headers: { 'x-admin-secret': ADMIN_SECRET }
    });
    if (!res.ok) throw new Error((await res.json()).error || `HTTP ${res.status}`);
    return res.json();
}

async function uploadImageViaApi(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(API_BASE + '/uploads', {
        method: 'POST',
        headers: { 'x-admin-secret': ADMIN_SECRET },
        body: formData
    });
    if (!res.ok) throw new Error((await res.json()).error || `Upload failed HTTP ${res.status}`);
    const json = await res.json();
    return json.url;
}

/* ---------- auth (still uses Supabase Auth for login/logout UI) ---------- */

async function getSession() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    return data ? data.session : null;
}

async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.replace('login.html');
        return null;
    }
    return session;
}

function wireLogout() {
    document.querySelectorAll('[data-logout]').forEach(el => {
        el.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabaseClient.auth.signOut();
            window.location.replace('login.html');
        });
    });
}

/* =====================================================================
   LOGIN PAGE
===================================================================== */
function initAdminLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const msg = document.getElementById('login-msg');
    const btn = form.querySelector('button[type="submit"]');

    getSession().then(s => { if (s) window.location.replace('dashboard.html'); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.textContent = '';
        msg.className = 'admin-msg';

        if (!supabaseClient) {
            msg.textContent = 'Server connection error.';
            msg.classList.add('error');
            return;
        }

        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Signing in…';

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email: form.email.value.trim(),
                password: form.password.value
            });
            if (error) throw error;
            window.location.replace('dashboard.html');
        } catch (err) {
            msg.textContent = err.message || 'Login failed.';
            msg.classList.add('error');
            btn.disabled = false;
            btn.textContent = original;
        }
    });
}

/* =====================================================================
   DASHBOARD
===================================================================== */
async function initAdminDashboard() {
    const tableBody = document.getElementById('updates-tbody');
    if (!tableBody) return;

    const session = await requireAuth();
    if (!session) return;

    const who = document.getElementById('admin-email');
    if (who && session.user) who.textContent = session.user.email;

    wireLogout();
    await loadDashboard();
}

async function loadDashboard() {
    const tableBody  = document.getElementById('updates-tbody');
    const stateBox   = document.getElementById('dash-state');
    const tableWrap  = document.getElementById('dash-table-wrap');

    stateBox.innerHTML = '<div class="upd-spinner"></div><p>Loading updates…</p>';
    stateBox.style.display = '';
    tableWrap.style.display = 'none';

    try {
        const data = await apiGet('/updates');

        if (!data || data.length === 0) {
            stateBox.innerHTML = `<i class="far fa-newspaper upd-state-icon"></i>
                <h3>No updates yet</h3>
                <p>Create your first update to get started.</p>
                <a class="admin-btn admin-btn-primary" href="add-update.html"><i class="fas fa-plus"></i> Add New Update</a>`;
            return;
        }

        stateBox.style.display = 'none';
        tableWrap.style.display = '';
        tableBody.innerHTML = data.map(rowMarkup).join('');

        tableBody.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () =>
                handleDelete(btn.getAttribute('data-delete'), btn.getAttribute('data-title')));
        });
    } catch (err) {
        console.error(err);
        stateBox.innerHTML = `<i class="fas fa-triangle-exclamation upd-state-icon"></i>
            <h3>Could not load updates</h3><p>${adminEsc(err.message || '')}</p>`;
    }
}

function rowMarkup(u) {
    const status = u.is_published
        ? '<span class="admin-status published">Published</span>'
        : '<span class="admin-status draft">Draft</span>';
    return `
    <tr>
        <td>
            <div class="admin-row-title">${adminEsc(u.title)}</div>
            <div class="admin-row-slug">/${adminEsc(u.slug)}</div>
        </td>
        <td>${u.category ? adminEsc(u.category) : '—'}</td>
        <td>${fmtAdminDate(u.update_date)}</td>
        <td>${status}</td>
        <td class="admin-row-actions">
            <a class="admin-btn admin-btn-sm" href="edit-update.html?id=${encodeURIComponent(u.id)}">
                <i class="fas fa-pen"></i> Edit</a>
            <button class="admin-btn admin-btn-sm admin-btn-danger"
                data-delete="${adminEsc(u.id)}" data-title="${adminEsc(u.title)}">
                <i class="fas fa-trash"></i> Delete</button>
        </td>
    </tr>`;
}

async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
        await apiDelete(`/updates?id=${encodeURIComponent(id)}`);
        await loadDashboard();
    } catch (err) {
        alert('Failed to delete: ' + (err.message || 'unknown error'));
    }
}

/* =====================================================================
   ADD / EDIT FORM
===================================================================== */
async function initAdminForm() {
    const form = document.getElementById('update-form');
    if (!form) return;

    const session = await requireAuth();
    if (!session) return;
    wireLogout();

    const msg       = document.getElementById('form-msg');
    const slugInput = form.slug;
    const titleInput = form.title;

    let slugTouched = false;
    slugInput.addEventListener('input', () => { slugTouched = true; });
    titleInput.addEventListener('input', () => {
        if (!slugTouched) slugInput.value = slugify(titleInput.value);
    });

    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    let existing = null;

    if (editId) {
        slugTouched = true;
        try {
            // Admin reads via API (gets drafts too)
            const all = await apiGet('/updates');
            existing = all.find(u => u.id === editId) || null;
            if (!existing) {
                msg.textContent = 'Update not found.';
                msg.className = 'admin-msg error';
                return;
            }
            fillForm(form, existing);
        } catch (err) {
            msg.textContent = 'Failed to load update: ' + (err.message || '');
            msg.className = 'admin-msg error';
            return;
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.textContent = '';
        msg.className = 'admin-msg';

        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        const originalBtn = btn.textContent;
        btn.textContent = 'Saving…';

        try {
            // Upload cover image if a new one is selected
            let coverUrl = existing ? existing.cover_image_url : null;

            // Check if cover was removed
            if (document.getElementById('cover-removed')?.value === 'true') {
                coverUrl = null;
            }

            const coverFile = form.cover_image.files[0];
            if (coverFile) {
                btn.textContent = 'Uploading cover…';
                coverUrl = await uploadImageViaApi(coverFile);
            }

            // Gallery: start from kept images (those not removed)
            const keptGallery = Array.from(
                document.querySelectorAll('.admin-gallery-kept-url')
            ).map(el => el.value);

            // Upload any new gallery files
            const galleryFiles = form.gallery_images.files;
            if (galleryFiles && galleryFiles.length) {
                btn.textContent = 'Uploading gallery…';
                for (const f of galleryFiles) {
                    const url = await uploadImageViaApi(f);
                    keptGallery.push(url);
                }
            }

            btn.textContent = 'Saving…';

            const payload = {
                title:             form.title.value.trim(),
                slug:              slugify(form.slug.value) || slugify(form.title.value),
                category:          form.category.value || null,
                short_description: form.short_description.value.trim() || null,
                full_description:  form.full_description.value.trim() || null,
                update_date:       form.update_date.value || null,
                venue:             form.venue.value.trim() || null,
                cover_image_url:   coverUrl,
                gallery_images:    keptGallery,
                is_published:      form.is_published.checked
            };

            if (!payload.title) throw new Error('Title is required.');
            if (!payload.slug)  throw new Error('Slug is required.');

            if (existing) {
                await apiPut(`/updates?id=${encodeURIComponent(existing.id)}`, payload);
            } else {
                await apiPost('/updates', payload);
            }

            window.location.replace('dashboard.html');

        } catch (err) {
            let m = err.message || 'Failed to save.';
            if (/duplicate|unique|23505/i.test(m)) {
                m = 'That slug is already used. Please choose a different slug.';
            }
            msg.textContent = m;
            msg.className = 'admin-msg error';
            btn.disabled = false;
            btn.textContent = originalBtn;
        }
    });
}

function fillForm(form, u) {
    form.title.value             = u.title || '';
    form.slug.value              = u.slug || '';
    if (u.category) form.category.value = u.category;
    form.short_description.value = u.short_description || '';
    form.full_description.value  = u.full_description || '';
    form.update_date.value       = u.update_date || '';
    form.venue.value             = u.venue || '';
    form.is_published.checked    = !!u.is_published;

    // Cover preview with remove button
    const coverPrev = document.getElementById('cover-preview');
    if (coverPrev && u.cover_image_url) {
        coverPrev.innerHTML = `
            <div class="admin-img-removable">
                <img src="${adminEsc(u.cover_image_url)}" alt="current cover">
                <button type="button" class="admin-img-remove" title="Remove cover image"
                    onclick="
                        this.closest('.admin-img-removable').remove();
                        document.getElementById('cover-removed').value='true';
                    ">×</button>
                <span class="admin-prev-label">Current cover</span>
            </div>
            <input type="hidden" id="cover-removed" value="false">`;
    }

    // Gallery previews with individual remove buttons
    const galPrev = document.getElementById('gallery-preview');
    if (galPrev && Array.isArray(u.gallery_images) && u.gallery_images.length) {
        galPrev.innerHTML = u.gallery_images.map((src, i) => `
            <div class="admin-img-removable">
                <img src="${adminEsc(src)}" alt="gallery image">
                <button type="button" class="admin-img-remove" title="Remove this image"
                    onclick="this.closest('.admin-img-removable').remove()">×</button>
                <input type="hidden" class="admin-gallery-kept-url" value="${adminEsc(src)}">
            </div>`).join('');
    }

    const heading = document.getElementById('form-heading');
    if (heading) heading.textContent = 'Edit Update';
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
    initAdminLogin();
    initAdminDashboard();
    initAdminForm();
});
