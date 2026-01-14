export interface AppAnalysis {
  problem: string;
  solution: string;
  target_user: string;
  unique_point: string;
}

export interface AppMarket {
  competitors: string[];
  timing_reason: string;
  growth_potential: string;
}

export interface AppBusiness {
  monetization: string;
  pricing_suggestion: string;
  revenue_potential: string;
}

export interface AppDevInsight {
  estimated_period: string;
  estimated_cost: string;
  tech_stack: string[];
  key_features: string[];
  clone_tip: string;
}

export interface AppScores {
  novelty: number;
  necessity: number;
  timing: number;
  tech_difficulty: number;
  market_size: number;
  competition: number;
  profitability: number;
  scalability: number;
  overall: number;
}

export interface AppInfo {
  rank: number;
  name: string;
  developer: string;
  category: string;
  country?: string;  // 국가 코드 (kr, us, jp)
  icon: string;
  app_url: string;
  idea_summary: string;
  analysis: AppAnalysis;
  market: AppMarket;
  business: AppBusiness;
  dev_insight: AppDevInsight;
  scores: AppScores;
  tags: string[];
  verdict: string;
  deep_report_id?: string | null;  // 심층 분석 리포트 ID
}

export interface DailyInsight {
  trend_summary: string;
  trend_details: string[];
  hot_categories: string[];
  opportunity: string;
  action_item: string;
}

export interface DailyReport {
  date: string;
  ios: AppInfo[];
  android: AppInfo[];
  daily_insight: DailyInsight;
}
