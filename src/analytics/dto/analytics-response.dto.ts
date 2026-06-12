export interface DashboardMetricsDto {
  dailyNewUsers: number;
  dailyNewPosts: number;
  dailyNewJobs: number;
  dailyApplications: number;
  dailyReports: number;
  totalActiveJobs: number;
  totalCompanies: number;
  totalConnections: number;
  messageVolume24h: number;
  messageVolume7d: number;
  messageVolume30d: number;
}

export interface PipelineCount {
  status: string;
  count: number;
}

export interface TransitionTime {
  fromStatus: string;
  toStatus: string;
  avgHours: number;
  count: number;
}

export interface ConversionRate {
  fromStatus: string;
  toStatus: string;
  rate: number;
  fromCount: number;
  transitionCount: number;
}

export interface RecruitingMetricsDto {
  pipelineCounts: PipelineCount[];
  avgTransitionTimes: TransitionTime[];
  conversionRates: ConversionRate[];
}

export interface EntityAnalyticsDto {
  totalViews: number;
  uniqueViewers: number;
  last7Days: number;
  last30Days: number;
}
