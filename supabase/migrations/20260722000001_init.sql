-- Teammate Finder — initial schema
-- One entity: a listing (a roster fragment with a size).
-- Solo athlete = current_size 1 (needs 2). Pair = current_size 2 (needs 1).

create table listings (
  id             uuid primary key default gen_random_uuid(),
  event_id       text not null default 'iron-games-2026',
  created_at     timestamptz not null default now(),
  contact_name   text not null,
  email          text not null,
  phone          text not null,
  teammate_names text,
  division       text not null check (division in ('rx','scaled','masters')),
  sex_division   text not null check (sex_division in ('male','female')),
  current_size   int  not null check (current_size in (1,2)),
  notes          text,
  status         text not null default 'pending'
                 check (status in ('pending','active','matched','closed')),
  confirm_token  uuid not null default gen_random_uuid(),
  manage_token   uuid not null default gen_random_uuid(),
  confirmed_at   timestamptz,
  last_notified_at timestamptz
);

create index listings_bucket_idx
  on listings (event_id, division, sex_division, status);
create unique index listings_confirm_token_idx on listings (confirm_token);
create unique index listings_manage_token_idx  on listings (manage_token);


-- ---------------------------------------------------------------------------
-- Public view: no email, no phone, no tokens, no full name. Active only.
-- ---------------------------------------------------------------------------

-- NOTE: deliberately NOT security_invoker. The view runs with its owner's
-- rights so it can read `listings` (which anon is fully denied on) while
-- exposing only the safe columns below. security_invoker = true would make
-- this view return zero rows to anon.
create view public_listings as
select
  id,
  created_at,
  split_part(btrim(contact_name), ' ', 1) as first_name,
  division,
  sex_division,
  current_size,
  notes,
  status
from listings
where status = 'active';


-- ---------------------------------------------------------------------------
-- The match rule. Defined once, called from everywhere.
--   1. same division
--   2. same sex_division
--   3. both active
--   4. a.current_size + b.current_size <= 3
-- Same event_id is implied (single-event board, bucket index leads with it).
-- ---------------------------------------------------------------------------

create function find_matches(p_listing_id uuid)
returns setof listings
language sql
stable
security definer
set search_path = public
as $$
  select b.*
  from listings a
  join listings b
    on  b.id            <> a.id
    and b.event_id       = a.event_id
    and b.division       = a.division
    and b.sex_division   = a.sex_division
    and b.status         = 'active'
    and a.current_size + b.current_size <= 3
  where a.id     = p_listing_id
    and a.status = 'active'
  order by b.created_at asc;
$$;

revoke all on function find_matches(uuid) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
-- Row Level Security
--   anon: INSERT only, and only status='pending'. No SELECT/UPDATE/DELETE.
--   Everything touching email/phone happens in Edge Functions (service role,
--   which bypasses RLS).
-- ---------------------------------------------------------------------------

alter table listings enable row level security;

revoke all on table listings from anon, authenticated;
grant insert on table listings to anon;

create policy listings_anon_insert_pending
  on listings
  for insert
  to anon
  with check (
    status = 'pending'
    and confirmed_at is null
    and last_notified_at is null
    and current_size in (1, 2)
  );

-- No select/update/delete policies for anon => denied by default under RLS.

grant select on public_listings to anon;
