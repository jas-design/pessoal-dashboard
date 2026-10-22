-- Snapshot versionado das oito funções comprovadas pelo inventário 07C.2.
-- Fonte local confidencial: B14_definicoes_funcoes.csv (não versionada).
-- Não executar como migration. Uso: comparação e rollback integral dos corpos
-- das funções somente após validação em staging e aprovação explícita.
-- O estado legado inclui EXECUTE de anon nos wrappers públicos.

begin;

CREATE OR REPLACE FUNCTION financial_private.finance_review_decide_impl(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.financial_extracted_rows%ROWTYPE;
  v_doc public.documents%ROWTYPE;
  v_company public.companies%ROWTYPE;
  v_role text;
  v_new_status text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
  IF p_action IS NULL OR p_action NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Acao invalida'; END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'Justificativa obrigatoria (8 a 500 caracteres)';
  END IF;
  IF p_expected_revision IS NULL OR p_expected_revision < 0 THEN
    RAISE EXCEPTION 'Revisao obrigatoria';
  END IF;

  SELECT * INTO v_row FROM public.financial_extracted_rows
  WHERE id = p_row_id AND owner_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha inexistente ou nao autorizada'; END IF;
  IF v_row.review_status <> 'pending_review' THEN RAISE EXCEPTION 'Linha ja revisada'; END IF;
  IF v_row.review_revision <> p_expected_revision THEN RAISE EXCEPTION 'Revisao desatualizada'; END IF;

  SELECT * INTO v_doc FROM public.documents
  WHERE id = v_row.document_id AND owner_id = v_actor FOR SHARE;
  IF NOT FOUND OR v_doc.is_deleted THEN RAISE EXCEPTION 'Documento indisponivel'; END IF;
  IF v_doc.source_etag IS DISTINCT FROM v_row.source_etag THEN
    RAISE EXCEPTION 'Versao do arquivo mudou: reextrair antes da revisao';
  END IF;

  IF p_action = 'approve' THEN
    IF v_doc.file_name ~* '^TESTE_' THEN
      RAISE EXCEPTION 'Arquivos de teste nao podem ser aprovados';
    END IF;
    IF v_row.company_id IS NULL THEN RAISE EXCEPTION 'Empresa nao vinculada'; END IF;
    SELECT * INTO v_company FROM public.companies
    WHERE id = v_row.company_id AND owner_id = v_actor AND is_active = true;
    IF NOT FOUND THEN RAISE EXCEPTION 'Empresa inexistente ou inativa'; END IF;
    SELECT usage_role INTO v_role FROM public.financial_review_document_policy
    WHERE document_id = v_doc.id AND owner_id = v_actor;
    IF coalesce(v_role,'unclassified') <> 'primary' THEN
      RAISE EXCEPTION 'Classifique o documento como fonte primaria antes de aprovar';
    END IF;
    -- Esta aprovacao ainda NAO atualiza a tabela financial_monthly_metrics.
    v_new_status := 'approved';
  ELSE
    v_new_status := 'rejected';
  END IF;

  UPDATE public.financial_extracted_rows
  SET review_status = v_new_status, reviewed_at = now(), reviewed_by = v_actor,
      review_note = btrim(p_reason), review_revision = review_revision + 1
  WHERE id = v_row.id;

  INSERT INTO public.financial_review_audit
    (owner_id,document_id,extraction_row_id,actor_id,event_type,
     old_value,new_value,reason,source_etag,snapshot)
  VALUES
    (v_actor,v_doc.id,v_row.id,v_actor,p_action,
     v_row.review_status,v_new_status,btrim(p_reason),v_row.source_etag,
     jsonb_build_object('company_id',v_row.company_id,
       'company_name',v_row.source_company_name,
       'period_month',v_row.period_month,'metric',v_row.metric,
       'amount',v_row.amount,'currency',v_row.currency,
       'sheet_name',v_row.sheet_name,'source_row',v_row.source_row,
       'file_name',v_doc.file_name));

  RETURN jsonb_build_object('success',true,'row_id',v_row.id,
    'review_status',v_new_status,'review_revision',v_row.review_revision+1,
    'finance_dashboard_updated',false);
END;
$function$
;

CREATE OR REPLACE FUNCTION financial_private.finance_review_history_impl(p_row_id uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
  IF p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Limite invalido'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_extracted_rows f
    WHERE f.id=p_row_id AND f.owner_id=v_actor
  ) THEN RAISE EXCEPTION 'Linha nao encontrada'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC),'[]'::jsonb)
  INTO v_result
  FROM (
    SELECT id,event_type,old_value,new_value,reason,actor_id,created_at
    FROM public.financial_review_audit
    WHERE extraction_row_id=p_row_id AND owner_id=v_actor
    ORDER BY created_at DESC LIMIT p_limit
  ) t;
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION financial_private.finance_review_list_impl(p_status text DEFAULT 'pending_review'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_total bigint;
  v_items jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending_review','approved','rejected','all') THEN
    RAISE EXCEPTION 'Status de revisao invalido';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 100 OR p_offset NOT BETWEEN 0 AND 100000 THEN
    RAISE EXCEPTION 'Paginacao invalida';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.financial_extracted_rows f
  JOIN public.documents d ON d.id = f.document_id
  WHERE f.owner_id = v_actor AND d.owner_id = v_actor
    AND (p_status = 'all' OR f.review_status = p_status);

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC, t.id), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT f.id, f.document_id, f.source_etag, f.company_id,
      c.name AS company_name, f.source_company_name, f.period_month,
      f.metric, f.amount, f.currency, f.sheet_name, f.source_row,
      f.review_status, f.review_revision, f.review_note, f.reviewed_at,
      f.reviewed_by, f.created_at, d.file_name, d.is_deleted,
      (d.source_etag IS NOT DISTINCT FROM f.source_etag) AS source_version_current,
      coalesce(p.usage_role, 'unclassified') AS source_usage_role
    FROM public.financial_extracted_rows f
    JOIN public.documents d ON d.id = f.document_id
    LEFT JOIN public.companies c ON c.id = f.company_id AND c.owner_id = v_actor
    LEFT JOIN public.financial_review_document_policy p
      ON p.document_id = d.id AND p.owner_id = v_actor
    WHERE f.owner_id = v_actor AND d.owner_id = v_actor
      AND (p_status = 'all' OR f.review_status = p_status)
    ORDER BY f.created_at DESC, f.id
    LIMIT p_limit OFFSET p_offset
  ) t;
  RETURN jsonb_build_object('total',v_total,'items',v_items);
