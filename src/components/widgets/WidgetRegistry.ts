import type { WidgetDefinition } from './WidgetTypes';

export const widgetRegistry: WidgetDefinition[] = [
  {
    type: 'metric',
    label: 'Métrica',
    description: 'Card numérico com variação.',
    implemented: true,
  },
  {
    type: 'chart',
    label: 'Gráfico',
    description: 'Visualização gráfica de dados.',
    implemented: true,
  },
  {
    type: 'activity',
    label: 'Atividades',
    description: 'Lista de atividades recentes.',
    implemented: true,
  },
  {
    type: 'integration',
    label: 'Integrações',
    description: 'Status de conexões externas.',
    implemented: true,
  },
  {
    type: 'health',
    label: 'Saúde do Sistema',
    description: 'Status dos serviços internos.',
    implemented: false,
  },
  {
    type: 'notification',
    label: 'Notificações',
    description: 'Alertas e eventos do sistema.',
    implemented: false,
  },
  {
    type: 'gmail',
    label: 'Gmail',
    description: 'Resumo e processamento de e-mails.',
    implemented: false,
  },
  {
    type: 'calendar',
    label: 'Calendar',
    description: 'Eventos e agenda conectada.',
    implemented: false,
  },
  {
    type: 'drive',
    label: 'Drive',
    description: 'Arquivos monitorados no Google Drive.',
    implemented: false,
  },
  {
    type: 'excel',
    label: 'Excel Upload',
    description: 'Uploads e importações de planilhas.',
    implemented: false,
  },
  {
    type: 'custom',
    label: 'Customizado',
    description: 'Widget especial ou futuro.',
    implemented: false,
  },
];

export function isSupportedWidgetType(type: string) {
  return widgetRegistry.some((widget) => widget.type === type);
}

export function isImplementedWidgetType(type: string) {
  return widgetRegistry.some(
    (widget) => widget.type === type && widget.implemented
  );
}