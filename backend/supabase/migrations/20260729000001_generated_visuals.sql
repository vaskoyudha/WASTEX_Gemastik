create table if not exists generated_visuals (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references skills(id) on delete cascade,
  kind text not null check (kind in ('storyboard', 'before_after', 'mockup')),
  step_order int,
  image_path text not null,
  prompt text,
  created_at timestamptz not null default now(),
  unique (skill_id, kind, step_order)
);

alter table generated_visuals enable row level security;

create policy "generated_visuals_read_all" on generated_visuals
  for select using (true);

insert into storage.buckets (id, name, public)
values ('visuals', 'visuals', true)
on conflict (id) do nothing;
