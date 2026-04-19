import { requestJson, shouldUseMocks } from '@/lib/http';
import type {
  AuthPayload,
  AuthToken,
  ChatExchange,
  CompanionAnswerResult,
  DocumentDeleteResult,
  DocumentItem,
  GraphEdge,
  GraphNode,
  GraphQueryOptions,
  GraphResult,
  GrowthAdviceResult,
  GrowthReport,
  IndexSubmission,
  KnowledgeBase,
  MemoryLibrary,
  MemoryRebuildResult,
  PersonalProfile,
  TaskActionResult,
  TaskRecord,
  User,
} from '@/lib/types';
import {
  mockChatHistory,
  mockChatQuery,
  mockDeleteDocument,
  mockCreateKnowledgeBase,
  mockDocumentMemoryLibrary,
  mockDocuments,
  mockGrowth,
  mockAdvice,
  mockIndexDocument,
  mockKnowledgeBases,
  mockLogin,
  mockMe,
  mockMemoryLibrary,
  mockCompanionReply,
  mockProfile,
  mockRegister,
  mockTaskStatus,
  mockCancelTask,
  mockRetryTask,
  mockUploadDocuments,
} from '@/mocks/api';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return fallback;
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function firstPresent(source: Record<string, unknown>, keys: string[], fallback?: unknown) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key];
    }
  }
  return fallback;
}

function createClientId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeUser(raw: unknown): User {
  const source = isObject(raw) ? raw : {};
  return {
    id: asNumber(firstPresent(source, ['id', 'user_id']), 1),
    username: asString(firstPresent(source, ['username', 'name', 'user_name']), 'mneme_user'),
    display_name: asString(firstPresent(source, ['display_name']), ''),
    avatar_url: asString(firstPresent(source, ['avatar_url']), ''),
    created_at: asString(
      firstPresent(source, ['created_at', 'createdAt', 'updated_at']),
      new Date().toISOString(),
    ),
  };
}

function normalizeAuthToken(raw: unknown): AuthToken {
  const source = isObject(raw) ? raw : {};
  return {
    access_token: asString(firstPresent(source, ['access_token', 'token', 'jwt_token'])),
    token_type: asString(firstPresent(source, ['token_type', 'type']), 'bearer'),
  };
}

function normalizeKnowledgeBase(raw: unknown): KnowledgeBase {
  const source = isObject(raw) ? raw : {};
  const rawStatus = asString(firstPresent(source, ['status', 'index_status']), '');
  return {
    id: asString(firstPresent(source, ['id', 'knowledge_base_id']), createClientId('kb')),
    user_id: asNumber(firstPresent(source, ['user_id']), 0),
    name: asString(firstPresent(source, ['name', 'title']), '未命名知识库'),
    description: asString(firstPresent(source, ['description', 'summary']), ''),
    is_default: Boolean(firstPresent(source, ['is_default'], false)),
    created_at: asString(firstPresent(source, ['created_at']), new Date().toISOString()),
    document_count: asNumber(firstPresent(source, ['document_count', 'documents_count', 'doc_count'])),
    memory_count: asNumber(firstPresent(source, ['memory_count', 'entry_count', 'entries_count'])),
    updated_at: asString(
      firstPresent(source, ['updated_at', 'updatedAt', 'created_at']),
      new Date().toISOString(),
    ),
    status:
      rawStatus === 'queued' || rawStatus === 'indexing' || rawStatus === 'draft'
        ? rawStatus
        : firstPresent(source, ['is_default'], false)
          ? 'ready'
          : 'draft',
  };
}

function normalizeDocumentStatus(value: unknown): DocumentItem['status'] {
  const status = asString(value, 'uploaded');
  const map: Record<string, DocumentItem['status']> = {
    uploaded: 'uploaded',
    queued: 'queued',
    indexing: 'indexing',
    parsing: 'parsing',
    chunking: 'chunking',
    embedding: 'embedding',
    vector_upserting: 'vector_upserting',
    indexed: 'indexed',
    completed: 'indexed',
    ready: 'indexed',
    failed: 'failed',
  };
  return map[status] ?? 'uploaded';
}

