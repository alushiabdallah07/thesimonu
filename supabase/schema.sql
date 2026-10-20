-- REFERÊNCIA DE COMPATIBILIDADE PARA O ESQUEMA EXISTENTE.
-- O banco do projeto já foi criado. Leia o README antes de executar qualquer SQL.
-- Não use este arquivo para apagar/recriar tabelas em produção.

-- O frontend usa upsert em evaluation_scores e precisa desta combinação única.
-- Antes de criar o índice, verifique se já existe uma constraint equivalente.
create unique index if not exists evaluation_scores_evaluation_criterion_uidx
on public.evaluation_scores (evaluation_id, criterion_id);

-- Verificações não destrutivas para confirmar a estrutura atual:
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('committee_members','delegates','sessions','evaluation_criteria','evaluations','evaluation_scores')
order by table_name;

-- Verifique políticas RLS no painel Supabase caso login funcione, mas as telas não carreguem.
-- Não desabilite RLS para resolver problemas de permissão.
