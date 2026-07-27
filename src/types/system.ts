export interface SystemHealth {
  id: string;
  service_name: string;
  status: string;
  response_time_ms: number | null;
  uptime_percentage: number | null;
  last_checked_at: string;
  metadata: Record<string, unknown>;
}

export interface Webhook {
  id: string;
  name: string;
  source: string;
  endpoint_url: string | null;
  status: string;
  last_triggered_at: string | null;
  created_at: string;
}
