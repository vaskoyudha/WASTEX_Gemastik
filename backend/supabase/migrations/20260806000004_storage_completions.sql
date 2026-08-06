insert into storage.buckets (id, name, public)
values ('completions', 'completions', true)
on conflict (id) do nothing;
