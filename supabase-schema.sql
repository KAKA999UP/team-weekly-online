create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

insert into public.app_settings (key, value)
values ('leader_code', '123456')
on conflict (key) do nothing;

create table if not exists public.members (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.members
  add column if not exists username text unique;

alter table public.members
  add column if not exists avatar_data text;

alter table public.members
  add column if not exists bg_color text default '#f6f7fb';

create table if not exists public.employee_accounts (
  id bigserial primary key,
  member_id bigint not null unique references public.members(id) on delete cascade,
  username text not null unique,
  password_hash text not null,
  password_plain text not null default '',
  created_at timestamptz not null default now()
);

alter table public.employee_accounts
  add column if not exists password_plain text not null default '';

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
  note text not null default '',
  points integer not null default 0,
  created_at timestamptz not null default now(),
  unique(member_id, leader_plan_id)
);

create table if not exists public.dedicated_tasks (
  id bigserial primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  week text not null,
  title text not null,
  details text not null default '',
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.point_awards (
  id bigserial primary key,
  member_id bigint not null references public.members(id) on delete cascade,
  points integer not null,
  reason text not null default '',
  created_at timestamptz not null default now()
);

alter table public.point_awards
  drop constraint if exists point_awards_points_check;

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
alter table public.dedicated_tasks enable row level security;
alter table public.point_awards enable row level security;

drop policy if exists "Public can read members" on public.members;
create policy "Public can read members"
on public.members for select
using (true);

drop policy if exists "Public can update member profile" on public.members;
create policy "Public can update member profile"
on public.members for update
using (true)
with check (true);

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

drop policy if exists "Public can read dedicated tasks" on public.dedicated_tasks;
create policy "Public can read dedicated tasks"
on public.dedicated_tasks for select
using (true);

drop policy if exists "Public can update dedicated tasks" on public.dedicated_tasks;
create policy "Public can update dedicated tasks"
on public.dedicated_tasks for update
using (true)
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

create or replace function public.employee_login(p_username text, p_password text)
returns table(id bigint, name text, username text, avatar_data text, bg_color text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select m.id, m.name, a.username, m.avatar_data, m.bg_color
  from public.employee_accounts a
  join public.members m on m.id = a.member_id
  where a.username = lower(trim(p_username))
    and a.password_hash = crypt(p_password, a.password_hash);

  if not found then
    raise exception '账户名或密码不正确';
  end if;
end;
$$;

create or replace function public.employee_change_password(
  p_member_id bigint,
  p_old_password text,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception '新密码至少 4 位';
  end if;

  update public.employee_accounts
  set password_hash = crypt(p_new_password, gen_salt('bf')),
      password_plain = p_new_password
  where member_id = p_member_id
    and password_hash = crypt(p_old_password, password_hash);

  if not found then
    raise exception '原密码不正确';
  end if;
end;
$$;

create or replace function public.leader_accounts(p_code text)
returns table(member_id bigint, name text, username text, password_plain text, avatar_data text, bg_color text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_leader(p_code) then
    raise exception 'leader 密码不正确';
  end if;

  return query
  select m.id, m.name, a.username, a.password_plain, m.avatar_data, m.bg_color
  from public.members m
  left join public.employee_accounts a on a.member_id = m.id
  order by m.name;
end;
$$;

create or replace function public.leader_create_member_account(
  p_code text,
  p_name text,
  p_username text,
  p_password text
)
returns table(member_id bigint, name text, username text, password_plain text, avatar_data text, bg_color text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id bigint;
  v_username text := lower(trim(p_username));
begin
  if not public.is_leader(p_code) then
    raise exception 'leader 密码不正确';
  end if;
  if length(trim(coalesce(p_name, ''))) < 1 then
    raise exception '员工姓名不能为空';
  end if;
  if length(v_username) < 3 then
    raise exception '账户名至少 3 位';
  end if;
  if length(coalesce(p_password, '')) < 4 then
    raise exception '密码至少 4 位';
  end if;

  insert into public.members (name, username)
  values (trim(p_name), v_username)
  on conflict (name) do update set username = excluded.username
  returning public.members.id into v_member_id;

  insert into public.employee_accounts (member_id, username, password_hash, password_plain)
  values (v_member_id, v_username, crypt(p_password, gen_salt('bf')), p_password)
  on conflict (member_id) do update
    set username = excluded.username,
        password_hash = excluded.password_hash,
        password_plain = excluded.password_plain;

  return query
  select m.id, m.name, a.username, a.password_plain, m.avatar_data, m.bg_color
  from public.members m
  join public.employee_accounts a on a.member_id = m.id
  where m.id = v_member_id;
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

create or replace function public.leader_create_dedicated_task(
  p_code text,
  p_member_id bigint,
  p_week text,
  p_title text,
  p_details text
)
returns public.dedicated_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.dedicated_tasks;
begin
  if not public.is_leader(p_code) then
    raise exception 'leader 密码不正确';
  end if;

  insert into public.dedicated_tasks (member_id, week, title, details)
  values (p_member_id, trim(p_week), trim(p_title), coalesce(trim(p_details), ''))
  returning * into result;

  return result;
end;
$$;

create or replace function public.leader_adjust_points(
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
  if coalesce(p_points, 0) = 0 then
    raise exception '调整积分不能为 0';
  end if;

  insert into public.point_awards (member_id, points, reason)
  values (p_member_id, p_points, coalesce(trim(p_reason), 'Leader 调整'))
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
