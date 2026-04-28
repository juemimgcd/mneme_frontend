export interface ApiEnvelope<T> {
  code?: number;
  message?: string;
  data?: T;
  detail?: string;
}

export interface User {
  id: number;
  username: string;
  display_name?: string | null;
  avatar_url?: string;
  created_at?: string;
}

export interface AuthToken {
  access_token: string;
  token_type: string;
}

export interface AuthPayload {
  username: string;
  password: string;
}

export interface KnowledgeBase {
  id: string;
  user_id?: number;
  name: string;
  description: string | null;
  is_default?: boolean;
  created_at?: string;
  document_count: number;
  memory_count: number;
  updated_at: string;
  status: 'ready' | 'indexing' | 'draft' | 'queued';
}

export interface KnowledgeBaseDeleteResult {
  knowledge_base_id: string;
  document_count: number;
  chunk_count: number;
  deleted_memory_entry_count: number;
  deleted_task_count: number;
  deleted_vector_count: number;
}

export interface DocumentItem {
  id: string;
  user_id?: number;
  file_name: string;
  name: string;
  knowledge_base_id: string;
  file_type?: string;
  status:
    | 'uploaded'
    | 'queued'
    | 'indexing'
    | 'parsing'
    | 'chunking'
    | 'embedding'
    | 'vector_upserting'
    | 'indexed'
    | 'failed';
  page_count: number | null;
  chunk_count: number | null;
  created_at: string;
  size_label: string;
  task_id?: string;
}

export interface ChatSource {
  knowledge_base_id: string;
  document_id: string;
  chunk_id: string;
  page_no: number | null;
  text: string;
  source_chunk_ids: string[];
  source_page_nos: number[];
  merged_chunk_count: number;
}

export interface ChatExchange {
  id: string;
  question: string;
  answer: string;
  sources: ChatSource[];
  created_at: string;
}

export interface MemoryTimelineEntry {
  entry_id: string;
  entry_name: string;
  entry_type: string;
  summary: string;
  created_at: string;
}

export interface MemoryThemeGroup {
  theme_name: string;
  entries: string[];
  count: number;
}

export interface MemoryLibrary {
  timeline: MemoryTimelineEntry[];
  by_type: Record<string, string[]>;
  by_theme: MemoryThemeGroup[];
}

export interface MemoryRebuildResult {
  knowledge_base_id: string;
  document_count: number;
  processed_document_count: number;
  chunk_count: number;
  deleted_entry_count: number;
  entry_count: number;
}

export interface ProfileInsight {
  theme_name: string;
  reason: string;
  evidence_entries: string[];
}

export interface AbilityTag {
  ability_name: string;
  reason: string;
  evidence_entries: string[];
}

export interface PersonalProfile {
  knowledge_base_id: string;
  entry_count: number;
  profile_summary: string;
  main_themes: ProfileInsight[];
  ability_tags: AbilityTag[];
  expression_style: string;
  growth_focus: string[];
}

export interface ThemeChange {
  theme_name: string;
  change_type: string;
  reason: string;
  evidence_entries: string[];
}

export interface GrowthReport {
  knowledge_base_id: string;
  analysis_window: string;
  stage_summary: string;
  recent_focus: string[];
  theme_changes: ThemeChange[];
  highlights: string[];
  blockers: string[];
  next_actions: string[];
}

export interface AdviceActionSuggestion {
  area: string;
  why_now: string;
  action: string;
  first_step: string;
  evidence_entries: string[];
}

export interface GrowthAdviceResult {
  knowledge_base_id: string;
  focus_goal: string | null;
  advice_summary: string;
  current_priorities: string[];
  action_suggestions: AdviceActionSuggestion[];
  avoid_list: string[];
  one_week_plan: string[];
  reflection_questions: string[];
}

export interface CompanionCitation {
  document_id: string;
  chunk_id: string;
  page_no: number | null;
  text: string;
  reason: string;
}

export interface CompanionAnswerResult {
  knowledge_base_id: string;
  question: string;
  direct_answer: string;
  citations: CompanionCitation[];
  profile_snapshot: string;
  growth_snapshot: string;
  next_step_hint: string;
  follow_up_questions: string[];
  companion_message: string;
}

export interface IndexSubmission {
  document_id: string;
  knowledge_base_id?: string;
  status: DocumentItem['status'];
  task_id?: string;
  message?: string;
}

export interface TaskRecord {
  id: string;
  task_type: string;
  target_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskActionResult {
  task_id: string;
  status: string;
  document_id: string | null;
  message: string;
}

export interface DocumentDeleteResult {
  document_id: string;
  knowledge_base_id: string;
  chunk_count: number;
  deleted_memory_entry_count: number;
  deleted_task_count: number;
  deleted_vector_count: number;
}

export type GraphNodeType = 'user' | 'knowledge_base' | 'document' | 'memory_entry';

export type GraphEdgeType = 'owns' | 'contains' | 'extracts' | 'related';

export interface GraphNode {
  id: string;
  entity_id: string;
  node_type: GraphNodeType;
  label: string;
  parent_id: string | null;
  depth: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  edge_type: GraphEdgeType;
  metadata: Record<string, unknown>;
}

export interface GraphResult {
  scope: 'user' | 'knowledge_base' | 'document';
  generated_at: string;
  root_node_id: string;
  include_memory: boolean;
  include_relationships: boolean;
  relationship_strategy: string | null;
  relationship_scope: string | null;
  min_shared_memory_count: number | null;
  min_relationship_score: number | null;
  max_related_edges: number | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  node_count: number;
  edge_count: number;
  node_type_counts: Record<string, number>;
  edge_type_counts: Record<string, number>;
}

export interface GraphProjectionRebuildResult {
  scope: 'user' | 'knowledge_base';
  user_id: number;
  knowledge_base_id: string | null;
  knowledge_base_count: number | null;
  document_count: number;
  memory_entry_count: number;
  status: string;
}

export interface GraphQueryOptions {
  includeMemory?: boolean;
  includeRelationships?: boolean;
  minSharedMemoryCount?: number;
  minRelationshipScore?: number;
  maxRelatedEdges?: number;
  relationshipScope?: 'knowledge_base' | 'user';
}

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  tone: 'teal' | 'amber' | 'indigo' | 'coral';
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: 'teal' | 'amber' | 'indigo' | 'coral';
}