function normalizeDocument(raw: unknown): DocumentItem {
  const source = isObject(raw) ? raw : {};
  const fileName = asString(firstPresent(source, ['file_name', 'name', 'filename', 'title']), '未命名文档');
  const fileType = asString(firstPresent(source, ['file_type']), fileName.split('.').pop() ?? '');
  const rawPageCount = firstPresent(source, ['page_count', 'pages']);
  const rawChunkCount = firstPresent(source, ['chunk_count', 'chunks', 'chunk_total']);
  const rawFileSize = firstPresent(source, ['file_size']);
  return {
    id: asString(firstPresent(source, ['id', 'document_id']), createClientId('doc')),
    user_id: asNumber(firstPresent(source, ['user_id']), 0),
    file_name: fileName,
    name: fileName,
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id', 'kb_id']), ''),
    file_type: fileType,
    status: normalizeDocumentStatus(firstPresent(source, ['status', 'index_status'])),
    page_count: rawPageCount == null ? null : asNumber(rawPageCount),
    chunk_count: rawChunkCount == null ? null : asNumber(rawChunkCount),
    created_at: asString(firstPresent(source, ['created_at', 'uploaded_at']), new Date().toISOString()),
    size_label: asString(
      firstPresent(source, ['size_label']),
      rawFileSize == null ? '--' : `${Math.max(1, Math.round(asNumber(rawFileSize) / 1024))} KB`,
    ),
    task_id: asString(firstPresent(source, ['task_id']), ''),
  };
}

function normalizeSource(raw: unknown) {
  const source = isObject(raw) ? raw : {};
  const pages = asArray<number>(firstPresent(source, ['source_page_nos', 'pages'], []));
  const chunkIds = asArray<string>(firstPresent(source, ['source_chunk_ids', 'chunk_ids'], []));
  return {
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id', 'kb_id'])),
    document_id: asString(firstPresent(source, ['document_id', 'doc_id'])),
    chunk_id: asString(firstPresent(source, ['chunk_id']), chunkIds.join('..')),
    page_no:
      firstPresent(source, ['page_no']) !== undefined
        ? asNumber(firstPresent(source, ['page_no']), 0)
        : null,
    text: asString(firstPresent(source, ['text', 'content', 'source_text'])),
    source_chunk_ids: chunkIds,
    source_page_nos: pages,
    merged_chunk_count: asNumber(firstPresent(source, ['merged_chunk_count']), Math.max(1, chunkIds.length)),
  };
}

function normalizeChatExchange(raw: unknown, questionFallback = ''): ChatExchange {
  const source = isObject(raw) ? raw : {};
  const nestedData = isObject(source.data) ? source.data : source;
  return {
    id: asString(firstPresent(nestedData, ['id', 'chat_id']), createClientId('chat')),
    question: asString(firstPresent(nestedData, ['question']), questionFallback),
    answer: asString(firstPresent(nestedData, ['answer', 'response']), ''),
    sources: asArray(firstPresent(nestedData, ['sources', 'citations'], [])).map(normalizeSource),
    created_at: asString(firstPresent(nestedData, ['created_at', 'timestamp']), new Date().toISOString()),
  };
}

function normalizeMemoryLibrary(raw: unknown): MemoryLibrary {
  const source = isObject(raw) ? raw : {};
  const timeline = asArray(firstPresent(source, ['timeline', 'entries'], []))
    .map((entry) => (isObject(entry) ? entry : {}))
    .map((entry, index) => ({
      entry_id: asString(firstPresent(entry, ['entry_id', 'id']), `entry_${index}`),
      entry_name: asString(firstPresent(entry, ['entry_name', 'name']), `条目 ${index + 1}`),
      entry_type: asString(firstPresent(entry, ['entry_type', 'type']), 'memory'),
      summary: asString(firstPresent(entry, ['summary', 'text', 'description']), ''),
      created_at: asString(firstPresent(entry, ['created_at']), new Date().toISOString()),
    }));

  const byTypeSource = isObject(firstPresent(source, ['by_type'], {}))
    ? (firstPresent(source, ['by_type'], {}) as Record<string, unknown>)
    : {};

  const byTheme = asArray(firstPresent(source, ['by_theme', 'themes'], []))
    .map((item) => (isObject(item) ? item : {}))
    .map((item) => ({
      theme_name: asString(firstPresent(item, ['theme_name', 'name']), '未命名主题'),
      entries: asArray<string>(firstPresent(item, ['entries', 'items'], [])),
      count: asNumber(firstPresent(item, ['count']), asArray(firstPresent(item, ['entries'], [])).length),
    }));

  return {
    timeline,
    by_type: Object.fromEntries(
      Object.entries(byTypeSource).map(([key, value]) => [key, asArray<string>(value)]),
    ),
    by_theme: byTheme,
  };
}

