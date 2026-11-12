-- Storage buckets.
--  product-media     public   product photos (admin upload)
--  site-assets       public   logo, favicon, hero and category images
--  customer-uploads  PRIVATE  customization references; served only via short-lived signed URLs

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-media', 'product-media', true, 10485760, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('site-assets', 'site-assets', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml','image/x-icon']),
  ('customer-uploads', 'customer-uploads', false, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "public read product media" on storage.objects for select using (bucket_id = 'product-media');
create policy "staff write product media" on storage.objects for insert with check (bucket_id = 'product-media' and public.has_permission('products.manage'));
create policy "staff update product media" on storage.objects for update using (bucket_id = 'product-media' and public.has_permission('products.manage'));
create policy "staff delete product media" on storage.objects for delete using (bucket_id = 'product-media' and public.has_permission('products.manage'));

create policy "public read site assets" on storage.objects for select using (bucket_id = 'site-assets');
create policy "staff write site assets" on storage.objects for insert with check (bucket_id = 'site-assets' and public.has_permission('content.manage'));
create policy "staff update site assets" on storage.objects for update using (bucket_id = 'site-assets' and public.has_permission('content.manage'));

-- Customer uploads are written by the server (service role) under
-- <user_id or 'guest'>/<uuid>.<ext>. Signed-in customers can read their own
-- folder; staff with orders.view can read all. No public access.
create policy "owner read own uploads" on storage.objects for select using (
  bucket_id = 'customer-uploads' and (
    (storage.foldername(name))[1] = auth.uid()::text or public.has_permission('orders.view')));
