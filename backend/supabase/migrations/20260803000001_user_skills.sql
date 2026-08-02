-- User-submitted skill lifecycle (spec 2026-08-03)
alter table skills add column if not exists description text not null default '';
alter table skills add column if not exists created_by uuid references auth.users(id);

alter table skills drop constraint if exists skills_status_check;
alter table skills add constraint skills_status_check
  check (status in ('draft','pending','approved','rejected','needs_revision'));

alter table skills drop constraint if exists skills_origin_check;
alter table skills add constraint skills_origin_check
  check (origin in ('seed','discovered','user'));

create index if not exists skills_created_by_idx on skills (created_by);

alter table profiles add column if not exists role text not null default 'user';
