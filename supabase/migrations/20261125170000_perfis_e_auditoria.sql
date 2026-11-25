-- Issue 02: perfis de usuário e log de auditoria append-only.
-- ADR-0002: o navegador nunca acessa estas tabelas; só o servidor (RLS ligado, sem policy).

create type public.perfil as enum ('admin', 'financeiro', 'aprovador', 'restrito');

create table public.perfis_usuarios (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  perfil public.perfil not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, perfil)
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  ocorrido_em timestamptz not null default now(),
  usuario_id uuid references auth.users (id) on delete set null,
  acao text not null,
  entidade text,
  entidade_id text,
  detalhes jsonb not null default '{}'::jsonb
);

create index auditoria_usuario_id_idx on public.auditoria (usuario_id);
create index auditoria_ocorrido_em_idx on public.auditoria (ocorrido_em desc);

-- Append-only: ninguém altera nem apaga o log, nem o dono da tabela.
create function public.bloquear_alteracao_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'auditoria é append-only: % não é permitido', tg_op;
end;
$$;

create trigger auditoria_sem_update_delete
  before update or delete on public.auditoria
  for each row execute function public.bloquear_alteracao_auditoria();

create trigger auditoria_sem_truncate
  before truncate on public.auditoria
  for each statement execute function public.bloquear_alteracao_auditoria();

revoke execute on function public.bloquear_alteracao_auditoria() from public, anon, authenticated;

-- RLS ligado e forçado, sem nenhuma policy: o acesso é só pelo servidor.
alter table public.perfis_usuarios enable row level security;
alter table public.perfis_usuarios force row level security;
alter table public.auditoria enable row level security;
alter table public.auditoria force row level security;

-- O Supabase concede acesso a anon/authenticated por padrão em tabelas novas; tirar.
revoke all on public.perfis_usuarios from public, anon, authenticated;
revoke all on public.auditoria from public, anon, authenticated;
revoke all on sequence public.auditoria_id_seq from public, anon, authenticated;
