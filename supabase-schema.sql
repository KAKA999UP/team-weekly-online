create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings (key, value)
values
  ('leader_code', '123456'),
  ('invite_code', 'TDD')
on conflict (key) do nothing;

create table if not exists public.members (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.members
  add column if not exists username text unique;

create table if not exists public.employee_accounts (
  id bigserial primary key,
  member_id bigint not null unique references public.members(id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leader_plans (
  id bigserial primary key,
  week text not null,
  title text not null,
  details text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_plans (
  id bigserial primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  week text not null,
  title text not null,
  details text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  points integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.checkins (
  id bigserial primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  leader_plan_id bigint not null references public.leader_plans(id) on delete cascade,
  note text not null,
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique(member_id, leader_plan_id)
);

create table if not exists public.point_awards (
  id bigserial primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  points integer not null check (points > 0),
  reason text not null default '',
  created_at timestamptz not null default now()
);

insert into public.leader_plans (week, title, details)
select to_char(now(), 'IYYY-"W"IW'), '本周团队计划',
       '1. 明确本周关键目标
2. 每位成员提交自己的本周计划
3. 周中至少打卡一次进度
4. 周五前同步完成情况'
where not exists (select 1 from public.leader_plans);

alter table public.app_settings enable row level security;
alter table public.members enable row level security;
alter table public.employee_accounts enable row level security;
alter table public.leader_plans enable row level security;
alter table public.member_plans enable row level security;
alter table public.checkins enable row level security;
alter table public.point_awards enable row level security;

drop policy if exists "Public can read members" on public.members;
create policy "Public can read members"
on public.members for select
using (true);

drop policy if exists "No public read employee accounts" on public.employee_accounts;
create policy "No public read employee accounts"
on public.employee_accounts for select
using (false);

drop policy if exists "Public can read leader plans" on public.leader_plans;
create policy "Public can read leader plans"
on public.leader_plans for select
using (true);

drop policy if exists "Public can read member plans" on public.member_plans;
create policy "Public can read member plans"
on public.member_plans for select
using (true);

drop policy if exists "Public can insert member plans" on public.member_plans;
create policy "Public can insert member plans"
on public.member_plans for insert
with check (true);

drop policy if exists "Public can update member plans" on public.member_plans;
create policy "Public can update member plans"
on public.member_plans for update
using (true)
with check (true);

drop policy if exists "Public can delete member plans" on public.member_plans;
create policy "Public can delete member plans"
on public.member_plans for delete
using (true);

drop policy if exists "Public can read checkins" on public.checkins;
create policy "Public can read checkins"
on public.checkins for select
using (true);

drop policy if exists "Public can insert checkins" on public.checkins;
create policy "Public can insert checkins"
on public.checkins for insert
with check (true);

drop policy if exists "Public can read point awards" on public.point_awards;
create policy "Public can read point awards"
on public.point_awards for select
using (true);

create or replace function public.is_leader(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_settings
    where key = 'leader_code'
      and value = coalesce(p_code, '')
  );
$$;

create or replace function public.employee_register(
  p_name text,
  p_username text,
  p_password text,
  p_invite_code text
)
returns table(id bigint, name text, username text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id bigint;
  v_username text := lower(trim(p_username));
  v_inserted boolean := false;
begin
  if trim(coalesce(p_invite_code, '')) <> (
    select value from public.app_settings where key = 'invite_code'
  ) then
    raise exception '邀请码不正确';
  end if;

  if length(trim(coalesce(p_name, ''))) < 1 then
    raise exception '姓名不能为空';
  end if;
  if length(v_username) < 3 then
    raise exception '账户名至少 3 位';
  end if;
  if length(coalesce(p_password, '')) < 4 then
    raise exception '密码至少 4 位';
  end if;

  if exists (select 1 from public.employee_accounts where username = v_username) then
    raise exception '账户名已存在';
  end if;

  insert into public.members (name, username)
  values (trim(p_name), v_username)
  on conflict (name) do update
    set username = coalesce(public.members.username, excluded.username)
  returning public.members.id into v_member_id;

  insert into public.employee_accounts (member_id, username, password_hash)
  values (v_member_id, v_username, crypt(p_password, gen_salt('bf')))
  returning true into v_inserted;

  return query
  select m.id, m.name, coalesce(m.username, v_username)
  from public.members m
  where m.id = v_member_id;
end;
$$;

create or replace function public.employee_login(p_username text, p_password text)
returns table(id bigint, name text, username text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select m.id, m.name, a.username
  from public.employee_accounts a
  join public.members m on m.id = a.member_id
  where a.username = lower(trim(p_username))
    and a.password_hash = crypt(p_password, a.password_hash);

  if not found then
    raise exception '账户名或密码不正确';
  end if;
end;
$$;

create or replace function public.leader_create_plan(
  p_code text,
  p_week text,
  p_title text,
  p_details text
)
returns public.leader_plans
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.leader_plans;
begin
  if not public.is_leader(p_code) then
    raise exception 'leader 密码不正确';
  end if;

  insert into public.leader_plans (week, title, details)
  values (trim(p_week), trim(p_title), trim(p_details))
  returning * into result;

  return result;
end;
$$;

create or replace function public.leader_award_points(
  p_code text,
  p_member_id bigint,
  p_points integer,
  p_reason text
)
returns public.point_awards
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.point_awards;
begin
  if not public.is_leader(p_code) then
    raise exception 'leader 密码不正确';
  end if;
  if coalesce(p_points, 0) <= 0 then
    raise exception '奖励积分必须大于 0';
  end if;

  insert into public.point_awards (member_id, points, reason)
  values (p_member_id, p_points, coalesce(trim(p_reason), 'Leader 奖励'))
  returning * into result;

  return result;
end;
$$;

create or replace function public.leader_delete_member(p_code text, p_member_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_leader(p_code) then
    raise exception 'leader 密码不正确';
  end if;

  delete from public.members where id = p_member_id;
end;
$$;