function normalizeProfileInsightsRecord(raw: unknown, index: number) {
  const source = isObject(raw) ? raw : {};
  return {
    theme_name: asString(firstPresent(source, ['theme_name', 'title', 'label', 'name']), `主题 ${index + 1}`),
    reason: asString(firstPresent(source, ['reason', 'summary', 'description', 'content']), ''),
    evidence_entries: asArray<string>(firstPresent(source, ['evidence_entries', 'tags', 'keywords'], [])),
  };
}

function normalizeAbilityTag(raw: unknown, index: number) {
  const source = isObject(raw) ? raw : {};
  return {
    ability_name: asString(firstPresent(source, ['ability_name', 'label', 'title', 'name']), `能力 ${index + 1}`),
    reason: asString(firstPresent(source, ['reason', 'summary', 'description']), ''),
    evidence_entries: asArray<string>(firstPresent(source, ['evidence_entries'], [])),
  };
}

function normalizePersonalProfile(raw: unknown): PersonalProfile {
  const source = isObject(raw) ? raw : {};
  return {
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id']), ''),
    entry_count: asNumber(firstPresent(source, ['entry_count']), 0),
    profile_summary: asString(firstPresent(source, ['profile_summary']), ''),
    main_themes: asArray(firstPresent(source, ['main_themes'], [])).map(normalizeProfileInsightsRecord),
    ability_tags: asArray(firstPresent(source, ['ability_tags'], [])).map(normalizeAbilityTag),
    expression_style: asString(firstPresent(source, ['expression_style']), ''),
    growth_focus: asArray<string>(firstPresent(source, ['growth_focus'], [])),
  };
}

function normalizeThemeChange(raw: unknown, index: number) {
  const source = isObject(raw) ? raw : {};
  return {
    theme_name: asString(firstPresent(source, ['theme_name', 'name']), `主题变化 ${index + 1}`),
    change_type: asString(firstPresent(source, ['change_type']), 'stable'),
    reason: asString(firstPresent(source, ['reason', 'summary', 'description']), ''),
    evidence_entries: asArray<string>(firstPresent(source, ['evidence_entries'], [])),
  };
}

function normalizeGrowthReport(raw: unknown): GrowthReport {
  const source = isObject(raw) ? raw : {};
  return {
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id']), ''),
    analysis_window: asString(firstPresent(source, ['analysis_window']), ''),
    stage_summary: asString(firstPresent(source, ['stage_summary']), ''),
    recent_focus: asArray<string>(firstPresent(source, ['recent_focus'], [])),
    theme_changes: asArray(firstPresent(source, ['theme_changes'], [])).map(normalizeThemeChange),
    highlights: asArray<string>(firstPresent(source, ['highlights'], [])),
    blockers: asArray<string>(firstPresent(source, ['blockers'], [])),
    next_actions: asArray<string>(firstPresent(source, ['next_actions'], [])),
  };
}

function normalizeAdviceAction(raw: unknown, index: number) {
  const source = isObject(raw) ? raw : {};
  return {
    area: asString(firstPresent(source, ['area', 'title', 'name']), `Area ${index + 1}`),
    why_now: asString(firstPresent(source, ['why_now', 'reason', 'summary']), ''),
    action: asString(firstPresent(source, ['action']), ''),
    first_step: asString(firstPresent(source, ['first_step']), ''),
    evidence_entries: asArray<string>(firstPresent(source, ['evidence_entries'], [])),
  };
}

