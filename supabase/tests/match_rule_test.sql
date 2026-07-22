-- Match rule tests.
--
-- Returns a PASS/FAIL table so it works in the Supabase SQL Editor (which does
-- not surface RAISE NOTICE output). Run the three sections in order:
--   1. SETUP    — inserts fixtures under event_id 'test-event'
--   2. ASSERT   — returns the results table
--   3. TEARDOWN — deletes the fixtures
--
-- Fixtures use event_id = 'test-event' so they can never match real listings.

-- ===========================================================================
-- 1. SETUP
-- ===========================================================================

insert into listings (event_id, contact_name, email, phone, division, sex_division, current_size, status, confirmed_at) values
  ('test-event', 'SoloA',    'a@test.local', '555-0001', 'rx',     'male',   1, 'active',  now()),
  ('test-event', 'SoloB',    'b@test.local', '555-0002', 'rx',     'male',   1, 'active',  now()),
  ('test-event', 'PairC',    'c@test.local', '555-0003', 'rx',     'male',   2, 'active',  now()),
  ('test-event', 'PairD',    'd@test.local', '555-0004', 'rx',     'male',   2, 'active',  now()),
  ('test-event', 'ScaledE',  'e@test.local', '555-0005', 'scaled', 'male',   1, 'active',  now()),
  ('test-event', 'FemaleF',  'f@test.local', '555-0006', 'rx',     'female', 1, 'active',  now()),
  ('test-event', 'MatchedH', 'h@test.local', '555-0008', 'rx',     'male',   1, 'matched', now()),
  ('other-event','OtherI',   'i@test.local', '555-0009', 'rx',     'male',   1, 'active',  now());

insert into listings (event_id, contact_name, email, phone, division, sex_division, current_size, status) values
  ('test-event', 'PendingG', 'g@test.local', '555-0007', 'rx', 'male', 1, 'pending');


-- ===========================================================================
-- 2. ASSERT
-- ===========================================================================

with id as (
  select
    (select id from listings where event_id = 'test-event' and contact_name = 'SoloA')    as solo_a,
    (select id from listings where event_id = 'test-event' and contact_name = 'PairC')    as pair_c,
    (select id from listings where event_id = 'test-event' and contact_name = 'PendingG') as pending_g,
    (select id from listings where event_id = 'test-event' and contact_name = 'MatchedH') as matched_h
),
checks as (
  -- THE ONE THAT MATTERS: 2 + 2 = 4 > 3, so pairs never match pairs.
  select 1 as n, 'pair + pair returns nothing' as test,
         not exists (
           select 1 from id, find_matches(id.pair_c) m where m.current_size = 2
         ) as ok
  from id

  union all
  -- A pair matches exactly the two solos. Not ScaledE (division),
  -- not FemaleF (sex), not PendingG/MatchedH (status), not OtherI (event).
  select 2, 'pair matches both solos and nothing else',
         (select array_agg(m.contact_name order by m.contact_name)
            from id, find_matches(id.pair_c) m) = array['SoloA','SoloB']
  from id

  union all
  -- A solo matches the other solo (1+1=2) and both pairs (1+2=3).
  select 3, 'solo matches solo + both pairs',
         (select array_agg(m.contact_name order by m.contact_name)
            from id, find_matches(id.solo_a) m) = array['PairC','PairD','SoloB']
  from id

  union all
  select 4, 'no self-match',
         not exists (select 1 from id, find_matches(id.solo_a) m where m.id = id.solo_a)
  from id

  union all
  select 5, 'pending listing returns nothing',
         not exists (select 1 from id, find_matches(id.pending_g) m)
  from id

  union all
  select 6, 'matched listing returns nothing',
         not exists (select 1 from id, find_matches(id.matched_h) m)
  from id

  union all
  select 7, 'public_listings exposes no sensitive column',
         not exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'public_listings'
             and column_name in ('email','phone','contact_name','confirm_token','manage_token')
         )

  union all
  select 8, 'public_listings hides non-active rows',
         not exists (select 1 from public_listings where status <> 'active')

  union all
  select 9, 'first_name is derived from contact_name',
         (select first_name from public_listings where id = (select solo_a from id)) = 'SoloA'
)
select
  n,
  case when ok then 'PASS' else '*** FAIL ***' end as result,
  test
from checks
order by n;


-- ===========================================================================
-- 3. TEARDOWN — run this after reading the results
-- ===========================================================================

-- delete from listings where event_id in ('test-event', 'other-event');
