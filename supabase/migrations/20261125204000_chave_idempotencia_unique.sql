-- O índice parcial não serve para ON CONFLICT (upsert). NULLs já são distintos numa unique comum.
drop index public.sync_jobs_chave_idempotencia_idx;
alter table public.sync_jobs add constraint sync_jobs_chave_idempotencia_key unique (chave_idempotencia);
