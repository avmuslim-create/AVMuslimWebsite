-- AV Muslim Website: security/setup migration for the EXISTING tables.
-- Do NOT recreate your existing tables.
-- Run this in Supabase SQL Editor.

-- 1) Link each Supabase Auth user to a row in your existing admins table.
alter table public.admins
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;

-- 2) Helper used by RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.admins
    where auth_user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- 3) Enable RLS on every application table.
alter table public.admins enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.subjects enable row level security;
alter table public.exams enable row level security;
alter table public.results enable row level security;
alter table public.result_subjects enable row level security;
alter table public.school_content enable row level security;
alter table public.school_stories enable row level security;
alter table public.admissions enable row level security;

-- 4) Remove policies from an earlier setup if they exist.
drop policy if exists "admins_read_own" on public.admins;
drop policy if exists "classes_public_read" on public.classes;
drop policy if exists "classes_admin_write" on public.classes;
drop policy if exists "sections_public_read" on public.sections;
drop policy if exists "sections_admin_write" on public.sections;
drop policy if exists "students_public_read" on public.students;
drop policy if exists "students_admin_all" on public.students;
drop policy if exists "teachers_public_read" on public.teachers;
drop policy if exists "teachers_admin_all" on public.teachers;
drop policy if exists "subjects_public_read" on public.subjects;
drop policy if exists "subjects_admin_all" on public.subjects;
drop policy if exists "exams_public_read" on public.exams;
drop policy if exists "exams_admin_all" on public.exams;
drop policy if exists "results_public_read" on public.results;
drop policy if exists "results_admin_all" on public.results;
drop policy if exists "result_subjects_public_read" on public.result_subjects;
drop policy if exists "result_subjects_admin_all" on public.result_subjects;
drop policy if exists "content_public_read" on public.school_content;
drop policy if exists "content_admin_all" on public.school_content;
drop policy if exists "stories_public_read" on public.school_stories;
drop policy if exists "stories_admin_all" on public.school_stories;
drop policy if exists "admissions_public_insert" on public.admissions;
drop policy if exists "admissions_admin_all" on public.admissions;

-- Admin can see its own admin record.
create policy "admins_read_own" on public.admins
for select to authenticated using (auth_user_id = auth.uid());

-- Public website data.
create policy "classes_public_read" on public.classes for select to anon, authenticated using (true);
create policy "sections_public_read" on public.sections for select to anon, authenticated using (true);
create policy "teachers_public_read" on public.teachers for select to anon, authenticated using (status = 'active');
create policy "school_content_public_read" on public.school_content for select to anon, authenticated using (true);
create policy "school_stories_public_read" on public.school_stories for select to anon, authenticated using (true);

-- Public result lookup needs active students and published exams/results.
create policy "students_public_read" on public.students for select to anon, authenticated using (status = 'active');
create policy "exams_public_read" on public.exams for select to anon, authenticated using (is_published = true);
create policy "results_public_read" on public.results for select to anon, authenticated using (
  exists (select 1 from public.exams e where e.id = results.exam_id and e.is_published = true)
);
create policy "result_subjects_public_read" on public.result_subjects for select to anon, authenticated using (
  exists (
    select 1 from public.results r
    join public.exams e on e.id = r.exam_id
    where r.id = result_subjects.result_id and e.is_published = true
  )
);
create policy "subjects_public_read" on public.subjects for select to anon, authenticated using (true);

-- Admin-only write/read access.
create policy "classes_admin_write" on public.classes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sections_admin_write" on public.sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "students_admin_all" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "teachers_admin_all" on public.teachers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "subjects_admin_all" on public.subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "exams_admin_all" on public.exams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "results_admin_all" on public.results for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "result_subjects_admin_all" on public.result_subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "content_admin_all" on public.school_content for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "stories_admin_all" on public.school_stories for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Admissions: anyone can submit, only an authenticated admin can read/change them.
create policy "admissions_public_insert" on public.admissions
for insert to anon, authenticated with check (true);
create policy "admissions_admin_all" on public.admissions
for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5) Recommended indexes for the website.
create index if not exists idx_students_roll_no on public.students(roll_no);
create index if not exists idx_students_section_id on public.students(section_id);
create index if not exists idx_sections_class_id on public.sections(class_id);
create index if not exists idx_results_student_exam on public.results(student_id, exam_id);
create index if not exists idx_result_subjects_result_id on public.result_subjects(result_id);

-- 6) IMPORTANT: after creating an Auth user, link it to the existing admin row.
-- Replace BOTH values below with your real values, then run it.
-- update public.admins
-- set auth_user_id = 'YOUR-AUTH-USER-UUID'
-- where username = 'YOUR-ADMIN-USERNAME';
