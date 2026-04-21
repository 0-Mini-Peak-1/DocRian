-- Set up Storage for Profile Avatars
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- Allow public access to view avatars
create policy "Avatars are publicly accessible." 
on storage.objects for select 
using (bucket_id = 'avatars');

-- Allow users to upload their own avatar
create policy "Users can upload their own avatar." 
on storage.objects for insert 
with check (bucket_id = 'avatars' and auth.uid() = owner);

-- Allow users to update their own avatar
create policy "Users can update their own avatar." 
on storage.objects for update 
using (bucket_id = 'avatars' and auth.uid() = owner);

-- Allow users to delete their own avatar
create policy "Users can delete their own avatar." 
on storage.objects for delete 
using (bucket_id = 'avatars' and auth.uid() = owner);
