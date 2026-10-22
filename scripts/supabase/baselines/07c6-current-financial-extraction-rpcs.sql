-- Snapshot versionado das RPCs de extracao comprovadas na Etapa 07C.6.
-- Fonte: inventario local 07C5 (CSV permanece fora do Git).
-- Nao e migration. Executar somente como rollback aprovado e testado.
-- As ACLs reproduzem a postura efetiva; a origem dos grants nao foi inventariada.

begin;

CREATE OR REPLACE FUNCTION public.finance_claim_next_document(p_owner_id uuid, p_pilot_only boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc record;
  v_claim uuid := gen_random_uuid();
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner obrigatorio';
  END IF;

  SELECT d.id, d.owner_id, d.file_name, d.source_etag, d.external_drive_id,
         d.external_file_id, d.file_size, d.company_id, d.source_path
  INTO v_doc
  FROM public.documents d
  LEFT JOIN public.financial_extraction_jobs j ON j.document_id = d.id
  WHERE d.owner_id = p_owner_id
    AND d.provider = 'onedrive'
    AND d.is_deleted = false
    AND d.external_drive_id IS NOT NULL
    AND d.external_file_id IS NOT NULL
    AND d.source_etag IS NOT NULL
    AND d.file_size BETWEEN 1 AND 8388608
    AND (
      d.source_path = '/drive/root:/Deskboard KPIs'
      OR d.source_path LIKE '/drive/root:/Deskboard KPIs/%'
    )
    AND d.file_name ~* '\.(csv|xlsx|pdf)$'
    AND (
      (p_pilot_only AND d.file_name ~* '^TESTE_FINANCEIRO_.*\.(csv|xlsx|pdf)$')
      OR (NOT p_pilot_only AND d.company_id IS NOT NULL)
    )
    AND (
      j.document_id IS NULL
      OR j.source_etag IS DISTINCT FROM d.source_etag
      OR (j.status = 'failed' AND j.attempts < 3)
      OR (j.status = 'processing' AND j.claimed_at < now() - interval '30 minutes' AND j.attempts < 3)
    )
  ORDER BY d.source_modified_at DESC NULLS LAST, d.id
  FOR UPDATE OF d SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_document', false, 'reason', 'no_eligible_document');
  END IF;

  INSERT INTO public.financial_extraction_jobs
    (document_id, owner_id, source_etag, claim_id, status, attempts, claimed_at, completed_at, records_extracted, note, text_excerpt, updated_at)
  VALUES
    (v_doc.id, v_doc.owner_id, v_doc.source_etag, v_claim, 'processing', 1, now(), null, 0, null, null, now())
  ON CONFLICT (document_id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    source_etag = EXCLUDED.source_etag,
    claim_id = EXCLUDED.claim_id,
    status = 'processing',
    attempts = CASE
      WHEN financial_extraction_jobs.source_etag IS DISTINCT FROM EXCLUDED.source_etag THEN 1
      ELSE financial_extraction_jobs.attempts + 1 END,
    claimed_at = now(), completed_at = null, records_extracted = 0,
    note = null, text_excerpt = null, updated_at = now();

  RETURN jsonb_build_object(
    'has_document', true, 'document_id', v_doc.id, 'owner_id', v_doc.owner_id,
    'external_drive_id', v_doc.external_drive_id,
    'external_file_id', v_doc.external_file_id,
    'source_etag', v_doc.source_etag,
    'file_name', v_doc.file_name, 'file_size', v_doc.file_size,
    'company_id', v_doc.company_id,
    'extension', lower(substring(v_doc.file_name from '\.([^.]+)$')),
    'claim_id', v_claim
  );
END;
$function$
;

alter function public.finance_claim_next_document(p_owner_id uuid, p_pilot_only boolean) owner to postgres;
alter function public.finance_claim_next_document(p_owner_id uuid, p_pilot_only boolean) security invoker;
alter function public.finance_claim_next_document(p_owner_id uuid, p_pilot_only boolean) set search_path = 'public';
revoke all on function public.finance_claim_next_document(p_owner_id uuid, p_pilot_only boolean) from public, anon, authenticated, service_role;
grant execute on function public.finance_claim_next_document(p_owner_id uuid, p_pilot_only boolean) to service_role;

CREATE OR REPLACE FUNCTION public.finance_complete_document(p_document_id uuid, p_claim_id uuid, p_source_etag text, p_status text, p_rows jsonb DEFAULT '[]'::jsonb, p_note text DEFAULT NULL::text, p_excerpt text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.financial_extraction_jobs%ROWTYPE;
  v_doc public.documents%ROWTYPE;
  v_line jsonb;
  v_company uuid;
  v_source_company text;
  v_period date;
  v_metric text;
  v_currency text;
  v_amount numeric;
  v_count integer := 0;
  v_unknown_company integer := 0;
  v_final_status text;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('extracted','needs_review','needs_ocr','failed')
     OR p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array'
     OR jsonb_array_length(p_rows) > 2000 THEN
    RAISE EXCEPTION 'Payload de extracao invalido';
  END IF;

  SELECT * INTO v_job FROM public.financial_extraction_jobs
  WHERE document_id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_job.claim_id IS DISTINCT FROM p_claim_id
     OR v_job.source_etag IS DISTINCT FROM p_source_etag
     OR v_job.status <> 'processing' THEN
    RAISE EXCEPTION 'Claim ausente, obsoleto ou ja finalizado';
  END IF;

  SELECT * INTO v_doc FROM public.documents WHERE id = p_document_id FOR UPDATE;
  IF NOT FOUND OR v_doc.is_deleted
    OR v_doc.owner_id <> v_job.owner_id
    OR v_doc.source_etag IS DISTINCT FROM p_source_etag THEN
    RAISE EXCEPTION 'Documento removido, alterado ou de outro proprietario';
  END IF;

  IF p_status <> 'extracted' AND jsonb_array_length(p_rows) <> 0 THEN
    RAISE EXCEPTION 'Status de revisao nao pode inserir fatos';
  END IF;
  IF p_status = 'extracted' AND jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Nao e possivel extrair zero fatos';
  END IF;

  IF p_status = 'extracted' THEN
    FOR v_line IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
      IF jsonb_typeof(v_line) <> 'object' THEN RAISE EXCEPTION 'Linha invalida'; END IF;
      v_metric := v_line->>'metric';
      v_currency := upper(coalesce(v_line->>'currency','BRL'));
      v_period := (v_line->>'month')::date;
      v_amount := (v_line->>'amount')::numeric;
      v_source_company := nullif(btrim(v_line->>'company_name'), '');
      IF v_metric NOT IN ('receita','despesa')
         OR v_currency NOT IN ('BRL','USD','EUR')
         OR v_period IS NULL OR extract(day from v_period) <> 1
         OR v_amount IS NULL OR v_amount < 0 OR v_amount > 999999999999.99 THEN
        RAISE EXCEPTION 'Fato financeiro invalido';
      END IF;

      v_company := v_doc.company_id;
      IF v_company IS NULL AND v_source_company IS NOT NULL THEN
        -- Somente nome EXATO e UNICO de empresa pertencente ao owner.
        SELECT CASE WHEN count(*) = 1 THEN (array_agg(c.id))[1] ELSE null END
        INTO v_company
        FROM public.companies c
        WHERE c.owner_id = v_doc.owner_id
          AND c.is_active = true
          AND lower(btrim(c.name)) = lower(v_source_company);
      END IF;
      IF v_company IS NULL THEN v_unknown_company := v_unknown_company + 1; END IF;

      INSERT INTO public.financial_extracted_rows
      (owner_id, document_id, source_etag, company_id, source_company_name,
       period_month, metric, amount, currency, sheet_name, source_row, review_status)
      VALUES
      (v_doc.owner_id, v_doc.id, p_source_etag, v_company, v_source_company,
       v_period, v_metric, v_amount, v_currency,
       left(coalesce(nullif(v_line->>'sheet',''),'primeira_planilha'),120),
       (v_line->>'source_row')::integer, 'pending_review')
      ON CONFLICT (document_id, source_etag, sheet_name, source_row, metric)
      DO UPDATE SET company_id=EXCLUDED.company_id,
        source_company_name=EXCLUDED.source_company_name,
        period_month=EXCLUDED.period_month, amount=EXCLUDED.amount,
        currency=EXCLUDED.currency,
        review_status='pending_review';
      v_count := v_count + 1;
    END LOOP;
  END IF;

  v_final_status := CASE WHEN p_status = 'extracted' AND v_unknown_company > 0
    THEN 'needs_review' ELSE p_status END;
  UPDATE public.financial_extraction_jobs
  SET status=v_final_status, completed_at=now(), records_extracted=v_count,
      note=left(p_note,500), text_excerpt=left(p_excerpt,1500), updated_at=now()
  WHERE document_id = p_document_id;

  RETURN jsonb_build_object('success',true,'document_id',p_document_id,
    'status',v_final_status,'extracted_rows',v_count,
    'unknown_company_rows',v_unknown_company,'requires_approval',true);
END;
$function$
;

alter function public.finance_complete_document(p_document_id uuid, p_claim_id uuid, p_source_etag text, p_status text, p_rows jsonb, p_note text, p_excerpt text) owner to postgres;
alter function public.finance_complete_document(p_document_id uuid, p_claim_id uuid, p_source_etag text, p_status text, p_rows jsonb, p_note text, p_excerpt text) security invoker;
alter function public.finance_complete_document(p_document_id uuid, p_claim_id uuid, p_source_etag text, p_status text, p_rows jsonb, p_note text, p_excerpt text) set search_path = 'public';
revoke all on function public.finance_complete_document(p_document_id uuid, p_claim_id uuid, p_source_etag text, p_status text, p_rows jsonb, p_note text, p_excerpt text) from public, anon, authenticated, service_role;
grant execute on function public.finance_complete_document(p_document_id uuid, p_claim_id uuid, p_source_etag text, p_status text, p_rows jsonb, p_note text, p_excerpt text) to service_role;

commit;
