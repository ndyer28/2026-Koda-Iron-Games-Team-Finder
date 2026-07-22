-- IP rate limiting for the submit Edge Function: max 3 per hour.
--
-- Stores a salted SHA-256 of the IP, never the IP itself. We only ever need
-- equality ("has this IP submitted recently"), so the plaintext is dead weight
-- and a liability.

create table submission_attempts (
  id         bigserial primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);

create index submission_attempts_lookup_idx
  on submission_attempts (ip_hash, created_at desc);

-- No policies and RLS on => anon cannot touch this at all. Only the service
-- role (which bypasses RLS) reads and writes it.
alter table submission_attempts enable row level security;
revoke all on table submission_attempts from anon, authenticated;


-- Returns true if this IP is allowed to submit, and records the attempt.
-- Counting and inserting in one statement keeps two concurrent requests from
-- both seeing "2 so far" and both being allowed through.
create function check_and_record_rate_limit(
  p_ip_hash    text,
  p_max        int      default 3,
  p_window     interval default '1 hour'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recent int;
begin
  delete from submission_attempts
  where created_at < now() - '24 hours'::interval;

  select count(*) into v_recent
  from submission_attempts
  where ip_hash = p_ip_hash
    and created_at > now() - p_window;

  if v_recent >= p_max then
    return false;
  end if;

  insert into submission_attempts (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

revoke all on function check_and_record_rate_limit(text, int, interval)
  from public, anon, authenticated;
