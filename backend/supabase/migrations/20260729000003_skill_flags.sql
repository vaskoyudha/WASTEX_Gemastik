create table if not exists skill_flags (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id) on delete cascade,
  user_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (skill_id, user_id)
);

alter table skill_flags enable row level security;

create policy "skill_flags_owner_insert" on skill_flags
  for insert with check (auth.uid() = user_id);