function normalizeGrowthAdvice(raw: unknown): GrowthAdviceResult {
  const source = isObject(raw) ? raw : {};
  const focusGoal = firstPresent(source, ['focus_goal'], null);
  return {
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id']), ''),
    focus_goal: focusGoal == null ? null : asString(focusGoal),
    advice_summary: asString(firstPresent(source, ['advice_summary', 'summary']), ''),
    current_priorities: asArray<string>(firstPresent(source, ['current_priorities'], [])),
    action_suggestions: asArray(firstPresent(source, ['action_suggestions'], [])).map(normalizeAdviceAction),
    avoid_list: asArray<string>(firstPresent(source, ['avoid_list'], [])),
    one_week_plan: asArray<string>(firstPresent(source, ['one_week_plan'], [])),
    reflection_questions: asArray<string>(firstPresent(source, ['reflection_questions'], [])),
  };
}

function normalizeCompanionCitation(raw: unknown, index: number) {
  const source = isObject(raw) ? raw : {};
  return {
    document_id: asString(firstPresent(source, ['document_id']), `doc_${index + 1}`),
    chunk_id: asString(firstPresent(source, ['chunk_id']), `chunk_${index + 1}`),
    page_no:
      firstPresent(source, ['page_no']) !== undefined
        ? asNumber(firstPresent(source, ['page_no']), 0)
        : null,
    text: asString(firstPresent(source, ['text', 'content']), ''),
    reason: asString(firstPresent(source, ['reason']), ''),
  };
}

function normalizeCompanionAnswer(raw: unknown): CompanionAnswerResult {
  const source = isObject(raw) ? raw : {};
  return {
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id']), ''),
    question: asString(firstPresent(source, ['question']), ''),
    direct_answer: asString(firstPresent(source, ['direct_answer', 'answer']), ''),
    citations: asArray(firstPresent(source, ['citations'], [])).map(normalizeCompanionCitation),
    profile_snapshot: asString(firstPresent(source, ['profile_snapshot']), ''),
    growth_snapshot: asString(firstPresent(source, ['growth_snapshot']), ''),
    next_step_hint: asString(firstPresent(source, ['next_step_hint']), ''),
    follow_up_questions: asArray<string>(firstPresent(source, ['follow_up_questions'], [])),
    companion_message: asString(firstPresent(source, ['companion_message']), ''),
  };
}

function normalizeIndexSubmission(raw: unknown, documentId: string): IndexSubmission {
  const source = isObject(raw) ? raw : {};
  return {
    document_id: asString(firstPresent(source, ['document_id', 'id']), documentId),
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id']), ''),
    status: normalizeDocumentStatus(firstPresent(source, ['status'], 'queued')),
    task_id: asString(firstPresent(source, ['task_id'])),
    message: asString(firstPresent(source, ['message', 'detail'])),
  };
}

function normalizeTaskRecord(raw: unknown): TaskRecord {
  const source = isObject(raw) ? raw : {};
  return {
    id: asString(firstPresent(source, ['id', 'task_id']), ''),
    task_type: asString(firstPresent(source, ['task_type']), ''),
    target_id: asString(firstPresent(source, ['target_id', 'document_id']), ''),
    status: asString(firstPresent(source, ['status']), ''),
    error_message: (() => {
      const value = firstPresent(source, ['error_message', 'message'], null);
      return value == null ? null : asString(value);
    })(),
    created_at: asString(firstPresent(source, ['created_at']), new Date().toISOString()),
    updated_at: asString(firstPresent(source, ['updated_at']), new Date().toISOString()),
  };
}

function normalizeTaskAction(raw: unknown): TaskActionResult {
  const source = isObject(raw) ? raw : {};
  const documentId = firstPresent(source, ['document_id'], null);
  return {
    task_id: asString(firstPresent(source, ['task_id', 'id']), ''),
    status: asString(firstPresent(source, ['status']), ''),
    document_id: documentId == null ? null : asString(documentId),
    message: asString(firstPresent(source, ['message', 'detail']), ''),
  };
}

