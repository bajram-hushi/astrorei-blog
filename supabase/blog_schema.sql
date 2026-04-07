create schema if not exists blog;

grant usage on schema blog to anon, authenticated;

create extension if not exists pgcrypto;

create or replace function blog.is_allowed_user()
returns boolean
language sql
stable
as $$
  select
    auth.role() = 'authenticated'
    and (
      coalesce(auth.jwt() ->> 'email', '') ilike '%@astrorei.io'
      or coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
    );
$$;

create table if not exists blog.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_email text not null default coalesce(auth.jwt() ->> 'email', 'unknown'),
  title text not null check (char_length(title) between 1 and 140),
  content text not null,
  content_format text not null check (content_format in ('markdown', 'richtext')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blog.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog.posts (id) on delete cascade,
  parent_id uuid references blog.comments (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author_email text not null default coalesce(auth.jwt() ->> 'email', 'unknown'),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table blog.comments
add column if not exists parent_id uuid references blog.comments (id) on delete cascade;

create table if not exists blog.comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references blog.comments (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table if not exists blog.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('comment_on_post', 'reply_to_comment')),
  post_id uuid not null references blog.posts (id) on delete cascade,
  comment_id uuid not null references blog.comments (id) on delete cascade,
  parent_comment_id uuid references blog.comments (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint notification_no_self check (recipient_id <> actor_id)
);

grant select, insert, update, delete on blog.notifications to authenticated;

create index if not exists idx_comments_post_parent_created_at
on blog.comments (post_id, parent_id, created_at);

create index if not exists idx_comment_votes_comment_id
on blog.comment_votes (comment_id);

create index if not exists idx_comment_votes_user_id
on blog.comment_votes (user_id);

create index if not exists idx_notifications_recipient_created_at
on blog.notifications (recipient_id, created_at desc);

create index if not exists idx_notifications_post_id
on blog.notifications (post_id);

create index if not exists idx_notifications_comment_id
on blog.notifications (comment_id);

create table if not exists blog.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  username text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_len check (username is null or char_length(username) between 2 and 50)
);

grant select, insert, update, delete on all tables in schema blog to authenticated;
grant usage, select on all sequences in schema blog to authenticated;

create or replace function blog.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function blog.validate_comment_parent()
returns trigger
language plpgsql
as $$
declare
  parent_post_id uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  select post_id into parent_post_id
  from blog.comments
  where id = new.parent_id;

  if parent_post_id is null then
    raise exception 'Parent comment does not exist';
  end if;

  if parent_post_id <> new.post_id then
    raise exception 'Parent comment must belong to the same post';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_posts_updated_at on blog.posts;
create trigger trg_posts_updated_at
before update on blog.posts
for each row
execute procedure blog.set_updated_at();

drop trigger if exists trg_comment_votes_updated_at on blog.comment_votes;
create trigger trg_comment_votes_updated_at
before update on blog.comment_votes
for each row
execute procedure blog.set_updated_at();

drop trigger if exists trg_comments_validate_parent on blog.comments;
create trigger trg_comments_validate_parent
before insert or update of parent_id, post_id on blog.comments
for each row
execute procedure blog.validate_comment_parent();

alter table blog.posts enable row level security;
alter table blog.comments enable row level security;
alter table blog.profiles enable row level security;
alter table blog.comment_votes enable row level security;
alter table blog.notifications enable row level security;

drop policy if exists posts_select_internal on blog.posts;
create policy posts_select_internal
on blog.posts
for select
using (blog.is_allowed_user());

drop policy if exists posts_insert_internal on blog.posts;
create policy posts_insert_internal
on blog.posts
for insert
with check (blog.is_allowed_user() and auth.uid() = author_id);

drop policy if exists posts_update_own on blog.posts;
create policy posts_update_own
on blog.posts
for update
using (blog.is_allowed_user() and auth.uid() = author_id)
with check (blog.is_allowed_user() and auth.uid() = author_id);

drop policy if exists posts_delete_own on blog.posts;
create policy posts_delete_own
on blog.posts
for delete
using (blog.is_allowed_user() and auth.uid() = author_id);

drop policy if exists comments_select_internal on blog.comments;
create policy comments_select_internal
on blog.comments
for select
using (blog.is_allowed_user());

drop policy if exists comments_insert_internal on blog.comments;
create policy comments_insert_internal
on blog.comments
for insert
with check (blog.is_allowed_user() and auth.uid() = author_id);

drop policy if exists comments_update_own on blog.comments;
create policy comments_update_own
on blog.comments
for update
using (blog.is_allowed_user() and auth.uid() = author_id)
with check (blog.is_allowed_user() and auth.uid() = author_id);

drop policy if exists comments_delete_own on blog.comments;
create policy comments_delete_own
on blog.comments
for delete
using (blog.is_allowed_user() and auth.uid() = author_id);

drop policy if exists comment_votes_select_internal on blog.comment_votes;
create policy comment_votes_select_internal
on blog.comment_votes
for select
using (blog.is_allowed_user());

drop policy if exists comment_votes_insert_own on blog.comment_votes;
create policy comment_votes_insert_own
on blog.comment_votes
for insert
with check (blog.is_allowed_user() and auth.uid() = user_id);

drop policy if exists comment_votes_update_own on blog.comment_votes;
create policy comment_votes_update_own
on blog.comment_votes
for update
using (blog.is_allowed_user() and auth.uid() = user_id)
with check (blog.is_allowed_user() and auth.uid() = user_id);

drop policy if exists comment_votes_delete_own on blog.comment_votes;
create policy comment_votes_delete_own
on blog.comment_votes
for delete
using (blog.is_allowed_user() and auth.uid() = user_id);

drop policy if exists profiles_select_internal on blog.profiles;
create policy profiles_select_internal
on blog.profiles
for select
using (blog.is_allowed_user());

drop policy if exists profiles_insert_own on blog.profiles;
create policy profiles_insert_own
on blog.profiles
for insert
with check (blog.is_allowed_user() and auth.uid() = id);

drop policy if exists profiles_update_own on blog.profiles;
create policy profiles_update_own
on blog.profiles
for update
using (blog.is_allowed_user() and auth.uid() = id)
with check (blog.is_allowed_user() and auth.uid() = id);

drop policy if exists profiles_delete_own on blog.profiles;
create policy profiles_delete_own
on blog.profiles
for delete
using (blog.is_allowed_user() and auth.uid() = id);

drop policy if exists notifications_select_own on blog.notifications;
create policy notifications_select_own
on blog.notifications
for select
using (blog.is_allowed_user() and auth.uid() = recipient_id);

drop policy if exists notifications_insert_actor on blog.notifications;
create policy notifications_insert_actor
on blog.notifications
for insert
with check (
  blog.is_allowed_user()
  and auth.uid() = actor_id
  and recipient_id <> actor_id
);

drop policy if exists notifications_update_recipient on blog.notifications;
create policy notifications_update_recipient
on blog.notifications
for update
using (blog.is_allowed_user() and auth.uid() = recipient_id)
with check (blog.is_allowed_user() and auth.uid() = recipient_id);

drop policy if exists notifications_delete_recipient on blog.notifications;
create policy notifications_delete_recipient
on blog.notifications
for delete
using (blog.is_allowed_user() and auth.uid() = recipient_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists blog_images_public_read on storage.objects;
create policy blog_images_public_read
on storage.objects
for select
using (bucket_id = 'blog-images');

drop policy if exists blog_images_insert_authenticated on storage.objects;
create policy blog_images_insert_authenticated
on storage.objects
for insert
to authenticated
with check (bucket_id = 'blog-images' and blog.is_allowed_user());

drop policy if exists blog_images_update_owner on storage.objects;
create policy blog_images_update_owner
on storage.objects
for update
to authenticated
using (bucket_id = 'blog-images' and owner = auth.uid())
with check (bucket_id = 'blog-images' and owner = auth.uid());

drop policy if exists blog_images_delete_owner on storage.objects;
create policy blog_images_delete_owner
on storage.objects
for delete
to authenticated
using (bucket_id = 'blog-images' and owner = auth.uid());
