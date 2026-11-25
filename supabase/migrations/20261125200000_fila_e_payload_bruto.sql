-- Issue 04: fila de sincronização e payload bruto do ProDoctor (ADR-0002, D-F).

create type public.estado_job as enum ('pendente', 'executando', 'concluido', 'falhou');

create table public.sync_jobs (
  id bigint generated always as identity primary key,
  empresa text not null,
  rota text not null,
  corpo jsonb not null default '{}'::jsonb,
  caminho_da_lista text not null,
  estado public.estado_job not null default 'pendente',
  proxima_pagina integer not null default 1 check (proxima_pagina >= 1),
  tentativas integer not null default 0,
  ultimo_erro text,
  posse_ate timestamptz,
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create index sync_jobs_fila_idx on public.sync_jobs (criado_em, id) where estado in ('pendente', 'executando');

-- Uma cópia por execução (D-F): cada job guarda suas páginas; (job, página) é único.
create table public.prodoctor_payload_bruto (
  id bigint generated always as identity primary key,
  job_id bigint not null references public.sync_jobs (id) on delete restrict,
  empresa text not null,
  rota text not null,
  corpo_pedido jsonb not null,
  pagina integer not null check (pagina >= 1),
  payload jsonb not null,
  recebido_em timestamptz not null default now(),
  unique (job_id, pagina)
);

-- Pega o próximo job livre (ou com posse vencida). SKIP LOCKED: duas rodadas nunca pegam o mesmo.
create function public.reivindicar_proximo_job(p_posse_segundos integer default 360)
returns setof public.sync_jobs
language sql
set search_path = ''
as $$
  update public.sync_jobs as j
     set estado = 'executando',
         posse_ate = now() + make_interval(secs => p_posse_segundos),
         iniciado_em = coalesce(j.iniciado_em, now()),
         atualizado_em = now()
   where j.id = (
     select id from public.sync_jobs
      where estado = 'pendente' or (estado = 'executando' and posse_ate < now())
      order by criado_em, id
      for update skip locked
      limit 1)
  returning j.*;
$$;

-- Erro passageiro volta para a fila até 5 tentativas; definitivo (ou a 5ª) vira falha.
create function public.registrar_erro_job(p_id bigint, p_mensagem text, p_definitivo boolean)
returns void
language sql
set search_path = ''
as $$
  update public.sync_jobs
     set tentativas = tentativas + 1,
         ultimo_erro = left(p_mensagem, 2000),
         estado = case when p_definitivo or tentativas + 1 >= 5 then 'falhou'::public.estado_job else 'pendente'::public.estado_job end,
         posse_ate = null,
         atualizado_em = now()
   where id = p_id;
$$;

-- Devolve à fila um job pausado por tempo. Só mexe se ainda estiver executando.
create function public.liberar_job(p_id bigint)
returns void
language sql
set search_path = ''
as $$
  update public.sync_jobs
     set estado = 'pendente', posse_ate = null, atualizado_em = now()
   where id = p_id and estado = 'executando';
$$;

revoke execute on function public.reivindicar_proximo_job(integer) from public, anon, authenticated;
revoke execute on function public.registrar_erro_job(bigint, text, boolean) from public, anon, authenticated;
revoke execute on function public.liberar_job(bigint) from public, anon, authenticated;
grant execute on function public.reivindicar_proximo_job(integer) to service_role;
grant execute on function public.registrar_erro_job(bigint, text, boolean) to service_role;
grant execute on function public.liberar_job(bigint) to service_role;

alter table public.sync_jobs enable row level security;
alter table public.sync_jobs force row level security;
alter table public.prodoctor_payload_bruto enable row level security;
alter table public.prodoctor_payload_bruto force row level security;

revoke all on public.sync_jobs from public, anon, authenticated;
revoke all on public.prodoctor_payload_bruto from public, anon, authenticated;
revoke all on sequence public.sync_jobs_id_seq from public, anon, authenticated;
revoke all on sequence public.prodoctor_payload_bruto_id_seq from public, anon, authenticated;
