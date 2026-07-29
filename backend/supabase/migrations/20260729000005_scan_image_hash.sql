alter table scans add column if not exists image_hash text;
create index if not exists scans_image_hash_idx on scans (image_hash);
