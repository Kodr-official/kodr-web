-- Migration: create courses and course_enrollments
-- Created at: 2025-08-21 14:28:49 IST

-- 1) Courses table
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

-- 2) Course enrollments table
create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (course_id, user_id)
);

-- 3) Enable RLS
alter table if exists public.courses enable row level security;
alter table if exists public.course_enrollments enable row level security;

-- 4) RLS policies
-- Anyone authenticated can view courses
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'courses'
      and policyname = 'courses_select_all_authenticated'
  ) then
    create policy "courses_select_all_authenticated"
    on public.courses
    for select
    to authenticated
    using (true);
  end if;
end $$;

-- 5) Seed a default course if none exists
do $$
begin
  if not exists (select 1 from public.courses) then
    insert into public.courses (title, description)
    values ('Python Dev', 'Learn Python development fundamentals and build real projects.');
  end if;
end $$;

-- Enrollments: users can insert/select their own
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_enrollments'
      and policyname = 'enrollments_insert_own'
  ) then
    create policy "enrollments_insert_own"
    on public.course_enrollments
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_enrollments'
      and policyname = 'enrollments_select_own'
  ) then
    create policy "enrollments_select_own"
    on public.course_enrollments
    for select
    to authenticated
    using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'course_enrollments'
      and policyname = 'enrollments_delete_own'
  ) then
    create policy "enrollments_delete_own"
    on public.course_enrollments
    for delete
    to authenticated
    using (auth.uid() = user_id);
  end if;
end $$;
