alter table skills add column if not exists additional_materials jsonb not null default '[]';
alter table skills add column if not exists additional_materials_cost_idr int not null default 0;
