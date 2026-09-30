# AV Muslim School — Netlify + Supabase setup

This version no longer uses `api.php`, PHP sessions, or MySQL. Netlify serves the static website and Supabase provides the database and authentication.

## 1. Create the Supabase project
Create a project at https://supabase.com/dashboard.

## 2. Create the database
Open **SQL Editor**, paste the complete contents of `supabase-existing-schema.sql`, and run it.

## 3. Create the administrator
In Supabase open **Authentication -> Users -> Add user** and create an administrator account with an email and password.

Then open SQL Editor and replace `YOUR-USER-UUID` with the UUID shown for that user:

```sql
insert into public.profiles(id, display_name, role)
values ('YOUR-USER-UUID', 'School Administrator', 'admin')
on conflict (id) do update set role='admin', display_name='School Administrator';
```

## 4. Add the Supabase browser credentials
Open `supabase-config.js` and replace:

- `PASTE_YOUR_SUPABASE_PROJECT_URL_HERE` with your Supabase Project URL.
- `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with the Supabase Publishable key.

Use the publishable/anon key only. **Never put a secret/service-role key in this file.**

## 5. Deploy to Netlify
Push this folder to GitHub, then in Netlify choose **Add new project -> Import an existing project -> GitHub** and select the repository.

Build command: leave empty.
Publish directory: `.`

## 6. Test
Open your Netlify URL:

- Public admission form should save to `admissions`.
- `/admin.html` should show the Supabase login.
- Administrator can manage students, teachers, classes, sections, exams, marks and admissions.
- Public results only show published examinations.

## Important
`api.php` is no longer used by the website and is not required on Netlify. The old MySQL `config.php`/PHP setup can be removed after you have confirmed the Supabase version works.
