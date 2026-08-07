-- generated_visuals.kind: allow 'materials' panel
-- Kode (app/api/visuals.py) memakai kind 'materials' sejak awal, tapi constraint
-- tabel tidak mengizinkannya — insert materials selalu gagal 23514. Perbaiki agar
-- konsisten dengan Literal["storyboard", "materials", "before_after", "mockup"].
alter table generated_visuals drop constraint if exists generated_visuals_kind_check;
alter table generated_visuals add constraint generated_visuals_kind_check
  check (kind in ('storyboard', 'materials', 'before_after', 'mockup'));
