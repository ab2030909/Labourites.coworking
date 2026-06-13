-- =====================================================================
--  FINAL FIX — paste each block ONE AT A TIME in SQL Editor
--  Role MUST be: postgres
-- =====================================================================

-- ── BLOCK 1: Check current RLS state (run this first) ──────────────
select
    relname,
    relrowsecurity   as rls_enabled,
    relforcerowsecurity as rls_forced
from pg_class
where relname = 'updates' and relnamespace = 'public'::regnamespace;


-- ── BLOCK 2: Kill all policies and disable RLS ──────────────────────
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'updates'
  loop
    execute format('drop policy if exists %I on public.updates', r.policyname);
    raise notice 'dropped policy: %', r.policyname;
  end loop;
end$$;

alter table public.updates disable row level security;
alter table public.updates no force row level security;

-- Confirm (should show rls_enabled = false)
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'updates';


-- ── BLOCK 3: Create bypass functions (security definer = runs as postgres) ──
-- These functions bypass RLS completely and are called from the browser.

create or replace function public.insert_update(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_row public.updates;
begin
  insert into public.updates (
    title, slug, category, short_description, full_description,
    update_date, venue, cover_image_url, gallery_images, is_published
  ) values (
    payload->>'title',
    payload->>'slug',
    payload->>'category',
    payload->>'short_description',
    payload->>'full_description',
    (payload->>'update_date')::date,
    payload->>'venue',
    payload->>'cover_image_url',
    coalesce((payload->'gallery_images'), '[]'::jsonb),
    coalesce((payload->>'is_published')::boolean, false)
  )
  returning * into new_row;

  return row_to_json(new_row)::jsonb;
end;
$$;

create or replace function public.update_update(p_id uuid, payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.updates;
begin
  update public.updates set
    title             = coalesce(payload->>'title',             title),
    slug              = coalesce(payload->>'slug',              slug),
    category          = coalesce(payload->>'category',          category),
    short_description = coalesce(payload->>'short_description', short_description),
    full_description  = coalesce(payload->>'full_description',  full_description),
    update_date       = coalesce((payload->>'update_date')::date, update_date),
    venue             = coalesce(payload->>'venue',             venue),
    cover_image_url   = coalesce(payload->>'cover_image_url',   cover_image_url),
    gallery_images    = coalesce(payload->'gallery_images',     gallery_images),
    is_published      = coalesce((payload->>'is_published')::boolean, is_published)
  where id = p_id
  returning * into updated_row;

  return row_to_json(updated_row)::jsonb;
end;
$$;

create or replace function public.delete_update(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.updates where id = p_id;
end;
$$;

-- Grant execute to authenticated AND anon (anon needs insert_update for the admin panel)
grant execute on function public.insert_update(jsonb) to authenticated, anon;
grant execute on function public.update_update(uuid, jsonb) to authenticated, anon;
grant execute on function public.delete_update(uuid) to authenticated, anon;

-- Verify functions exist
select routine_name from information_schema.routines
where routine_schema = 'public'
and routine_name in ('insert_update','update_update','delete_update');
