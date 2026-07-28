insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;
