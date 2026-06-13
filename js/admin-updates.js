/*
 * Admin logic for the "Events & Updates" system.
 * Handles: auth guard, login, logout, list, create, edit, delete,
 * and image uploads to Supabase Storage.
 *
 * Requires: supabaseClient.js loaded first (defines supabaseClient,
 * UPDATES_BUCKET).
 *
 * Each admin page calls the matching init function at the bottom.
 */

/* ---------- helpers ---------- */

function adminEsc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function slugify(text) {
    return String(text || '')
        .toLowerCase()
        .trim()
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

// Returns the current logged-in session, or null.
async function getSession() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    return data ? data.session : null;
}

// Redirect to login if not authenticated. Returns the session if OK.
async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.replace('login.html');
        return null;
    }
    return session;
}

// Upload a single file to the updates bucket; returns its public URL.
async function uploadImage(file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabaseClient
        .storage.from(UPDATES_BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    const { data } = supabaseClient.storage.from(UPDATES_BUCKET).getPublicUrl(path);
    return data.publicUrl;
}


/* =====================================================================
   LOGIN PAGE  (admin/login.html)
===================================================================== */
function initAdminLogin() {
    const form = document.getElementById('login-form');
    if (!form) return;

    const msg = document.getElementById('login-msg');
    const btn = form.querySelector('button[type="submit"]');

    // If already logged in, skip straight to dashboard.
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

        const email = form.email.value.trim();
        const password = form.password.value;

        btn.disabled = true;
        const original = btn.textContent;
        btn.textContent = 'Signing in…';

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            window.location.replace('dashboard.html');
        } catch (err) {
            console.error(err);
            msg.textContent = err.message || 'Login failed. Check your email and password.';
            msg.classList.add('error');
            btn.disabled = false;
            btn.textContent = original;
        }
    });
}


/* =====================================================================
   LOGOUT  (shared)
===================================================================== */
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
   DASHBOARD  (admin/dashboard.html)
===================================================================== */
async function initAdminDashboard() {
    const tableBody = document.getElementById('updates-tbody');
    if (!tableBody) return;

    const session = await requireAuth();
    if (!session) return;

    // Show logged-in email
    const who = document.getElementById('admin-email');
    if (who && session.user) who.textContent = session.user.email;

    wireLogout();
    await loadDashboard();
}

