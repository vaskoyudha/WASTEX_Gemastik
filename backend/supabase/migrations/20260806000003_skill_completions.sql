create table if not exists skill_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_id uuid not null references skills(id) on delete cascade,
  photo_path text not null,
  rating int not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (skill_id, user_id)
);

create index if not exists skill_completions_skill_idx on skill_completions (skill_id);

alter table skill_completions enable row level security;

create policy "completions_public_read" on skill_completions
  for select using (true);

create policy "completions_owner_insert" on skill_completions
  for insert with check (auth.uid() = user_id);

create policy "completions_owner_delete" on skill_completions
  for delete using (auth.uid() = user_id);
