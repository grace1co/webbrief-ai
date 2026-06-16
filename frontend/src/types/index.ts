export interface AnalyzeResponse {
  analysis_id: string;
  website_title: string | null;
  url: string;
  pages_crawled: number;
  chunks_indexed: number;
  status: string;
}

export interface AnalysisDetail {
  analysis_id: string;
  website_title: string | null;
  url: string;
  date_analyzed: string;
  summary: string | null;
  key_topics: string[];
  suggested_questions: string[];
  pages_crawled: number;
  chunks_indexed: number;
  status: string;
  score_preview: { overall_usefulness: number | null } | null;
  website_type: string;
  has_pricing: boolean;
  is_saved: boolean;
}

export interface AnalysisListItem {
  analysis_id: string;
  website_title: string | null;
  url: string;
  date_analyzed: string;
  pages_crawled: number;
  summary_preview: string | null;
  overall_score: number | null;
  is_saved: boolean;
}

export interface HistorySettings {
  retention_days: 7 | 30 | 90 | null;
}

export interface ChunkOut {
  id: string;
  chunk_index: number;
  chunk_text: string;
  token_count: number;
}

export interface SourcePage {
  id: string;
  page_title: string | null;
  page_url: string;
  crawl_status: string;
  word_count: number;
  chunk_count: number;
  date_crawled: string;
  preview: string | null;
  chunks: ChunkOut[];
}

export interface Citation {
  page_title: string | null;
  page_url: string;
  excerpt: string;
}

export interface ChatResponse {
  answer: string;
  citations: Citation[];
}

export interface ReportSection {
  key: string;
  label: string;
  content: string;
  tone: string;
}

export interface ResearchBrief {
  // Keep older saved reports readable while current reports use sections.
  sections: ReportSection[];
  executive_summary: string;
  products_services: string;
  target_audience: string;
  pricing: string;
  trust_signals: string;
  missing_information: string;
  strengths: string;
  weaknesses: string;
  final_recommendation: string;
}

export interface GenerateReportResponse {
  report_id: string;
  report: ResearchBrief;
  website_type: string;
  has_pricing: boolean;
}

export interface ScoreItem {
  score: number;
  explanation: string;
}

export interface DynamicScoreDimension {
  key: string;
  label: string;
  score: number;
  explanation: string;
}

export interface ScoreResponse {
  analysis_id: string;
  dimensions: DynamicScoreDimension[];
  website_type: string;
  has_pricing: boolean;
  scores: Record<string, ScoreItem>;
}

export interface ComparisonDimension {
  key: string;
  label: string;
  site_a: string;
  site_b: string;
  values: { site_key: string; finding: string }[];
}

export interface ComparisonSite {
  site_key: string;
  label: string;
  summary: string;
  website_type: string;
  has_pricing: boolean;
}

export interface CompareResponse {
  comparison_id: string;
  sites: ComparisonSite[];
  website_a_summary: string;
  website_b_summary: string;
  website_a_type: string;
  website_b_type: string;
  has_pricing_a: boolean;
  has_pricing_b: boolean;
  dimensions: ComparisonDimension[];
  similarities: string[];
  differences: string[];
  final_summary: string;
  // Older comparison records may populate these instead of dimensions.
  product_service_comparison: string;
  pricing_comparison: string;
  trust_comparison: string;
  clarity_comparison: string;
  winner_for_clarity: string;
  winner_for_completeness: string;
}
