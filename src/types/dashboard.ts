export interface DashboardMetric {
  id: string;
  metric_key: string;
  metric_label: string;
  metric_value: number;
  variation: number;
  comparison_label: string;
  icon: string;
  period: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: string;
  widget_key: string;
  title: string;
  description: string;
  widget_type: string;
  data_source: string;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutomationDailyStat {
  id: string;
  stat_date: string;
  success_count: number;
  error_count: number;
  total_count: number;
  created_at: string;
}