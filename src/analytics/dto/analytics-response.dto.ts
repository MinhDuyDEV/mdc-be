export interface DashboardMetricsDto {
  dailyNewUsers: number;
  dailyNewPosts: number;
  dailyNewJobs: number;
  dailyApplications: number;
  dailyReports: number;
}

export interface EntityAnalyticsDto {
  totalViews: number;
  // TODO(mdc-be-x3g): Implement unique viewer counting (DISTINCT userId)
  uniqueViewers: number | null;
  // TODO(mdc-be-n0v): Implement date-range filtered views
  last7Days: number | null;
  last30Days: number | null;
}
