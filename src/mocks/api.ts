import type {
  AuthPayload,
  PersonalProfile,
  AuthToken,
  ChatExchange,
  CompanionAnswerResult,
  ChatSource,
  DocumentItem,
  GrowthAdviceResult,
  GrowthReport,
  KnowledgeBase,
  MemoryLibrary,
  TaskActionResult,
  TaskRecord,
  User,
} from '@/lib/types';
import {
  chatHistory,
  demoToken,
  demoUser,
  documents,
  companionAnswer,
  growthAdvice,
  growthMetrics,
  knowledgeBases,
  memoryLibrary,
  profileInsights,
  taskRecords,
} from '@/mocks/data';

const wait = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

const kbState = [...knowledgeBases];
const documentState = [...documents];
const chatState = [...chatHistory];
const taskState = [...taskRecords];

export async function mockRegister(payload: AuthPayload): Promise<User> {
  await wait();
  return {
    ...demoUser,
    username: payload.username,
  };
}

export async function mockLogin(_: AuthPayload): Promise<AuthToken> {
  await wait();
  return demoToken;
}

export async function mockMe(): Promise<User> {
  await wait();
  return demoUser;
}

export async function mockKnowledgeBases(): Promise<KnowledgeBase[]> {
  await wait();
  return kbState;
}

export async function mockCreateKnowledgeBase(payload: {
  name: string;
  description: string;
}): Promise<KnowledgeBase> {
  await wait();
  const created: KnowledgeBase = {
    id: `kb_${Math.random().toString(36).slice(2, 10)}`,
    user_id: 1,
    name: payload.name,
    description: payload.description,
    is_default: false,
    created_at: new Date().toISOString(),
    document_count: 0,
    memory_count: 0,
    updated_at: new Date().toISOString(),
    status: 'draft',
  };
  kbState.unshift(created);
  return created;
}

export async function mockDocuments(knowledgeBaseId?: string): Promise<DocumentItem[]> {
  await wait();
  if (!knowledgeBaseId) {
    return documentState;
  }
  return documentState.filter((item) => item.knowledge_base_id === knowledgeBaseId);
}

export async function mockUploadDocuments(
  userId: number,
  knowledgeBaseId: string,
  files: File[],
): Promise<DocumentItem[]> {
  await wait(300);
  const uploaded = files.map((file, index) => ({
    id: `doc_upload_${Date.now()}_${index}`,
    user_id: userId,
    file_name: file.name,
    name: file.name,
    knowledge_base_id: knowledgeBaseId,
    file_type: file.name.split('.').pop() ?? '',
    status: 'uploaded' as const,
    page_count: Math.max(1, Math.round(file.size / 48000)),
    chunk_count: 0,
    created_at: new Date().toISOString(),
    size_label: `${Math.max(1, Math.round(file.size / 1024))} KB`,
  }));

  uploaded.forEach((item) => documentState.unshift(item));
  return uploaded;
}