END;
$function$
;

CREATE OR REPLACE FUNCTION financial_private.finance_review_set_document_role_impl(p_document_id uuid, p_usage_role text, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_doc public.documents%ROWTYPE;
  v_old_role text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Autenticacao obrigatoria'; END IF;
  IF p_usage_role IS NULL OR p_usage_role NOT IN ('primary','supporting','unclassified') THEN
    RAISE EXCEPTION 'Classificacao invalida';
  END IF;
  IF length(btrim(coalesce(p_reason,''))) NOT BETWEEN 8 AND 500 THEN
    RAISE EXCEPTION 'Justificativa obrigatoria (8 a 500 caracteres)';
  END IF;
  SELECT * INTO v_doc FROM public.documents
   WHERE id = p_document_id AND owner_id = v_actor FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento nao encontrado ou nao autorizado'; END IF;
  IF v_doc.is_deleted THEN RAISE EXCEPTION 'Documento excluido'; END IF;
  IF p_usage_role = 'primary' AND v_doc.file_name ~* '^TESTE_' THEN
    RAISE EXCEPTION 'Arquivos de teste nao podem ser fontes primarias';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.financial_extracted_rows f
    WHERE f.document_id = p_document_id AND f.review_status = 'approved'
  ) THEN RAISE EXCEPTION 'Documento com linhas aprovadas: revisar antes de reclassificar'; END IF;

  SELECT usage_role INTO v_old_role
  FROM public.financial_review_document_policy
  WHERE document_id = p_document_id AND owner_id = v_actor FOR UPDATE;
  v_old_role := coalesce(v_old_role, 'unclassified');
  IF v_old_role = p_usage_role THEN
    RETURN jsonb_build_object('success',true,'changed',false,'usage_role',p_usage_role);
  END IF;

  INSERT INTO public.financial_review_document_policy
    (document_id,owner_id,usage_role,changed_by,changed_at)
  VALUES (p_document_id,v_actor,p_usage_role,v_actor,now())
  ON CONFLICT (document_id) DO UPDATE SET
    usage_role=EXCLUDED.usage_role,
    changed_by=EXCLUDED.changed_by,
    changed_at=now();

  INSERT INTO public.financial_review_audit
    (owner_id,document_id,actor_id,event_type,old_value,new_value,reason,source_etag,snapshot)
  VALUES
    (v_actor,p_document_id,v_actor,'classify_source',v_old_role,p_usage_role,
     btrim(p_reason),v_doc.source_etag,
     jsonb_build_object('file_name',v_doc.file_name));

  RETURN jsonb_build_object('success',true,'changed',true,'usage_role',p_usage_role);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finance_review_decide(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT financial_private.finance_review_decide_impl(p_row_id,p_action,p_reason,p_expected_revision);
$function$
;

CREATE OR REPLACE FUNCTION public.finance_review_history(p_row_id uuid, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT financial_private.finance_review_history_impl(p_row_id,p_limit);
$function$
;

CREATE OR REPLACE FUNCTION public.finance_review_list(p_status text DEFAULT 'pending_review'::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT financial_private.finance_review_list_impl(p_status,p_limit,p_offset);
$function$
;

CREATE OR REPLACE FUNCTION public.finance_review_set_document_role(p_document_id uuid, p_usage_role text, p_reason text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$
  SELECT financial_private.finance_review_set_document_role_impl(p_document_id,p_usage_role,p_reason);
$function$
;

alter function financial_private.finance_review_decide_impl(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer) owner to postgres;
revoke all on function financial_private.finance_review_decide_impl(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer) from public, anon, authenticated, service_role;
grant execute on function financial_private.finance_review_decide_impl(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer) to authenticated;

alter function financial_private.finance_review_history_impl(p_row_id uuid, p_limit integer) owner to postgres;
revoke all on function financial_private.finance_review_history_impl(p_row_id uuid, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function financial_private.finance_review_history_impl(p_row_id uuid, p_limit integer) to authenticated;

alter function financial_private.finance_review_list_impl(p_status text, p_limit integer, p_offset integer) owner to postgres;
revoke all on function financial_private.finance_review_list_impl(p_status text, p_limit integer, p_offset integer) from public, anon, authenticated, service_role;
grant execute on function financial_private.finance_review_list_impl(p_status text, p_limit integer, p_offset integer) to authenticated;

alter function financial_private.finance_review_set_document_role_impl(p_document_id uuid, p_usage_role text, p_reason text) owner to postgres;
revoke all on function financial_private.finance_review_set_document_role_impl(p_document_id uuid, p_usage_role text, p_reason text) from public, anon, authenticated, service_role;
grant execute on function financial_private.finance_review_set_document_role_impl(p_document_id uuid, p_usage_role text, p_reason text) to authenticated;

alter function public.finance_review_decide(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer) owner to postgres;
revoke all on function public.finance_review_decide(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer) from public, anon, authenticated, service_role;
grant execute on function public.finance_review_decide(p_row_id uuid, p_action text, p_reason text, p_expected_revision integer) to anon, authenticated, service_role;

alter function public.finance_review_history(p_row_id uuid, p_limit integer) owner to postgres;
revoke all on function public.finance_review_history(p_row_id uuid, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.finance_review_history(p_row_id uuid, p_limit integer) to anon, authenticated, service_role;

alter function public.finance_review_list(p_status text, p_limit integer, p_offset integer) owner to postgres;
revoke all on function public.finance_review_list(p_status text, p_limit integer, p_offset integer) from public, anon, authenticated, service_role;
grant execute on function public.finance_review_list(p_status text, p_limit integer, p_offset integer) to anon, authenticated, service_role;

alter function public.finance_review_set_document_role(p_document_id uuid, p_usage_role text, p_reason text) owner to postgres;
revoke all on function public.finance_review_set_document_role(p_document_id uuid, p_usage_role text, p_reason text) from public, anon, authenticated, service_role;
grant execute on function public.finance_review_set_document_role(p_document_id uuid, p_usage_role text, p_reason text) to anon, authenticated, service_role;

commit;
