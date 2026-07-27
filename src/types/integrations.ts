export interface Integration {
  id: string;
  name: string;
  type: string;
  status: string;
  api_version: string | null;
  description: string | null;
  last_sync_at: string | null;
  created_at: string;
}

export interface ApiConnection {
  id: string;
  provider: string;
  provider_key: string;
  status: string;
  connection_type: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  last_sync_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}