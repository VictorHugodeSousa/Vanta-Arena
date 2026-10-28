create table if not exists public.external_player_stats (
  player_id text not null,
  source text not null check (source in ('csrep', 'platforms')),
  data jsonb not null default '{}'::jsonb,
  period text,
  match_count integer check (match_count is null or match_count >= 0),
  fetched_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (player_id, source)
);

create index if not exists external_player_stats_updated_idx
  on public.external_player_stats (updated_at desc);

alter table public.external_player_stats enable row level security;
revoke all on public.external_player_stats from anon, authenticated;
grant select on public.external_player_stats to anon, authenticated;
grant insert, update on public.external_player_stats to authenticated;

drop policy if exists "Public read external scouting stats" on public.external_player_stats;
drop policy if exists "Editors manage external scouting stats" on public.external_player_stats;
create policy "Public read external scouting stats"
  on public.external_player_stats for select to anon, authenticated using (true);
create policy "Editors manage external scouting stats"
  on public.external_player_stats for all to authenticated
  using (public.is_editor()) with check (public.is_editor());

create or replace function public.touch_external_player_stats_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists external_player_stats_touch_updated_at on public.external_player_stats;
create trigger external_player_stats_touch_updated_at
  before update on public.external_player_stats
  for each row execute function public.touch_external_player_stats_updated_at();
