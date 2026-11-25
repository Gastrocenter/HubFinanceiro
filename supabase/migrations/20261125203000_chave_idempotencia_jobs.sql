-- Issue 04: o agendamento pode ser entregue mais de uma vez; a chave impede job duplicado.
alter table public.sync_jobs add column chave_idempotencia text;
create unique index sync_jobs_chave_idempotencia_idx on public.sync_jobs (chave_idempotencia) where chave_idempotencia is not null;
