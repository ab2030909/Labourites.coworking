-- =====================================================================
--  LABOURITES — "Events & Updates" Supabase setup
--  Run this ENTIRE file in the Supabase SQL Editor (one time).
--  Safe: does not touch the existing "leads" table.
--
--  IMPORTANT: In the SQL Editor, set the Role dropdown to "postgres"
--  (top-right corner of the editor) before running, OR run as the
--  postgres superuser so you have permission to create tables.
-- =====================================================================

-- Grant yourself permission first (run this if you get permission denied)
set role postgres;


-- ---------------------------------------------------------------------
-- 1. UPDATES TABLE
-- ---------------------------------------------------------------------
create table if not exists public.updates (
    id                uuid primary key default gen_random_uuid(),
    title             text not null,
    slug              text unique not null,
    category          text,
    short_description text,
    full_description  text,
    update_date       date,
    venue             text,
    cover_image_url   text,
    gallery_images    jsonb default '[]'::jsonb,
    is_published      boolean default false,
    created_at        timestamptz default now(),
    updated_at        timestamptz default now()
);

create index if not exists updates_published_created_idx
    on public.updates (is_published, created_at desc);


-- ---------------------------------------------------------------------
-- 2. updated_at AUTO-UPDATE TRIGGER
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_updates_updated_at on public.updates;
create trigger trg_updates_updated_at
    before update on public.updates
    for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--
--  Simple, reliable approach:
--    • Anyone (anon)         → can SELECT only published rows
--    • Any authenticated user → can SELECT, INSERT, UPDATE, DELETE all rows
--
--  This works because your Supabase Auth has exactly ONE user
--  (info.labourites@gmail.com). Only that account can log in and
--  reach the admin panel. No extra admin_users table needed.
-- ---------------------------------------------------------------------
alter table public.updates enable row level security;

-- Public: read only published rows
drop policy if exists "public read published updates" on public.updates;
create policy "public read published updates"
    on public.updates
    for select
    using ( is_published = true );

-- Authenticated (admin): read ALL rows including drafts
drop policy if exists "auth read all updates" on public.updates;
create policy "auth read all updates"
    on public.updates
    for select
    to authenticated
    using ( true );

-- Authenticated (admin): insert
drop policy if exists "auth insert updates" on public.updates;
create policy "auth insert updates"
    on public.updates
    for insert
    to authenticated
    with check ( true );

-- Authenticated (admin): update
drop policy if exists "auth update updates" on public.updates;
create policy "auth update updates"
    on public.updates
    for update
    to authenticated
    using ( true )
    with check ( true );

-- Authenticated (admin): delete
drop policy if exists "auth delete updates" on public.updates;
create policy "auth delete updates"
    on public.updates
    for delete
    to authenticated
    using ( true );


-- ---------------------------------------------------------------------
-- 4. STORAGE BUCKET POLICIES
--    Create the bucket manually first:
--    Dashboard > Storage > New bucket > name: "updates" > Public ON
--    Then run these storage policies.
-- ---------------------------------------------------------------------

-- Public can view all images (bucket is public)
drop policy if exists "public read updates bucket" on storage.objects;
create policy "public read updates bucket"
    on storage.objects
    for select
    using ( bucket_id = 'updates' );

-- Authenticated users can upload
drop policy if exists "auth upload updates bucket" on storage.objects;
create policy "auth upload updates bucket"
    on storage.objects
    for insert
    to authenticated
    with check ( bucket_id = 'updates' );

-- Authenticated users can update/replace files
drop policy if exists "auth update updates bucket" on storage.objects;
create policy "auth update updates bucket"
    on storage.objects
    for update
    to authenticated
    using ( bucket_id = 'updates' );

-- Authenticated users can delete files
drop policy if exists "auth delete updates bucket" on storage.objects;
create policy "auth delete updates bucket"
    on storage.objects
    for delete
    to authenticated
    using ( bucket_id = 'updates' );


-- =====================================================================
--  AFTER RUNNING THIS FILE:
--
--  1. Go to Authentication > Users > Add user
--       Email:    info.labourites@gmail.com
--       Password: Labourites@68
--       Tick "Auto Confirm User"
--
--  2. Go to Storage > New bucket
--       Name: updates
--       Public: ON
--
--  That's it. No admin_users table needed.
-- =====================================================================