export async function mockIndexDocument(documentId: string): Promise<{
  task_id: string;
  document_id: string;
  knowledge_base_id: string;
  status: DocumentItem['status'];
  message: string;
}> {
  await wait(350);
  const target = documentState.find((item) => item.id === documentId);
  if (!target) {
    throw new Error('Document not found');
  }

  const taskId = target.task_id || `task_${Date.now()}`;
  target.status = 'queued';
  target.task_id = taskId;
  taskState.unshift({
    id: taskId,
    task_type: 'document_index',
    target_id: target.id,
    status: 'queued',
    error_message: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return {
    task_id: taskId,
    document_id: target.id,
    knowledge_base_id: target.knowledge_base_id,
    status: 'queued',
    message: 'index task submitted',
  };
}

export async function mockChatQuery(payload: {
  knowledgeBaseId: string;
  question: string;
}): Promise<ChatExchange> {
  await wait(280);
  const relatedDocument =
    documentState.find(
      (item) => item.knowledge_base_id === payload.knowledgeBaseId && item.status === 'indexed',
    ) ?? documentState[0];

  const sources: ChatSource[] = [
    {
      knowledge_base_id: payload.knowledgeBaseId,
      document_id: relatedDocument.id,
      chunk_id: `${relatedDocument.id}_chunk_01..${relatedDocument.id}_chunk_02`,
      page_no: null,
      text: '检索结果显示，最近材料反复提到“长期记忆系统”“写作即索引”“让知识能被再次调用”。',
      source_chunk_ids: [`${relatedDocument.id}_chunk_01`, `${relatedDocument.id}_chunk_02`],
      source_page_nos: [1, 2],
      merged_chunk_count: 2,
    },
  ];

  const exchange: ChatExchange = {
    id: `chat_${Date.now()}`,
    question: payload.question,
    answer:
      '基于当前知识库，系统更倾向把你的内容生产视为“持续提炼记忆的过程”，而不是一次性完成的文档归档。前端中我会把这个过程拆成上传、索引、检索、主题聚合和分析回看五个可见阶段。',
    sources,
    created_at: new Date().toISOString(),
  };

  chatState.unshift(exchange);
  return exchange;
}

export async function mockChatHistory(): Promise<ChatExchange[]> {
  await wait();
  return chatState;
}

export async function mockMemoryLibrary(): Promise<MemoryLibrary> {
  await wait();
  return memoryLibrary;
}

export async function mockProfile(): Promise<PersonalProfile> {
  await wait();
  return profileInsights;
}

export async function mockGrowth(): Promise<GrowthReport> {
  await wait();
  return growthMetrics;
}

export async function mockAdvice(focusGoal?: string): Promise<GrowthAdviceResult> {
  await wait();
  return {
    ...growthAdvice,
    focus_goal: focusGoal ?? growthAdvice.focus_goal,
  };
}

export async function mockCompanionReply(payload: {
  question: string;
  topK: number;
}): Promise<CompanionAnswerResult> {
  await wait(260);
  return {
    ...companionAnswer,
    question: payload.question,
    citations: companionAnswer.citations.slice(
      0,
      Math.max(1, Math.min(payload.topK, companionAnswer.citations.length)),
    ),
  };
}

export async function mockTaskStatus(taskId: string): Promise<TaskRecord> {
  await wait();
  const task = taskState.find((item) => item.id === taskId);
  if (!task) {
    throw new Error('Task not found');
  }

  if (task.status === 'queued') {
    task.status = 'parsing';
  } else if (task.status === 'parsing') {
    task.status = 'chunking';
  } else if (task.status === 'chunking') {
    task.status = 'embedding';
  } else if (task.status === 'embedding') {
    task.status = 'vector_upserting';
  } else if (task.status === 'vector_upserting') {
    task.status = 'completed';
    const doc = documentState.find((item) => item.id === task.target_id);
    if (doc) {
      doc.status = 'indexed';
      doc.chunk_count = doc.chunk_count || 24;
    }
  }

  task.updated_at = new Date().toISOString();
  return { ...task };
}

export async function mockCancelTask(taskId: string): Promise<TaskActionResult> {
  await wait();
  const task = taskState.find((item) => item.id === taskId);
  if (task) {
    task.status = 'cancelled';
    task.updated_at = new Date().toISOString();
    const doc = documentState.find((item) => item.id === task.target_id);
    if (doc) {
      doc.status = 'uploaded';
    }
  }
  return {
    task_id: taskId,
    status: 'cancelled',
    document_id: task?.target_id ?? null,
    message: 'task canceled',
  };
}

export async function mockRetryTask(taskId: string): Promise<TaskActionResult> {
  await wait();
  const task = taskState.find((item) => item.id === taskId);
  if (task) {
    task.status = 'queued';
    task.updated_at = new Date().toISOString();
    const doc = documentState.find((item) => item.id === task.target_id);
    if (doc) {
      doc.status = 'queued';
    }
  }
  return {
    task_id: taskId,
    status: 'queued',
    document_id: task?.target_id ?? null,
    message: 'task retried',
  };
}

export async function mockDeleteDocument(documentId: string) {
  await wait();
  const index = documentState.findIndex((item) => item.id === documentId);
  const [removed] = index >= 0 ? documentState.splice(index, 1) : [];
  return {
    document_id: documentId,
    knowledge_base_id: removed?.knowledge_base_id ?? '',
    chunk_count: removed?.chunk_count ?? 0,
    deleted_memory_entry_count: 0,
    deleted_task_count: taskState.filter((item) => item.target_id === documentId).length,
    deleted_vector_count: removed?.chunk_count ?? 0,
  };
}

export async function mockDocumentMemoryLibrary(documentId: string): Promise<MemoryLibrary> {
  await wait();
  return {
    timeline: memoryLibrary.timeline.map((item, index) => ({
      ...item,
      entry_id: `${documentId}_${index}`,
    })),
    by_type: memoryLibrary.by_type,
    by_theme: memoryLibrary.by_theme,
  };
}