function normalizeDocumentDeleteResult(raw: unknown): DocumentDeleteResult {
  const source = isObject(raw) ? raw : {};
  return {
    document_id: asString(firstPresent(source, ['document_id']), ''),
    knowledge_base_id: asString(firstPresent(source, ['knowledge_base_id']), ''),
    chunk_count: asNumber(firstPresent(source, ['chunk_count']), 0),
    deleted_memory_entry_count: asNumber(firstPresent(source, ['deleted_memory_entry_count']), 0),
    deleted_task_count: asNumber(firstPresent(source, ['deleted_task_count']), 0),
    deleted_vector_count: asNumber(firstPresent(source, ['deleted_vector_count']), 0),
  };
}

function normalizeGraphNode(raw: unknown): GraphNode {
  const source = isObject(raw) ? raw : {};
  const metadata = isObject(firstPresent(source, ['metadata'], {}))
    ? (firstPresent(source, ['metadata'], {}) as Record<string, unknown>)
    : {};

  const nodeType = asString(firstPresent(source, ['node_type']), 'document');
  const safeNodeType: GraphNode['node_type'] =
    nodeType === 'user' ||
    nodeType === 'knowledge_base' ||
    nodeType === 'document' ||
    nodeType === 'memory_entry'
      ? nodeType
      : 'document';

  const parentId = firstPresent(source, ['parent_id'], null);

  return {
    id: asString(firstPresent(source, ['id']), createClientId('graph_node')),
    entity_id: asString(firstPresent(source, ['entity_id']), ''),
    node_type: safeNodeType,
    label: asString(firstPresent(source, ['label']), safeNodeType),
    parent_id: parentId == null ? null : asString(parentId),
    depth: asNumber(firstPresent(source, ['depth']), 0),
    metadata,
  };
}

function normalizeGraphEdge(raw: unknown): GraphEdge {
  const source = isObject(raw) ? raw : {};
  const metadata = isObject(firstPresent(source, ['metadata'], {}))
    ? (firstPresent(source, ['metadata'], {}) as Record<string, unknown>)
    : {};

  const edgeType = asString(firstPresent(source, ['edge_type']), 'contains');
  const safeEdgeType: GraphEdge['edge_type'] =
    edgeType === 'owns' ||
    edgeType === 'contains' ||
    edgeType === 'extracts' ||
    edgeType === 'related'
      ? edgeType
      : 'contains';

  return {
    id: asString(firstPresent(source, ['id']), createClientId('graph_edge')),
    source: asString(firstPresent(source, ['source']), ''),
    target: asString(firstPresent(source, ['target']), ''),
    edge_type: safeEdgeType,
    metadata,
  };
}

