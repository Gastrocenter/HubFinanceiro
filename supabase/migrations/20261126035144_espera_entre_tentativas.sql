-- Code-review item 1: erro passageiro voltava à fila na hora e as 5 tentativas acabavam na mesma rodada
-- (~40 s de queda do ProDoctor = job perdido). Agora espera 5, 10, 20 e 40 min entre tentativas.
alter table public.sync_jobs add column disponivel_em timestamptz;

create or replace function public.reivindicar_proximo_job(p_posse_segundos integer default 360)
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
      where (estado = 'pendente' and (disponivel_em is null or disponivel_em <= now()))
         or (estado = 'executando' and posse_ate < now())
      order by criado_em, id
      for update skip locked
      limit 1)
  returning j.*;
$$;

create or replace function public.registrar_erro_job(p_id bigint, p_mensagem text, p_definitivo boolean)
returns void
language sql
set search_path = ''
as $$
  update public.sync_jobs
     set tentativas = tentativas + 1,
         ultimo_erro = left(p_mensagem, 2000),
         estado = case when p_definitivo or tentativas + 1 >= 5 then 'falhou'::public.estado_job else 'pendente'::public.estado_job end,
         -- Espera dobra a cada falha passageira: 5, 10, 20, 40 min.
         disponivel_em = case when p_definitivo or tentativas + 1 >= 5 then null
                              else now() + make_interval(mins => 5 * (2 ^ tentativas)::integer) end,
         posse_ate = null,
         atualizado_em = now()
   where id = p_id;
$$;
