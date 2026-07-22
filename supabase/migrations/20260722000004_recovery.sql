-- "Email me my link" recovery, plus duplicate-signup handling.
-- Both send a mail kind the log doesn't know about yet.

alter table email_log drop constraint email_log_kind_check;

alter table email_log add constraint email_log_kind_check
  check (kind in ('confirm','matches','new_in_bracket','closed','recovery'));


-- Finding a listing by email is the one lookup that could be abused to test
-- whether a given person signed up. The recover function always responds
-- identically regardless of outcome, and this function is service-role only,
-- but keep it narrow anyway: it returns manage tokens, nothing else.
create function listings_for_email(p_email text, p_event_id text)
returns table (id uuid, manage_token uuid, status text, current_size int,
               division text, sex_division text)
language sql
stable
security definer
set search_path = public
as $$
  select id, manage_token, status, current_size, division, sex_division
  from listings
  where lower(email) = lower(btrim(p_email))
    and event_id = p_event_id
    and status in ('pending', 'active')
  order by created_at desc;
$$;

revoke all on function listings_for_email(text, text)
  from public, anon, authenticated;
