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

insert into public.leader_plans (week, title, details)
select to_char(now(), 'IYYY-"W"IW'), '本周团队计划',
       '1. 明确本周关键目标
2. 每位成员提交自己的本周计划
3. 周中至少打卡一次进度
4. 周五前同步完成情况'
where not exists (select 1 from public.leader_plans);

alter table public.app_settings enable row level security;
alter table public.members enable row level security;
alter table public.leader_plans enable row level security;
alter table public.member_plans enable row level security;
alter table public.checkins enable row level security;

drop policy if exists "Public can read members" on public.members;
create policy "Public can read members"
on public.members for select
using (true);

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

create or replace function public.leader_add_member(p_code text, p_name text)
returns public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.members;
begin
  if not public.is_leader(p_code) then
    raise exception 'leader 密码不正确';
  end if;

  insert into public.members (name)
  values (trim(p_name))
  on conflict (name) do update set name = excluded.name
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
