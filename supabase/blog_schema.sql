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
  investment_eur integer,
  investment_confidence smallint,
  investment_thesis text,
  investment_model text,
  investment_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table blog.posts
add column if not exists investment_eur integer;

alter table blog.posts
add column if not exists investment_confidence smallint;

alter table blog.posts
add column if not exists investment_thesis text;

alter table blog.posts
add column if not exists investment_model text;

alter table blog.posts
add column if not exists investment_created_at timestamptz;

alter table blog.posts
drop constraint if exists posts_investment_non_negative;

alter table blog.posts
add constraint posts_investment_non_negative
check (investment_eur is null or investment_eur >= 0);

alter table blog.posts
drop constraint if exists posts_investment_confidence_range;

alter table blog.posts
add constraint posts_investment_confidence_range
check (investment_confidence is null or investment_confidence between 1 and 100);

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

create table if not exists blog.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  device_label text,
  user_agent text,
  enabled boolean not null default true,
  last_seen timestamptz not null default now(),
  last_push_sent_at timestamptz,
  failure_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists blog.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references blog.notifications (id) on delete cascade,
  subscription_id uuid not null references blog.push_subscriptions (id) on delete cascade,
  status text not null check (status in ('sent', 'failed', 'invalid')),
  response_code integer,
  error_message text,
  created_at timestamptz not null default now(),
  unique (notification_id, subscription_id)
);

create table if not exists blog.post_investments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references blog.posts (id) on delete cascade,
  investor_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, investor_id)
);

create table if not exists blog.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  summary text not null check (char_length(summary) between 1 and 50000),
  summary_format text not null default 'richtext' check (summary_format in ('markdown', 'richtext')),
  status text not null default 'idea' check (status in ('idea', 'concept', 'validation', 'building', 'launched', 'archived')),
  image_url text,
  website_url text,
  github_repo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table blog.projects
add column if not exists image_url text;

alter table blog.projects
add column if not exists summary_format text;

update blog.projects
set summary_format = coalesce(summary_format, 'richtext');

alter table blog.projects
alter column summary_format set default 'richtext';

alter table blog.projects
alter column summary_format set not null;

alter table blog.projects
drop constraint if exists projects_summary_format_check;

alter table blog.projects
add constraint projects_summary_format_check
check (summary_format in ('markdown', 'richtext'));

alter table blog.projects
drop constraint if exists projects_summary_check;

alter table blog.projects
add constraint projects_summary_check
check (char_length(summary) between 1 and 50000);

create table if not exists blog.project_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references blog.projects (id) on delete cascade,
  post_id uuid not null references blog.posts (id) on delete cascade,
  linked_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, post_id)
);

create table if not exists blog.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references blog.projects (id) on delete cascade,
  from_status text,
  to_status text not null check (to_status in ('idea', 'concept', 'validation', 'building', 'launched', 'archived')),
  rationale text,
  changed_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists blog.project_edit_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references blog.projects (id) on delete cascade,
  edited_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  changed_fields text[] not null,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on blog.projects to authenticated;
grant select, insert, update, delete on blog.project_posts to authenticated;
grant select, insert, update, delete on blog.project_status_history to authenticated;
grant select, insert on blog.project_edit_history to authenticated;

grant select, insert, update, delete on blog.notifications to authenticated;
grant select, insert, update, delete on blog.push_subscriptions to authenticated;

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

create index if not exists idx_push_subscriptions_user_enabled
on blog.push_subscriptions (user_id, enabled);

create index if not exists idx_push_subscriptions_last_seen
on blog.push_subscriptions (last_seen desc);

create index if not exists idx_notification_push_deliveries_notification
on blog.notification_push_deliveries (notification_id);

create index if not exists idx_notification_push_deliveries_subscription
on blog.notification_push_deliveries (subscription_id);

create index if not exists idx_post_investments_post_id
on blog.post_investments (post_id);

create index if not exists idx_post_investments_investor_id
on blog.post_investments (investor_id);

create index if not exists idx_projects_owner_created_at
on blog.projects (owner_user_id, created_at desc);

create index if not exists idx_projects_status
on blog.projects (status);

create index if not exists idx_project_posts_project_id
on blog.project_posts (project_id);

create index if not exists idx_project_posts_post_id
on blog.project_posts (post_id);

create index if not exists idx_project_status_history_project_created_at
on blog.project_status_history (project_id, created_at desc);

create index if not exists idx_project_edit_history_project_created_at
on blog.project_edit_history (project_id, created_at desc);

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

drop trigger if exists trg_post_investments_updated_at on blog.post_investments;
create trigger trg_post_investments_updated_at
before update on blog.post_investments
for each row
execute procedure blog.set_updated_at();

drop trigger if exists trg_projects_updated_at on blog.projects;
create trigger trg_projects_updated_at
before update on blog.projects
for each row
execute procedure blog.set_updated_at();

drop trigger if exists trg_push_subscriptions_updated_at on blog.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on blog.push_subscriptions
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
alter table blog.post_investments enable row level security;
alter table blog.projects enable row level security;
alter table blog.project_posts enable row level security;
alter table blog.project_status_history enable row level security;
alter table blog.project_edit_history enable row level security;
alter table blog.push_subscriptions enable row level security;
alter table blog.notification_push_deliveries enable row level security;

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

drop policy if exists push_subscriptions_select_own on blog.push_subscriptions;
create policy push_subscriptions_select_own
on blog.push_subscriptions
for select
using (blog.is_allowed_user() and auth.uid() = user_id);

drop policy if exists push_subscriptions_insert_own on blog.push_subscriptions;
create policy push_subscriptions_insert_own
on blog.push_subscriptions
for insert
with check (blog.is_allowed_user() and auth.uid() = user_id);

