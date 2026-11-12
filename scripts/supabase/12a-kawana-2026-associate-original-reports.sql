-- ETAPA 12A - associacao controlada dos relatorios originais Kawana 2026.
-- Execute somente apos revisar os oito UUIDs e hashes. O script e atomico:
-- qualquer divergencia gera excecao e desfaz todas as associacoes.

begin;

create temporary table pg_temp.expected_kawana_documents (
  document_id uuid primary key,
  competence date not null,
  expected_file_name text not null unique,
  expected_etag_sha256 text not null
) on commit drop;

insert into pg_temp.expected_kawana_documents (
  document_id,
  competence,
  expected_file_name,
  expected_etag_sha256
)
values
  ('3c96d0f6-0131-400d-a725-df734fdf74b0', date '2026-01-01', '01.2026 Relatório Gerencial Kawana.xlsx', '1a624743ab0b97093d9a6c651340ce4d9102d6cd6eb6908c7e30ed662736ba10'),
  ('0f42768b-4874-432e-ad1a-be9d17742fb3', date '2026-02-01', '02.2026 Relatório Gerencial Kawana.xlsx', '8eca13682d5bcc6a3342acdcbdddb6aa321a426050916a4ce19e3c15e38ef58b'),
  ('8d8941fd-a8e6-4ac3-a4f3-8db955e2f8b8', date '2026-03-01', '03.2026 Relatório Gerencial Kawana.xlsx', 'df46efb140493938b35f07f763ba51adddfd9a437793ace8a0bb1bd0871eb84b'),
  ('e8f068b1-b783-4ac2-aabb-59edced1cec7', date '2026-04-01', '04.2026 Relatório Gerencial Kawana.xlsx', '038e3ab6c169521775e40ddd0d383c84515920e5e8c38eb73f930ac59cc85934'),
  ('14697a01-9c0a-4fb2-80de-aa74ed3a75d4', date '2026-05-01', '05.2026 Relatório Gerencial Kawana.xlsx', '1250dbc6bfc906e482c0a80d670de426a4e04e6af32634df79acc6d15eed0701'),
  ('52099517-2fd8-44cd-b7dd-8b4eb5d6c072', date '2026-06-01', '06.2026 Relatório Gerencial Kawana.xlsx', '43810b003607ae36b7e4f2f3322768ed08c0ff72cf7d14095a912edf6a62517c'),
  ('12b33d82-d37a-4ca2-bef7-b86bc0748e12', date '2026-07-01', '07.2026 Relatório Gerencial Kawana.xlsx', '91ba502d4b424c4e5406a2b01ceed58240835f71bd49a20c72b22c439e5be036'),
  ('70873b2c-9059-4a07-b6e5-5b1e566f815b', date '2026-08-01', '08.2026 Relatório Gerencial Kawana.xlsx', '9437d96c941734b53b3e6a426b29d35933d3676702450f1a892114f794e25497');

do $$
declare
  target_company constant uuid := '468978dd-6ffa-440e-9465-df966ba093ee';
  invalid_count integer;
  associated_count integer;
begin
  if (select count(*) from pg_temp.expected_kawana_documents) <> 8 then
    raise exception 'association_aborted: expected inventory must contain exactly 8 documents';
  end if;

  if not exists (select 1 from public.companies where id = target_company) then
    raise exception 'association_aborted: Kawana company was not found';
  end if;

  select count(*)
    into invalid_count
  from pg_temp.expected_kawana_documents expected
  left join public.documents document on document.id = expected.document_id
  where document.id is null
     or document.file_name is distinct from expected.expected_file_name
     or expected.expected_file_name is distinct from
        to_char(expected.competence, 'MM.YYYY') || ' Relatório Gerencial Kawana.xlsx'
     or document.file_name ~* '2[ªa]?\s*via'
     or document.source_etag is null
     or encode(
          extensions.digest(convert_to(document.source_etag, 'UTF8'), 'sha256'),
          'hex'
        ) is distinct from expected.expected_etag_sha256
     or document.company_id is not null
        and document.company_id is distinct from target_company;

  if invalid_count <> 0 then
    raise exception 'association_aborted: % document(s) failed identity, competence, ETag or company validation', invalid_count;
  end if;

  update public.documents document
     set company_id = target_company
    from pg_temp.expected_kawana_documents expected
   where document.id = expected.document_id
     and document.company_id is null;

  if exists (
    select 1
    from pg_temp.expected_kawana_documents expected
    join public.documents document on document.id = expected.document_id
    where document.company_id is distinct from target_company
       or document.file_name is distinct from expected.expected_file_name
       or encode(
            extensions.digest(convert_to(document.source_etag, 'UTF8'), 'sha256'),
            'hex'
          ) is distinct from expected.expected_etag_sha256
  ) then
    raise exception 'association_aborted: post-update verification failed';
  end if;

  select count(*)
    into associated_count
  from pg_temp.expected_kawana_documents expected
  join public.documents document on document.id = expected.document_id
  where document.company_id = target_company;

  if associated_count <> 8 then
    raise exception
      'association_aborted: expected 8 Kawana associations after update; found %',
      associated_count;
  end if;
end
$$;

select
  expected.document_id,
  expected.competence,
  document.file_name,
  document.company_id,
  document.company_id = '468978dd-6ffa-440e-9465-df966ba093ee'::uuid as associated_to_kawana
from pg_temp.expected_kawana_documents expected
join public.documents document on document.id = expected.document_id
order by expected.competence;

commit;
