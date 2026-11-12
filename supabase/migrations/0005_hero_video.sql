-- Public bucket for the homepage hero background video.
-- 50 MB matches the Supabase free-plan per-file upload limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('site-videos', 'site-videos', true, 52428800, array['video/mp4','video/webm'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read site videos" on storage.objects;
drop policy if exists "staff write site videos" on storage.objects;
drop policy if exists "staff update site videos" on storage.objects;
drop policy if exists "staff delete site videos" on storage.objects;
create policy "public read site videos" on storage.objects for select using (bucket_id = 'site-videos');
create policy "staff write site videos" on storage.objects for insert with check (bucket_id = 'site-videos' and public.has_permission('content.manage'));
create policy "staff update site videos" on storage.objects for update using (bucket_id = 'site-videos' and public.has_permission('content.manage'));
create policy "staff delete site videos" on storage.objects for delete using (bucket_id = 'site-videos' and public.has_permission('content.manage'));
