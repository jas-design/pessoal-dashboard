-- Preserve the existing RPC signature and validate diagnostic codes independently.
create or replace function public.document_content_complete(p_document_id uuid,p_claim_id uuid,p_source_etag text,p_status text,
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
 error_code=case when result_status='failed' then case when p_metadata->>'error_code' in ('busy', 'content_limit', 'expanded_size_limit', 'extraction_failed', 'extraction_timeout', 'file_size_limit', 'incomplete_body', 'invalid_csv', 'invalid_pdf', 'invalid_xls', 'invalid_xlsx', 'macros_not_supported', 'no_content', 'not_found', 'page_limit', 'sheet_dimensions_limit', 'sheet_limit', 'unauthorized', 'unsupported_kind') then p_metadata->>'error_code' else 'extraction_failed' end when result_status='stale' then 'source_changed' else null end where document_id=d.id;
 return jsonb_build_object('success',true,'document_id',d.id,'status',result_status,'financial_facts_created',0);
end $$;
revoke all on function public.document_content_complete(uuid,uuid,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.document_content_complete(uuid,uuid,text,text,text,jsonb,text) to service_role;
