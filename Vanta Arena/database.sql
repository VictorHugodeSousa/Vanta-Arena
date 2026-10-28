create table if not exists public.cms_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_state (
  id integer primary key check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.site_state (id, data) values
(1, '{"eventName":"CS2 COMMUNITY CUP","players":[],"draft":{"status":"setup","maxPlayers":5,"snake":false,"teams":[],"log":[]},"competition":{"matches":[]}}'::jsonb)
on conflict (id) do nothing;

create table if not exists public.news_posts (
  id text primary key,
  title text not null,
  summary text not null,
  body text not null,
  category text not null default 'COMUNIDADE',
  image_url text,
  author text not null default 'Redação VANTA',
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint news_published_date_consistent check ((status = 'draft' and published_at is null) or (status = 'published' and published_at is not null))
);

create index if not exists news_posts_publication_idx on public.news_posts (status, published_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.prepare_news_post()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'draft' then new.published_at = null;
  elsif new.published_at is null then new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists cms_roles_touch_updated_at on public.cms_roles;
create trigger cms_roles_touch_updated_at before update on public.cms_roles for each row execute function public.touch_updated_at();
drop trigger if exists site_state_touch_updated_at on public.site_state;
create trigger site_state_touch_updated_at before update on public.site_state for each row execute function public.touch_updated_at();
drop trigger if exists news_posts_prepare on public.news_posts;
create trigger news_posts_prepare before insert or update on public.news_posts for each row execute function public.prepare_news_post();
drop trigger if exists news_posts_touch_updated_at on public.news_posts;
create trigger news_posts_touch_updated_at before update on public.news_posts for each row execute function public.touch_updated_at();

create or replace function public.is_editor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cms_roles where user_id = (select auth.uid()) and role in ('owner', 'editor'));
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cms_roles where user_id = (select auth.uid()) and role = 'owner');
$$;

revoke all on function public.is_editor() from public, anon;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_editor() to authenticated;
grant execute on function public.is_owner() to authenticated;

alter table public.cms_roles enable row level security;
alter table public.site_state enable row level security;
alter table public.news_posts enable row level security;
revoke all on public.cms_roles, public.site_state, public.news_posts from anon, authenticated;
grant select on public.cms_roles to authenticated;
grant select on public.site_state to anon, authenticated;
grant insert, update on public.site_state to authenticated;
grant select on public.news_posts to anon, authenticated;
grant insert, update, delete on public.news_posts to authenticated;

drop policy if exists "Read own editorial permission" on public.cms_roles;
drop policy if exists "Owners manage editorial permissions" on public.cms_roles;
drop policy if exists "Public championship information" on public.site_state;
drop policy if exists "Editors create championship information" on public.site_state;
drop policy if exists "Editors update championship information" on public.site_state;
drop policy if exists "Visitors can read published news" on public.news_posts;
drop policy if exists "Editors can read drafts" on public.news_posts;
drop policy if exists "Editors create articles" on public.news_posts;
drop policy if exists "Editors update articles" on public.news_posts;
drop policy if exists "Editors delete articles" on public.news_posts;

create policy "Read own editorial permission" on public.cms_roles for select to authenticated using (user_id = (select auth.uid()));
create policy "Owners manage editorial permissions" on public.cms_roles for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "Public championship information" on public.site_state for select to anon, authenticated using (true);
create policy "Editors create championship information" on public.site_state for insert to authenticated with check (public.is_editor());
create policy "Editors update championship information" on public.site_state for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "Visitors can read published news" on public.news_posts for select to anon, authenticated using (status = 'published');
create policy "Editors can read drafts" on public.news_posts for select to authenticated using (public.is_editor());
create policy "Editors create articles" on public.news_posts for insert to authenticated with check (public.is_editor());
create policy "Editors update articles" on public.news_posts for update to authenticated using (public.is_editor()) with check (public.is_editor());
create policy "Editors delete articles" on public.news_posts for delete to authenticated using (public.is_editor());
