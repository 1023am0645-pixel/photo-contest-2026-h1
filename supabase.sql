create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'photo-contest-2026-h1',
    'photo-contest-2026-h1',
    true,
    12582912,
    null
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.photo_event_2026_h1 (
    id uuid primary key default gen_random_uuid(),
    uploader_name text not null,
    message text,
    file_path text not null unique,
    original_filename text,
    rating integer not null default 0 check (rating between 0 and 5),
    is_winner boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.photo_event_settings (
    key text primary key,
    value text not null
);

insert into public.photo_event_settings (key, value)
values ('admin_code', '1234')
on conflict (key) do nothing;

alter table public.photo_event_2026_h1 enable row level security;
alter table public.photo_event_settings enable row level security;

drop policy if exists "photo event submissions are readable" on public.photo_event_2026_h1;
create policy "photo event submissions are readable"
on public.photo_event_2026_h1 for select
to anon
using (true);

drop policy if exists "students can submit photos" on public.photo_event_2026_h1;
create policy "students can submit photos"
on public.photo_event_2026_h1 for insert
to anon
with check (
    length(trim(uploader_name)) > 0
    and file_path is not null
);

drop policy if exists "photo event objects are readable" on storage.objects;
create policy "photo event objects are readable"
on storage.objects for select
to anon
using (bucket_id = 'photo-contest-2026-h1');

drop policy if exists "students can upload photo event objects" on storage.objects;
create policy "students can upload photo event objects"
on storage.objects for insert
to anon
with check (bucket_id = 'photo-contest-2026-h1');

create or replace function public.verify_photo_event_admin(p_admin_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.photo_event_settings
        where key = 'admin_code'
          and value = p_admin_code
    );
$$;

create or replace function public.set_photo_event_review(
    p_id uuid,
    p_rating integer,
    p_is_winner boolean,
    p_admin_code text
)
returns public.photo_event_2026_h1
language plpgsql
security definer
set search_path = public
as $$
declare
    updated_row public.photo_event_2026_h1;
begin
    if not public.verify_photo_event_admin(p_admin_code) then
        raise exception 'invalid admin code';
    end if;

    if p_rating < 0 or p_rating > 5 then
        raise exception 'rating must be between 0 and 5';
    end if;

    update public.photo_event_2026_h1
    set rating = p_rating,
        is_winner = p_is_winner
    where id = p_id
    returning * into updated_row;

    if updated_row.id is null then
        raise exception 'photo not found';
    end if;

    return updated_row;
end;
$$;

create or replace function public.delete_photo_event_submission(
    p_id uuid,
    p_admin_code text
)
returns boolean
language plpgsql
security definer
set search_path = public, storage
as $$
declare
    target_path text;
begin
    if not public.verify_photo_event_admin(p_admin_code) then
        raise exception 'invalid admin code';
    end if;

    select file_path into target_path
    from public.photo_event_2026_h1
    where id = p_id;

    if target_path is null then
        raise exception 'photo not found';
    end if;

    delete from public.photo_event_2026_h1 where id = p_id;
    delete from storage.objects
    where bucket_id = 'photo-contest-2026-h1'
      and name = target_path;

    return true;
end;
$$;

grant execute on function public.verify_photo_event_admin(text) to anon;
grant execute on function public.set_photo_event_review(uuid, integer, boolean, text) to anon;
grant execute on function public.delete_photo_event_submission(uuid, text) to anon;

do $$
begin
    alter publication supabase_realtime add table public.photo_event_2026_h1;
exception
    when duplicate_object then null;
end $$;
