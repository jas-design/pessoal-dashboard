import { getDashboardMetrics } from '../../services/dashboard/metrics';
import { getAutomationDailyStats } from '../../services/dashboard/charts';
import { getRecentActivities } from '../../services/activity/activities';
import { getIntegrations } from '../../services/integrations/integrations';

export async function loadWidgetData() {
  const [metrics, chartStats, activities, integrations] = await Promise.all([
    getDashboardMetrics(),
    getAutomationDailyStats(),
    getRecentActivities(),
    getIntegrations(),
  ]);

  return {
    metrics,
    chartStats,
    activities,
    integrations,
  };
}