async function loadDashboard() {
    const tableBody = document.getElementById('updates-tbody');
    const stateBox = document.getElementById('dash-state');
    const tableWrap = document.getElementById('dash-table-wrap');

    stateBox.innerHTML = '<div class="upd-spinner"></div><p>Loading updates…</p>';
    stateBox.style.display = '';
    tableWrap.style.display = 'none';

    try {
        const { data, error } = await supabaseClient
            .from('updates')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

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

        // wire delete buttons
        tableBody.querySelectorAll('[data-delete]').forEach(btn => {
            btn.addEventListener('click', () => handleDelete(btn.getAttribute('data-delete'), btn.getAttribute('data-title')));
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
            <a class="admin-btn admin-btn-sm" href="edit-update.html?id=${encodeURIComponent(u.id)}"><i class="fas fa-pen"></i> Edit</a>
            <button class="admin-btn admin-btn-sm admin-btn-danger" data-delete="${adminEsc(u.id)}" data-title="${adminEsc(u.title)}"><i class="fas fa-trash"></i> Delete</button>
        </td>
    </tr>`;
}

async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
        const { error } = await supabaseClient.from('updates').delete().eq('id', id);
        if (error) throw error;
        await loadDashboard();
    } catch (err) {
        console.error(err);
        alert('Failed to delete: ' + (err.message || 'unknown error'));
    }
}


/* =====================================================================
   ADD / EDIT FORM  (admin/add-update.html & admin/edit-update.html)
===================================================================== */
async function initAdminForm() {
    const form = document.getElementById('update-form');
    if (!form) return;

    const session = await requireAuth();
    if (!session) return;
    wireLogout();

    const msg = document.getElementById('form-msg');
    const titleInput = form.title;
    const slugInput = form.slug;

    // Auto-generate slug from title until the user manually edits the slug.
    let slugTouched = false;
    slugInput.addEventListener('input', () => { slugTouched = true; });
    titleInput.addEventListener('input', () => {
        if (!slugTouched) slugInput.value = slugify(titleInput.value);
    });

    // Are we editing? look for ?id=
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    let existing = null;

    if (editId) {
        slugTouched = true; // don't auto-overwrite an existing slug
        try {
            const { data, error } = await supabaseClient
                .from('updates').select('*').eq('id', editId).maybeSingle();
            if (error) throw error;
            if (!data) {
                msg.textContent = 'Update not found.';
                msg.className = 'admin-msg error';
                return;
            }
            existing = data;
            fillForm(form, data);
        } catch (err) {
            console.error(err);
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
            // ----- cover image -----
            let coverUrl = existing ? existing.cover_image_url : null;
            const coverFile = form.cover_image.files[0];
            if (coverFile) {
                btn.textContent = 'Uploading cover…';
                coverUrl = await uploadImage(coverFile);
            }

            // ----- gallery images -----
            let gallery = [];
            if (existing && Array.isArray(existing.gallery_images)) {
                gallery = existing.gallery_images.slice();
            }
            const galleryFiles = form.gallery_images.files;
            if (galleryFiles && galleryFiles.length) {
                btn.textContent = 'Uploading gallery…';
                for (const f of galleryFiles) {
                    const url = await uploadImage(f);
                    gallery.push(url);
                }
            }

            btn.textContent = 'Saving…';

            // Confirm the session is still valid before attempting the write
            const { data: sessionCheck } = await supabaseClient.auth.getSession();
            if (!sessionCheck?.session) {
                throw new Error('Your session has expired. Please log out and log in again.');
            }
            console.log('Saving as:', sessionCheck.session.user.email, '| role:', sessionCheck.session.user.role);

            const payload = {
                title: form.title.value.trim(),
                slug: slugify(form.slug.value) || slugify(form.title.value),
                category: form.category.value || null,
                short_description: form.short_description.value.trim() || null,
                full_description: form.full_description.value.trim() || null,
                update_date: form.update_date.value || null,
                venue: form.venue.value.trim() || null,
                cover_image_url: coverUrl,
                gallery_images: gallery,
                is_published: form.is_published.checked
            };

            if (!payload.title) throw new Error('Title is required.');
            if (!payload.slug) throw new Error('Slug is required.');

            let error;
            if (existing) {
                ({ error } = await supabaseClient.from('updates').update(payload).eq('id', existing.id));
            } else {
                ({ error } = await supabaseClient.from('updates').insert([payload]));
            }
            if (error) throw error;

            window.location.replace('dashboard.html');
        } catch (err) {
            console.error(err);
            let m = err.message || 'Failed to save.';
            if (err.code === '23505' || /duplicate|unique/i.test(m)) {
                m = 'That slug is already used. Please choose a different slug.';
            } else if (/bucket not found|no such bucket|storage/i.test(m)) {
                m = 'Storage bucket "updates" not found. Go to Supabase Dashboard → Storage → New bucket, name it "updates", make it Public, then try again.';
            }
            msg.textContent = m;
            msg.className = 'admin-msg error';
            btn.disabled = false;
            btn.textContent = originalBtn;
        }
    });
}

function fillForm(form, u) {
    form.title.value = u.title || '';
    form.slug.value = u.slug || '';
    if (u.category) form.category.value = u.category;
    form.short_description.value = u.short_description || '';
    form.full_description.value = u.full_description || '';
    form.update_date.value = u.update_date || '';
    form.venue.value = u.venue || '';
    form.is_published.checked = !!u.is_published;

    // Show current cover + gallery previews
    const coverPrev = document.getElementById('cover-preview');
    if (coverPrev && u.cover_image_url) {
        coverPrev.innerHTML = `<img src="${adminEsc(u.cover_image_url)}" alt="current cover">
            <span class="admin-prev-label">Current cover</span>`;
    }
    const galPrev = document.getElementById('gallery-preview');
    if (galPrev && Array.isArray(u.gallery_images) && u.gallery_images.length) {
        galPrev.innerHTML = u.gallery_images
            .map(src => `<img src="${adminEsc(src)}" alt="gallery image">`).join('');
    }

    // Heading hint
    const heading = document.getElementById('form-heading');
    if (heading) heading.textContent = 'Edit Update';
}


/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded', () => {
    initAdminLogin();
    initAdminDashboard();
    initAdminForm();
});
