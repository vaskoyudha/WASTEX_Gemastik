create table if not exists impact_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  skill_id uuid references skills(id) on delete set null,
  material text not null check (material in ('plastik_pet','plastik_hdpe','kardus','kaleng','kaca','sachet')),
  waste_kg numeric not null default 0,
  est_value_idr int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists impact_events_user_idx on impact_events (user_id);

alter table impact_events enable row level security;

create policy "impact_events_owner_read" on impact_events
  for select using (auth.uid() = user_id);
