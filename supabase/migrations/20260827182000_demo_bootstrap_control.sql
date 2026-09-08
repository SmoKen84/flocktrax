-- Demo-only fresh-project bootstrap.
-- The hosted schema baseline is schema-only, while later release migrations
-- expect the mobile control row to exist. Do not copy production data here.
insert into platform.control ("group", version, build, released, build_label)
values ('mobile_ios', '1.0.7', 20, '2026-08-29', null)
on conflict do nothing;