function normalizeGraph(raw: unknown): GraphResult {
  const source = isObject(raw) ? raw : {};
  const nodes = asArray(firstPresent(source, ['nodes'], [])).map(normalizeGraphNode);
  const edges = asArray(firstPresent(source, ['edges'], [])).map(normalizeGraphEdge);
  const scope = asString(firstPresent(source, ['scope']), 'knowledge_base');
  const safeScope: GraphResult['scope'] =
    scope === 'user' || scope === 'knowledge_base' || scope === 'document'
      ? scope
      : 'knowledge_base';

  const nodeTypeCounts = isObject(firstPresent(source, ['node_type_counts'], {}))
    ? (firstPresent(source, ['node_type_counts'], {}) as Record<string, number>)
    : {};
  const edgeTypeCounts = isObject(firstPresent(source, ['edge_type_counts'], {}))
    ? (firstPresent(source, ['edge_type_counts'], {}) as Record<string, number>)
    : {};

  const minSharedMemoryCount = firstPresent(source, ['min_shared_memory_count'], null);
  const minRelationshipScore = firstPresent(source, ['min_relationship_score'], null);
  const maxRelatedEdges = firstPresent(source, ['max_related_edges'], null);

  return {
    scope: safeScope,
    generated_at: asString(firstPresent(source, ['generated_at']), new Date().toISOString()),
    root_node_id: asString(firstPresent(source, ['root_node_id']), nodes[0]?.id ?? ''),
    include_memory: asBoolean(firstPresent(source, ['include_memory']), false),
    include_relationships: asBoolean(firstPresent(source, ['include_relationships']), false),
    relationship_strategy: (() => {
      const value = firstPresent(source, ['relationship_strategy'], null);
      return value == null ? null : asString(value);
    })(),
    relationship_scope: (() => {
      const value = firstPresent(source, ['relationship_scope'], null);
      return value == null ? null : asString(value);
    })(),
    min_shared_memory_count: minSharedMemoryCount == null ? null : asNumber(minSharedMemoryCount),
    min_relationship_score: minRelationshipScore == null ? null : asNumber(minRelationshipScore),
    max_related_edges: maxRelatedEdges == null ? null : asNumber(maxRelatedEdges),
    nodes,
    edges,
    node_count: asNumber(firstPresent(source, ['node_count']), nodes.length),
    edge_count: asNumber(firstPresent(source, ['edge_count']), edges.length),
    node_type_counts: nodeTypeCounts,
    edge_type_counts: edgeTypeCounts,
  };
}

