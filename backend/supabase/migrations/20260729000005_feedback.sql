create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  agent_run_id uuid references agent_runs(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  flag_inaccurate boolean not null default false,
  comment text,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;
