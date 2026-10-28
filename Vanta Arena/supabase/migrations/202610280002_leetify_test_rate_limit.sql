create table if not exists public.leetify_test_rate_limit (
  id smallint primary key check (id = 1),
  last_requested_at timestamptz not null
);

alter table public.leetify_test_rate_limit enable row level security;
revoke all on public.leetify_test_rate_limit from public, anon, authenticated;

create or replace function public.claim_leetify_test_request()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.leetify_test_rate_limit (id, last_requested_at)
  values (1, clock_timestamp())
  on conflict (id) do update set last_requested_at = clock_timestamp()
  where public.leetify_test_rate_limit.last_requested_at <= clock_timestamp() - interval '60 seconds'
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_leetify_test_request() from public, anon, authenticated;
grant execute on function public.claim_leetify_test_request() to service_role;