function buildGraphQuery(options: GraphQueryOptions = {}) {
  const params = new URLSearchParams();

  if (options.includeMemory) {
    params.set('include_memory', 'true');
  }
  if (options.includeRelationships) {
    params.set('include_relationships', 'true');
  }
  if (options.minSharedMemoryCount !== undefined) {
    params.set('min_shared_memory_count', String(options.minSharedMemoryCount));
  }
  if (options.minRelationshipScore !== undefined) {
    params.set('min_relationship_score', String(options.minRelationshipScore));
  }
  if (options.maxRelatedEdges !== undefined) {
    params.set('max_related_edges', String(options.maxRelatedEdges));
  }
  if (options.relationshipScope) {
    params.set('relationship_scope', options.relationshipScope);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

function createEmptyGraph(scope: GraphResult['scope']): GraphResult {
  return {
    scope,
    generated_at: new Date().toISOString(),
    root_node_id: '',
    include_memory: false,
    include_relationships: false,
    relationship_strategy: null,
    relationship_scope: null,
    min_shared_memory_count: null,
    min_relationship_score: null,
    max_related_edges: null,
    nodes: [],
    edges: [],
    node_count: 0,
    edge_count: 0,
    node_type_counts: {},
    edge_type_counts: {},
  };
}

function unwrapCollection(raw: unknown, collectionKeys: string[]) {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (!isObject(raw)) {
    return [];
  }

  for (const key of collectionKeys) {
    const candidate = raw[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  const nestedData = isObject(raw.data) ? raw.data : null;
  if (nestedData) {
    for (const key of collectionKeys) {
      const candidate = nestedData[key];
      if (Array.isArray(candidate)) {
        return candidate;
      }
    }
  }

  return [];
}

async function withFallback<T>(online: () => Promise<T>, offline: () => Promise<T>) {
  if (shouldUseMocks()) {
    return offline();
  }

  return online();
}

export const api = {
  register(payload: AuthPayload) {
    return withFallback(
      async () =>
        normalizeUser(
          await requestJson<unknown>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ),
      () => mockRegister(payload),
    );
  },
  login(payload: AuthPayload) {
    return withFallback(
      async () =>
        normalizeAuthToken(
          await requestJson<unknown>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(payload),
          }),
        ),
      () => mockLogin(payload),
    );
  },
  me(token: string) {
    return withFallback(
      async () => normalizeUser(await requestJson<unknown>('/auth/me', {}, token)),
      () => mockMe(),
    );
  },
  knowledgeBases(userId: number, token: string) {
    return withFallback(
      async () => {
        const raw = await requestJson<unknown>(`/users/${userId}/knowledge-bases`, {}, token);
        return unwrapCollection(raw, ['knowledge_bases', 'items', 'records']).map(normalizeKnowledgeBase);
      },
      () => mockKnowledgeBases(),
    );
  },
  createKnowledgeBase(
    userId: number,
    payload: { name: string; description: string },
    token: string,
  ) {
    return withFallback(
      async () =>
        normalizeKnowledgeBase(
          await requestJson<unknown>(
          `/users/${userId}/knowledge-bases`,
          { method: 'POST', body: JSON.stringify(payload) },
          token,
          ),
        ),
      () => mockCreateKnowledgeBase(payload),
    );
  },
  documents(userId: number, token: string, knowledgeBaseId?: string) {
    const query = new URLSearchParams();
    query.set('user_id', String(userId));
    if (knowledgeBaseId) {
      query.set('knowledge_base_id', knowledgeBaseId);
    }
    return withFallback(
      async () => {
        const raw = await requestJson<unknown>(`/kb/documents?${query.toString()}`, {}, token);
        return unwrapCollection(raw, ['documents', 'items', 'records']).map(normalizeDocument);
      },
      () => mockDocuments(knowledgeBaseId),
    );
  },
  uploadDocuments(token: string, userId: number, knowledgeBaseId: string, files: File[]) {
    return withFallback(
      async () => {
        const uploadedDocuments: DocumentItem[] = [];
        for (const file of files) {
          const formData = new FormData();
          formData.append('user_id', String(userId));
          formData.append('knowledge_base_id', knowledgeBaseId);
          formData.append('file', file);
          const raw = await requestJson<unknown>(
            '/kb/documents/upload',
            { method: 'POST', body: formData },
            token,
          );
          uploadedDocuments.push(
            normalizeDocument({
              ...(isObject(raw) ? raw : {}),
              user_id: userId,
              knowledge_base_id: knowledgeBaseId,
              file_name: file.name,
              file_size: file.size,
            }),
          );
        }
        return uploadedDocuments;
      },
      () => mockUploadDocuments(userId, knowledgeBaseId, files),
    );
  },
  indexDocument(token: string, documentId: string) {
    return withFallback(
      async () =>
        normalizeIndexSubmission(
          await requestJson<unknown>(`/kb/documents/${documentId}/index`, { method: 'POST' }, token),
          documentId,
        ),
      async () => {
        const submission = await mockIndexDocument(documentId);
        return normalizeIndexSubmission(submission, documentId);
      },
    );
  },
  chatQuery(
    token: string,
    payload: { userId: number; knowledgeBaseId: string; question: string; topK: number },
  ) {
    return withFallback(
      async () =>
        normalizeChatExchange(
          await requestJson<unknown>(
            '/kb/chat/query',
            {
              method: 'POST',
              body: JSON.stringify({
                user_id: payload.userId,
                knowledge_base_id: payload.knowledgeBaseId,
                question: payload.question,
                top_k: payload.topK,
                session_id: `session_${payload.knowledgeBaseId}`,
              }),
            },
            token,
          ),
          payload.question,
        ),
      () => mockChatQuery(payload),
    );
  },
  chatHistory() {
    if (shouldUseMocks()) {
      return mockChatHistory();
    }
    return Promise.resolve([]);
  },
  memoryLibrary(token: string, knowledgeBaseId: string) {
    return withFallback(
      async () =>
        normalizeMemoryLibrary(
          await requestJson<unknown>(`/memory/knowledge-bases/${knowledgeBaseId}/library`, {}, token),
        ),
      () => mockMemoryLibrary(),
    );
  },
  documentMemoryLibrary(token: string, documentId: string) {
    return withFallback(
      async () =>
        normalizeMemoryLibrary(
          await requestJson<unknown>(`/memory/documents/${documentId}/library`, {}, token),
        ),
      () => mockDocumentMemoryLibrary(documentId),
    );
  },
  memoryRebuild(token: string, knowledgeBaseId: string) {
    return withFallback(
      async () =>
        await requestJson<MemoryRebuildResult>(
          `/memory/knowledge-bases/${knowledgeBaseId}/rebuild`,
          { method: 'POST' },
          token,
        ),
      async () => {
        const data = await mockMemoryLibrary();
        return {
          knowledge_base_id: knowledgeBaseId,
          document_count: 0,
          processed_document_count: 0,
          chunk_count: 0,
          deleted_entry_count: 0,
          entry_count: data.timeline.length,
        };
      },
    );
  },
  profile(token: string, knowledgeBaseId: string) {
    return withFallback(
      async () =>
        normalizePersonalProfile(
          await requestJson<unknown>(`/profile/knowledge-bases/${knowledgeBaseId}`, {}, token),
        ),
      () => mockProfile(),
    );
  },
  growth(token: string, knowledgeBaseId: string) {
    return withFallback(
      async () =>
        normalizeGrowthReport(
          await requestJson<unknown>(
            `/analysis/knowledge-bases/${knowledgeBaseId}/growth`,
            {},
            token,
          ),
        ),
      () => mockGrowth(),
    );
  },
  advice(token: string, knowledgeBaseId: string, focusGoal?: string) {
    return withFallback(
      async () =>
        normalizeGrowthAdvice(
          await requestJson<unknown>(
            `/advice/knowledge-bases/${knowledgeBaseId}`,
            {
              method: 'POST',
              body: JSON.stringify({
                focus_goal: focusGoal?.trim() ? focusGoal.trim() : null,
              }),
            },
            token,
          ),
        ),
      () => mockAdvice(focusGoal),
    );
  },
  companionReply(token: string, knowledgeBaseId: string, question: string, topK: number) {
    return withFallback(
      async () =>
        normalizeCompanionAnswer(
          await requestJson<unknown>(
            `/companion/knowledge-bases/${knowledgeBaseId}/reply`,
            {
              method: 'POST',
              body: JSON.stringify({
                question,
                top_k: topK,
              }),
            },
            token,
          ),
        ),
      () => mockCompanionReply({ question, topK }),
    );
  },
  taskStatus(token: string, taskId: string) {
    return withFallback(
      async () =>
        normalizeTaskRecord(
          await requestJson<unknown>(`/tasks/${taskId}`, {}, token),
        ),
      () => mockTaskStatus(taskId),
    );
  },
  cancelTask(token: string, taskId: string) {
    return withFallback(
      async () =>
        normalizeTaskAction(
          await requestJson<unknown>(`/tasks/${taskId}/cancel`, { method: 'POST' }, token),
        ),
      () => mockCancelTask(taskId),
    );
  },
  retryTask(token: string, taskId: string) {
    return withFallback(
      async () =>
        normalizeTaskAction(
          await requestJson<unknown>(`/tasks/${taskId}/retry`, { method: 'POST' }, token),
        ),
      () => mockRetryTask(taskId),
    );
  },
  deleteDocument(token: string, documentId: string) {
    return withFallback(
      async () =>
        normalizeDocumentDeleteResult(
          await requestJson<unknown>(`/kb/documents/${documentId}`, { method: 'DELETE' }, token),
        ),
      () => mockDeleteDocument(documentId),
    );
  },
  userGraph(token: string, options: GraphQueryOptions = {}) {
    return withFallback(
      async () =>
        normalizeGraph(
          await requestJson<unknown>(`/graph${buildGraphQuery(options)}`, {}, token),
        ),
      async () => createEmptyGraph('user'),
    );
  },
  knowledgeBaseGraph(token: string, knowledgeBaseId: string, options: GraphQueryOptions = {}) {
    return withFallback(
      async () =>
        normalizeGraph(
          await requestJson<unknown>(
            `/graph/knowledge-bases/${knowledgeBaseId}${buildGraphQuery(options)}`,
            {},
            token,
          ),
        ),
      async () => createEmptyGraph('knowledge_base'),
    );
  },
  documentGraph(token: string, documentId: string, options: GraphQueryOptions = {}) {
    return withFallback(
      async () =>
        normalizeGraph(
          await requestJson<unknown>(
            `/graph/documents/${documentId}${buildGraphQuery(options)}`,
            {},
            token,
          ),
        ),
      async () => createEmptyGraph('document'),
    );
  },
};
