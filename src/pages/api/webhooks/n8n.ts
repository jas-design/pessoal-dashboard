import type { APIRoute } from 'astro';
import { createAutomationLog } from '../../../services/automation/automation.service';

export const POST: APIRoute = async ({ request }) => {
  const secret = request.headers.get('x-webhook-secret');

  if (secret !== import.meta.env.N8N_WEBHOOK_SECRET) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401 }
    );
  }

  const body = await request.json();

  const log = await createAutomationLog({
    workflow_name: body.workflow_name ?? 'Workflow sem nome',
    workflow_id: body.workflow_id ?? null,
    status: body.status ?? 'success',
    message: body.message ?? null,
    source: body.source ?? 'n8n',
    execution_count: body.execution_count ?? 1,
    payload: body,
  });

  return new Response(
    JSON.stringify({
      success: true,
      log,
    }),
    { status: 200 }
  );
};