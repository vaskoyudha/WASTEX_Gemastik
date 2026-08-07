-- Satu pengguna dapat membuat produk yang sama lebih dari sekali. Setiap hasil
-- menjadi proyek/review terpisah dan memiliki aset promosi sendiri.
alter table skill_completions
  drop constraint if exists skill_completions_skill_id_user_id_key;

alter table skill_completions
  add column if not exists promo_image_path text,
  add column if not exists selling_kit jsonb;

create index if not exists skill_completions_user_skill_idx
  on skill_completions (user_id, skill_id, created_at desc);
