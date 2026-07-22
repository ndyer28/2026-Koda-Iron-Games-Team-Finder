-- 1. The Edge Function becomes the only write path for listings.
--
-- The anon INSERT policy let anyone holding the publishable key POST straight
-- to PostgREST, skipping the submit function and its IP rate limit. The rate
-- limit is only real once this is gone.

drop policy if exists listings_anon_insert_pending on listings;
revoke insert on table listings from anon;


-- 2. Email send log.
--
-- Resend's free tier allows 100 emails/day. Bracket notifications scale with
-- bracket size, so a signup rush can blow through that and mail starts
-- bouncing silently. This log lets the confirm function check remaining
-- headroom and shed the low-priority sends first.

create table email_log (
  id         bigserial primary key,
  listing_id uuid references listings(id) on delete set null,
  kind       text not null check (kind in ('confirm','matches','new_in_bracket','closed')),
  sent_at    timestamptz not null default now(),
  ok         boolean not null default true,
  error      text
);

create index email_log_sent_at_idx on email_log (sent_at desc);

alter table email_log enable row level security;
revoke all on table email_log from anon, authenticated;


-- How many emails have gone out in the last 24h. Callers use this to decide
-- whether there is room for optional sends.
create function emails_sent_today()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from email_log
  where sent_at > now() - '24 hours'::interval
    and ok;
$$;

revoke all on function emails_sent_today() from public, anon, authenticated;
