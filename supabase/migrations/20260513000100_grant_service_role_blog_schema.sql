-- Grant service_role access to the blog schema so the admin client can insert posts
grant usage on schema blog to service_role;
grant all on all tables in schema blog to service_role;
grant all on all sequences in schema blog to service_role;

-- Ensure future tables are also covered
alter default privileges in schema blog grant all on tables to service_role;
alter default privileges in schema blog grant all on sequences to service_role;
