-- Separate queue: leaves the active 13B PDF reader and financial facts unchanged.
create table public.document_content_jobs (
 document_id uuid primary key references public.documents(id) on delete cascade,
 owner_id uuid not null,
 source_etag text not null,
 kind text not null check (kind in ('xlsx','xls','csv','ocr')),
 claim_id uuid not null,
 status text not null check (status in ('processing','extracted','failed','stale')),
 attempts integer not null check (attempts between 1 and 3),
 claimed_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 completed_at timestamptz,
 execution_id text,
 error_code text
);
alter table public.document_content_jobs enable row level security;
revoke all on public.document_content_jobs from public, anon, authenticated;
grant select,insert,update on public.document_content_jobs to service_role;
create index document_content_jobs_owner_status on public.document_content_jobs(owner_id,status);

create function public.document_content_claim(p_owner_id uuid, p_mode text default 'spreadsheet')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.documents%rowtype; token uuid := gen_random_uuid(); k text;
begin
 if p_owner_id is null or p_mode is null or p_mode not in ('spreadsheet','ocr') then raise exception 'invalid_claim'; end if;
 if not pg_try_advisory_xact_lock(hashtextextended('document-content:'||p_owner_id::text,0)) then
  return jsonb_build_object('has_document',false,'reason','busy');
 end if;
 update public.document_content_jobs set status='failed',error_code='retry_exhausted',updated_at=now(),completed_at=now()
 where owner_id=p_owner_id and status='processing' and attempts=3 and claimed_at<now()-interval '10 minutes';
 if exists(select 1 from public.document_content_jobs where owner_id=p_owner_id and status='processing' and claimed_at>now()-interval '10 minutes') then
  return jsonb_build_object('has_document',false,'reason','busy');
 end if;
 select x.* into d from public.documents x
 left join public.document_content_jobs j on j.document_id=x.id
 where x.owner_id=p_owner_id and x.provider='onedrive' and x.is_deleted=false
 and x.file_size between 1 and 8388608 and x.external_drive_id is not null and x.external_file_id is not null and x.source_etag is not null
 and (x.source_path='/drive/root:/Deskboard KPIs' or x.source_path like '/drive/root:/Deskboard KPIs/%')
 and ((p_mode='spreadsheet' and x.file_name ~* '\.(xlsx|xls|csv)$')
  or (p_mode='ocr' and x.file_name ~* '\.pdf$' and x.metadata->'text_ingestion'->>'status'='needs_ocr'
      and x.metadata->'text_ingestion'->>'source_etag'=x.source_etag))
 and (j.document_id is null or j.source_etag is distinct from x.source_etag
  or (j.attempts<3 and ((j.status='failed' and j.updated_at<now()-interval '15 minutes')
   or (j.status='processing' and j.claimed_at<now()-interval '10 minutes'))))
 order by coalesce(j.attempts,0),x.source_modified_at desc nulls last,x.id
 for update of x skip locked limit 1;
 if not found then return jsonb_build_object('has_document',false,'reason','no_eligible_document'); end if;
 k := case when p_mode='ocr' then 'ocr' else lower(substring(d.file_name from '\.([^.]+)$')) end;
 insert into public.document_content_jobs(document_id,owner_id,source_etag,kind,claim_id,status,attempts)
 values(d.id,d.owner_id,d.source_etag,k,token,'processing',1)
 on conflict(document_id) do update set owner_id=excluded.owner_id,source_etag=excluded.source_etag,kind=excluded.kind,
 claim_id=excluded.claim_id,status='processing',attempts=case when document_content_jobs.source_etag=excluded.source_etag then document_content_jobs.attempts+1 else 1 end,
 claimed_at=now(),updated_at=now(),completed_at=null,error_code=null;
 return (to_jsonb(d)-'extracted_text'-'metadata')||jsonb_build_object('has_document',true,'claim_id',token,'kind',k);
end $$;

create function public.document_content_complete(p_document_id uuid,p_claim_id uuid,p_source_etag text,p_status text,
 p_text text default null,p_metadata jsonb default '{}'::jsonb,p_execution_id text default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.documents%rowtype; j public.document_content_jobs%rowtype; result_status text;
begin
 if p_status is null or p_status not in ('extracted','failed') then raise exception 'invalid_status'; end if;
 if (p_status='extracted' and (p_text is null or length(btrim(p_text))<1 or length(p_text)>900000))
 or (p_status='failed' and p_text is not null) then raise exception 'invalid_content'; end if;
 if p_metadata is null or jsonb_typeof(p_metadata)<>'object' or octet_length(p_metadata::text)>20000 then raise exception 'invalid_metadata'; end if;
 select * into d from public.documents where id=p_document_id for update;
 if not found then raise exception 'document_missing'; end if;
 select * into j from public.document_content_jobs where document_id=p_document_id for update;
 if not found or j.claim_id is distinct from p_claim_id or j.source_etag is distinct from p_source_etag then raise exception 'claim_mismatch'; end if;
 if j.status<>'processing' then return jsonb_build_object('success',true,'status',j.status,'already_completed',true); end if;
 if p_status='extracted' and (p_metadata->>'kind' is distinct from j.kind or p_metadata->>'version' is distinct from '13c-v1'
 or coalesce(p_metadata->>'sha256','') !~ '^[a-f0-9]{64}$') then raise exception 'invalid_provenance'; end if;
 result_status:=p_status;
 if d.owner_id<>j.owner_id or d.is_deleted or d.provider<>'onedrive' or d.source_etag is distinct from p_source_etag then result_status:='stale'; end if;
 if result_status='extracted' then
  update public.documents set extracted_text=p_text,processing_status='completed',indexed_for_ai=false,
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('text_ingestion',p_metadata||jsonb_build_object(
   'source_etag',p_source_etag,'external_file_id',d.external_file_id,'execution_id',left(p_execution_id,100),
   'status','extracted','extracted_at',now(),'characters',length(p_text),'financial_facts_created',0,'review_required',j.kind='ocr'))
  where id=d.id;
 end if;
 update public.document_content_jobs set status=result_status,updated_at=now(),completed_at=now(),execution_id=left(p_execution_id,100),
 error_code=case when result_status='failed' then 'extraction_failed' when result_status='stale' then 'source_changed' else null end where document_id=d.id;
 return jsonb_build_object('success',true,'document_id',d.id,'status',result_status,'financial_facts_created',0);
end $$;
revoke all on function public.document_content_claim(uuid,text) from public,anon,authenticated;
revoke all on function public.document_content_complete(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.document_content_claim(uuid,text) to service_role;
grant execute on function public.document_content_complete(uuid,uuid,text,text,text,jsonb,text) to service_role;
