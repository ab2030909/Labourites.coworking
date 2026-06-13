# Labourites.coworking

Static website (HTML / CSS / JS) for LABOURITES — a coworking space in DHA Phase 2, Islamabad.
Supabase is used for the contact form (`leads` table) and the Events & Updates system.

---

## Events & Updates system

A public blog/news section plus a private admin panel to publish updates.

### Files

| File | Purpose |
|------|---------|
| `events-updates.html` | Public list of all published updates (cards). |
| `update-details.html` | Single update view (`?slug=...`). |
| `admin/login.html` | Admin email/password login (Supabase Auth). |
| `admin/dashboard.html` | List of all updates with Edit/Delete/Logout. |
| `admin/add-update.html` | Create a new update. |
| `admin/edit-update.html` | Edit an existing update (`?id=...`). |
| `js/supabaseClient.js` | Single shared Supabase client (URL + anon key). |
| `js/updates.js` | Public fetch + render logic. |
| `js/admin-updates.js` | Auth guard, CRUD, image uploads. |
| `supabase-updates-setup.sql` | One-time database + storage setup. |

> The Supabase URL and **anon (public)** key live only in `js/supabaseClient.js`.
> The service_role key is **never** used in the browser.

---

### 1. Create the database table

1. Open your Supabase project → **SQL Editor**.
2. Paste the full contents of `supabase-updates-setup.sql` and **Run**.

This creates:
- `updates` table (with an `updated_at` auto-trigger),
- `admin_users` table,
- Row Level Security policies (public can read only published rows; admins can do everything),
- the `updates` storage bucket + its policies.

It does **not** touch the existing `leads` table.

### 2. Create the storage bucket

The SQL already creates a public bucket named **`updates`**.
To verify/create manually: **Storage → New bucket → name `updates` → Public**.

### 3. Add an admin user

1. **Authentication → Users → Add user** — set an email and password (this is the admin login).
2. In **SQL Editor**, run (use the same email):

   ```sql
   insert into public.admin_users (email) values ('you@example.com');
   ```

Only emails listed in `admin_users` can create/edit/delete updates.

### 4. Publish a new update

1. Go to `admin/login.html` and sign in.
2. On the dashboard, click **Add New Update**.
3. Fill in title (slug auto-fills), category, date, description, upload a cover image, etc.
4. Tick **Publish now** and **Save**.
5. It appears instantly on `events-updates.html`. Unpublished items stay as **Draft** (admin-only).

---

### Notes
- Newest updates show first.
- If there are no published updates, the page shows a clean empty state.
- Deleting asks for confirmation.
- If you open an admin page without logging in, you're redirected to the login page.
