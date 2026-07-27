export interface Activity {
  id: string;
  title: string;
  description: string | null;
  type: string | null;
  status: string;
  source: string | null;
  created_at: string;
}