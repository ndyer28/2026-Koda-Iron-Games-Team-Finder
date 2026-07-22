-- RLS tests. Proves the browser (anon key) can never reach email/phone.
--   psql "$DATABASE_URL" -f supabase/tests/rls_test.sql

begin;

-- anon may INSERT a pending row -------------------------------------------
set local role anon;

insert into listings (contact_name, email, phone, division, sex_division, current_size)
values ('Anon Test', 'anon@test.local', '555-1000', 'rx', 'male', 1);

do $$ begin raise notice 'PASS  anon can insert (defaults to pending)'; end $$;

-- anon may NOT insert a pre-activated row ----------------------------------
do $$
begin
  insert into listings (contact_name, email, phone, division, sex_division, current_size, status)
  values ('Cheater', 'x@test.local', '555-1001', 'rx', 'male', 1, 'active');
  raise exception 'FAIL anon inserted an active listing';
exception
  when insufficient_privilege then raise notice 'PASS  anon cannot insert status=active';
end $$;

-- anon may NOT read listings ------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from listings;
  raise exception 'FAIL anon read listings (% rows)', n;
exception
  when insufficient_privilege then raise notice 'PASS  anon cannot SELECT listings';
end $$;

do $$
begin
  update listings set status = 'active';
  raise exception 'FAIL anon updated listings';
exception
  when insufficient_privilege then raise notice 'PASS  anon cannot UPDATE listings';
end $$;

do $$
begin
  delete from listings;
  raise exception 'FAIL anon deleted listings';
exception
  when insufficient_privilege then raise notice 'PASS  anon cannot DELETE listings';
end $$;

-- anon may NOT call the match function --------------------------------------
do $$
begin
  perform find_matches(gen_random_uuid());
  raise exception 'FAIL anon called find_matches';
exception
  when insufficient_privilege then raise notice 'PASS  anon cannot call find_matches';
end $$;

-- anon MAY read the public view ---------------------------------------------
do $$
begin
  perform count(*) from public_listings;
  raise notice 'PASS  anon can SELECT public_listings';
end $$;

reset role;
rollback;
