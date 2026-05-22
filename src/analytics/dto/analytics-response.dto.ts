export interface DashboardMetricsDto {
  dailyNewUsers: number;
  dailyNewPosts: number;
  dailyNewJobs: number;
  dailyApplications: number;
  dailyReports: number;
}

export interface EntityAnalyticsDto {
  totalViews: number;
  uniqueViewers: number;
  last7Days: number;
  last30Days: number;
}
