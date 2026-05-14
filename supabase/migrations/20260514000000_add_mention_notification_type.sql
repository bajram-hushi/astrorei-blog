-- Add mention_in_comment notification type

alter table blog.notifications
drop constraint if exists notifications_type_check;

alter table blog.notifications
add constraint notifications_type_check
check (type in ('comment_on_post', 'reply_to_comment', 'mention_in_comment'));
