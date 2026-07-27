export type WidgetType =
  | 'metric'
  | 'chart'
  | 'activity'
  | 'integration'
  | 'health'
  | 'notification'
  | 'gmail'
  | 'calendar'
  | 'drive'
  | 'excel'
  | 'custom';

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  description: string;
  implemented: boolean;
}

export interface WidgetEngineData {
  metrics?: unknown[];
  chartStats?: unknown[];
  activities?: unknown[];
  integrations?: unknown[];
  systemHealth?: unknown[];
  notifications?: unknown[];
}