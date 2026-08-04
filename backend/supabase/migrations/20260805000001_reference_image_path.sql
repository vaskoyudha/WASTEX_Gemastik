alter table skills add column if not exists reference_image_path text;

alter table generated_visuals add column if not exists reference_image_path text;
