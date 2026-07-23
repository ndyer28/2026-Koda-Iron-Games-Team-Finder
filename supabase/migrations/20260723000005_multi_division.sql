-- Athletes are often willing to compete in more than one division ("I'll do
-- Rx or Scaled"). One division per listing forced them to pick, which hid
-- real matches.
--
-- `division text` becomes `divisions text[]`, and the match rule's equality
-- test becomes an overlap test. Everything else about the rule is unchanged.

alter table listings add column divisions text[];

update listings set divisions = array[division];

alter table listings alter column divisions set not null;

alter table listings add constraint listings_divisions_valid check (
  array_length(divisions, 1) between 1 and 3
  and divisions <@ array['rx', 'scaled', 'masters']
);

-- Dependents must go before the column they read.
drop view if exists public_listings;
drop function if exists find_matches(uuid);
drop function if exists listings_for_email(text, text);
drop index if exists listings_bucket_idx;

alter table listings drop column division;

-- GIN supports the && overlap operator; btree cannot.
create index listings_divisions_idx on listings using gin (divisions);
create index listings_bucket_idx on listings (event_id, sex_division, status);


create view public_listings as
select
  id,
  created_at,
  split_part(btrim(contact_name), ' ', 1) as first_name,
  divisions,
  sex_division,
  current_size,
  notes,
  status
from listings
where status = 'active';

grant select on public_listings to anon;


-- The match rule, unchanged except that divisions now overlap rather than
-- match exactly:
--   1. divisions overlap        (was: division is equal)
--   2. sex_division is equal
--   3. both active
--   4. a.current_size + b.current_size <= 3
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
    and b.divisions     && a.divisions
    and b.sex_division   = a.sex_division
    and b.status         = 'active'
    and a.current_size + b.current_size <= 3
  where a.id     = p_listing_id
    and a.status = 'active'
  order by b.created_at asc;
$$;

revoke all on function find_matches(uuid) from public, anon, authenticated;


create function listings_for_email(p_email text, p_event_id text)
returns table (id uuid, manage_token uuid, status text, current_size int,
               divisions text[], sex_division text)
language sql
stable
security definer
set search_path = public
as $$
  select id, manage_token, status, current_size, divisions, sex_division
  from listings
  where lower(email) = lower(btrim(p_email))
    and event_id = p_event_id
    and status in ('pending', 'active')
  order by created_at desc;
$$;

revoke all on function listings_for_email(text, text)
  from public, anon, authenticated;