drop policy if exists push_subscriptions_update_own on blog.push_subscriptions;
create policy push_subscriptions_update_own
on blog.push_subscriptions
for update
using (blog.is_allowed_user() and auth.uid() = user_id)
with check (blog.is_allowed_user() and auth.uid() = user_id);

drop policy if exists push_subscriptions_delete_own on blog.push_subscriptions;
create policy push_subscriptions_delete_own
on blog.push_subscriptions
for delete
using (blog.is_allowed_user() and auth.uid() = user_id);

drop policy if exists post_investments_select_internal on blog.post_investments;
create policy post_investments_select_internal
on blog.post_investments
for select
using (blog.is_allowed_user());

drop policy if exists post_investments_insert_own on blog.post_investments;
create policy post_investments_insert_own
on blog.post_investments
for insert
with check (blog.is_allowed_user() and auth.uid() = investor_id);

drop policy if exists post_investments_update_own on blog.post_investments;
create policy post_investments_update_own
on blog.post_investments
for update
using (blog.is_allowed_user() and auth.uid() = investor_id)
with check (blog.is_allowed_user() and auth.uid() = investor_id);

drop policy if exists projects_select_internal on blog.projects;
create policy projects_select_internal
on blog.projects
for select
using (blog.is_allowed_user());

drop policy if exists projects_insert_own on blog.projects;
create policy projects_insert_own
on blog.projects
for insert
with check (blog.is_allowed_user() and auth.uid() = owner_user_id);

drop policy if exists projects_update_own on blog.projects;
create policy projects_update_own
on blog.projects
for update
using (blog.is_allowed_user() and auth.uid() = owner_user_id)
with check (blog.is_allowed_user() and auth.uid() = owner_user_id);

drop policy if exists projects_delete_own on blog.projects;
create policy projects_delete_own
on blog.projects
for delete
using (blog.is_allowed_user() and auth.uid() = owner_user_id);

drop policy if exists project_posts_select_internal on blog.project_posts;
create policy project_posts_select_internal
on blog.project_posts
for select
using (blog.is_allowed_user());

drop policy if exists project_posts_insert_owner on blog.project_posts;
create policy project_posts_insert_owner
on blog.project_posts
for insert
with check (
  blog.is_allowed_user()
  and auth.uid() = linked_by
  and exists (
    select 1
    from blog.projects p
    where p.id = project_id and p.owner_user_id = auth.uid()
  )
);

drop policy if exists project_posts_delete_owner on blog.project_posts;
create policy project_posts_delete_owner
on blog.project_posts
for delete
using (
  blog.is_allowed_user()
  and exists (
    select 1
    from blog.projects p
    where p.id = project_id and p.owner_user_id = auth.uid()
  )
);

drop policy if exists project_status_history_select_internal on blog.project_status_history;
create policy project_status_history_select_internal
on blog.project_status_history
for select
using (blog.is_allowed_user());

drop policy if exists project_status_history_insert_owner on blog.project_status_history;
create policy project_status_history_insert_owner
on blog.project_status_history
for insert
with check (
  blog.is_allowed_user()
  and auth.uid() = changed_by
  and exists (
    select 1
    from blog.projects p
    where p.id = project_id and p.owner_user_id = auth.uid()
  )
);

drop policy if exists project_edit_history_select_internal on blog.project_edit_history;
create policy project_edit_history_select_internal
on blog.project_edit_history
for select
using (blog.is_allowed_user());

drop policy if exists project_edit_history_insert_owner on blog.project_edit_history;
create policy project_edit_history_insert_owner
on blog.project_edit_history
for insert
with check (
  blog.is_allowed_user()
  and auth.uid() = edited_by
  and exists (
    select 1
    from blog.projects p
    where p.id = project_id and p.owner_user_id = auth.uid()
  )
);

create or replace function blog.invest_in_post(target_post_id uuid, investment_amount integer)
returns table(status text, detail text)
language plpgsql
security invoker
as $$
declare
  current_user_id uuid := auth.uid();
  target_author_id uuid;
  total_angel_received integer := 0;
  total_community_received integer := 0;
  total_spent integer := 0;
  total_available integer := 0;
begin
  if not blog.is_allowed_user() or current_user_id is null then
    return query select 'not_allowed'::text, 'Authentication required'::text;
    return;
  end if;

  if investment_amount is null or investment_amount <= 0 then
    return query select 'invalid_amount'::text, 'Investment amount must be positive'::text;
    return;
  end if;

  select author_id into target_author_id
  from blog.posts
  where id = target_post_id;

  if target_author_id is null then
    return query select 'post_not_found'::text, 'Post not found'::text;
    return;
  end if;

  if target_author_id = current_user_id then
    return query select 'own_post'::text, 'You cannot invest in your own post'::text;
    return;
  end if;

  select coalesce(sum(investment_eur), 0) into total_angel_received
  from blog.posts
  where author_id = current_user_id;

  select coalesce(sum(pi.amount), 0) into total_community_received
  from blog.post_investments pi
  join blog.posts p on p.id = pi.post_id
  where p.author_id = current_user_id;

  select coalesce(sum(amount), 0) into total_spent
  from blog.post_investments
  where investor_id = current_user_id;

  total_available := total_angel_received + total_community_received - total_spent;

  if investment_amount > total_available then
    return query select 'insufficient_funds'::text, total_available::text;
    return;
  end if;

  insert into blog.post_investments (post_id, investor_id, amount)
  values (target_post_id, current_user_id, investment_amount)
  on conflict (post_id, investor_id)
  do update set
    amount = blog.post_investments.amount + excluded.amount,
    updated_at = now();

  return query select 'invested'::text, null::text;
end;
$$;

grant execute on function blog.invest_in_post(uuid, integer) to authenticated;

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
