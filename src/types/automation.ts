export interface AutomationLog {
  id: string;
  workflow_name: string;
  workflow_id: string | null;
  status: string;
  message: string | null;
  source: string;
  execution_count: number;
  payload: Record<string, unknown> | null;
  created_at: string;
}