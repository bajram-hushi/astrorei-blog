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

create index if not exists idx_push_subscriptions_user_enabled
on blog.push_subscriptions (user_id, enabled);

create index if not exists idx_push_subscriptions_last_seen
on blog.push_subscriptions (last_seen desc);

create index if not exists idx_notification_push_deliveries_notification
on blog.notification_push_deliveries (notification_id);

create index if not exists idx_notification_push_deliveries_subscription
on blog.notification_push_deliveries (subscription_id);

grant select, insert, update, delete on blog.push_subscriptions to authenticated;
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

drop trigger if exists trg_push_subscriptions_updated_at on blog.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on blog.push_subscriptions
for each row
execute procedure blog.set_updated_at();

alter table blog.push_subscriptions enable row level security;
alter table blog.notification_push_deliveries enable row level security;

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
