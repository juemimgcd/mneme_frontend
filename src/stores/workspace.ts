import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '@/lib/api';
import type {
  ChatExchange,
  CompanionAnswerResult,
  DocumentDeleteResult,
  DocumentItem,
  GrowthAdviceResult,
  GrowthReport,
  KnowledgeBase,
  MemoryLibrary,
  MemoryRebuildResult,
  PersonalProfile,
  TaskRecord,
} from '@/lib/types';

export const useWorkspaceStore = defineStore('workspace', () => {
  const taskPollTimers = new Map<string, number>();
  const currentUserId = ref<number | null>(null);
  const knowledgeBases = ref<KnowledgeBase[]>([]);
  const documents = ref<DocumentItem[]>([]);
  const chats = ref<ChatExchange[]>([]);
  const memoryLibrary = ref<MemoryLibrary | null>(null);
  const profile = ref<PersonalProfile | null>(null);
  const growth = ref<GrowthReport | null>(null);
  const advice = ref<GrowthAdviceResult | null>(null);
  const companion = ref<CompanionAnswerResult | null>(null);
  const activeKnowledgeBaseId = ref<string>('');
  const loading = ref(false);
  const knowledgeRefreshLoading = ref(false);
  const memoryRebuildLoading = ref(false);
  const adviceLoading = ref(false);
  const companionLoading = ref(false);
  const lastMemoryRebuild = ref<MemoryRebuildResult | null>(null);
  const documentMemoryPreview = ref<MemoryLibrary | null>(null);
  const documentMemoryLoading = ref(false);
  const selectedDocumentId = ref<string>('');
  const taskRecords = ref<Record<string, TaskRecord>>({});

  const currentKnowledgeBase = computed(
    () => knowledgeBases.value.find((item) => item.id === activeKnowledgeBaseId.value) ?? null,
  );

  const filteredDocuments = computed(() =>
    activeKnowledgeBaseId.value
      ? documents.value.filter((item) => item.knowledge_base_id === activeKnowledgeBaseId.value)
      : documents.value,
  );

  const selectedDocument = computed(
    () => filteredDocuments.value.find((item) => item.id === selectedDocumentId.value) ?? null,
  );

  function mergeDocuments(nextDocuments: DocumentItem[], previousDocuments: DocumentItem[] = documents.value) {
    return nextDocuments.map((item) => {
      const previous = previousDocuments.find((doc) => doc.id === item.id);
      return {
        ...item,
        page_count: item.page_count || previous?.page_count || null,
        chunk_count: item.chunk_count || previous?.chunk_count || null,
        size_label: item.size_label !== '--' ? item.size_label : previous?.size_label || '--',
        task_id: item.task_id || previous?.task_id,
      };
    });
  }

  function clearTaskPolling(taskId: string) {
    const timer = taskPollTimers.get(taskId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      taskPollTimers.delete(taskId);
    }
  }

  function patchDocument(documentId: string, patch: Partial<DocumentItem>) {
    documents.value = documents.value.map((item) => (item.id === documentId ? { ...item, ...patch } : item));
  }

  function decorateKnowledgeBases(baseItems: KnowledgeBase[], documentItems: DocumentItem[]) {
    return baseItems.map((item) => {
      const relatedDocuments = documentItems.filter((doc) => doc.knowledge_base_id === item.id);
      const hasRunningTask = relatedDocuments.some((doc) =>
        ['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(doc.status),
      );
      return {
        ...item,
        document_count: relatedDocuments.length || item.document_count,
        memory_count:
          item.id === activeKnowledgeBaseId.value && memoryLibrary.value
            ? memoryLibrary.value.timeline.length
            : item.memory_count,
        updated_at:
          relatedDocuments[0]?.created_at ?? item.updated_at ?? item.created_at ?? new Date().toISOString(),
        status: hasRunningTask ? 'indexing' : item.is_default ? 'ready' : item.status,
      };
    });
  }

  async function refreshKnowledgeOutputs(token: string) {
    if (!activeKnowledgeBaseId.value) {
      return;
    }

    knowledgeRefreshLoading.value = true;
    try {
      const [nextMemory, nextProfile, nextGrowth] = await Promise.allSettled([
        api.memoryLibrary(token, activeKnowledgeBaseId.value),
        api.profile(token, activeKnowledgeBaseId.value),
        api.growth(token, activeKnowledgeBaseId.value),
      ]);

      if (nextMemory.status === 'fulfilled') {
        memoryLibrary.value = nextMemory.value;
      }

      if (nextProfile.status === 'fulfilled') {
        profile.value = nextProfile.value;
      }

      if (nextGrowth.status === 'fulfilled') {
        growth.value = nextGrowth.value;
      }

      knowledgeBases.value = decorateKnowledgeBases(knowledgeBases.value, documents.value);
    } finally {
      knowledgeRefreshLoading.value = false;
    }
  }

  async function refreshKnowledgeOutputsWithRetry(
    token: string,
    options: { attempts?: number; delayMs?: number } = {},
  ) {
    const attempts = options.attempts ?? 4;
    const delayMs = options.delayMs ?? 2000;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, delayMs));
      }

      try {
        await refreshKnowledgeOutputs(token);
        return;
      } catch (error) {
        if (attempt === attempts - 1) {
          console.warn('Unable to refresh memory outputs after indexing:', error);
        }
      }
    }
  }

  async function syncTaskStatus(token: string, taskId: string) {
    const task = await api.taskStatus(token, taskId);
    taskRecords.value = {
      ...taskRecords.value,
      [task.id]: task,
    };

    const documentId = task.target_id;
    if (documentId) {
      if (
        ['queued', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(task.status)
      ) {
        patchDocument(documentId, {
          task_id: task.id,
          status: task.status as DocumentItem['status'],
        });
      }

      if (['completed', 'failed', 'cancelled', 'canceled'].includes(task.status)) {
        clearTaskPolling(task.id);
        await refreshDocuments(token);

        if (task.status === 'completed') {
          patchDocument(documentId, { status: 'indexed' });
          void refreshKnowledgeOutputsWithRetry(token);
        }
      }
    }

    return task;
  }

  function startTaskPolling(token: string, taskId: string) {
    clearTaskPolling(taskId);

    const poll = async () => {
      try {
        const task = await syncTaskStatus(token, taskId);
        if (!['completed', 'failed', 'cancelled', 'canceled'].includes(task.status)) {
          const timer = window.setTimeout(poll, 2000);
          taskPollTimers.set(taskId, timer);
        }
      } catch (error) {
        console.warn('Unable to sync task status:', error);
        const timer = window.setTimeout(poll, 3000);
        taskPollTimers.set(taskId, timer);
      }
    };

    void poll();
  }

  async function rebuildKnowledgeMemory(token: string) {
    if (!activeKnowledgeBaseId.value) {
      throw new Error('请先选择知识库');
    }

    memoryRebuildLoading.value = true;
    try {
      lastMemoryRebuild.value = await api.memoryRebuild(token, activeKnowledgeBaseId.value);
      await refreshKnowledgeOutputs(token);
      return lastMemoryRebuild.value;
    } finally {
      memoryRebuildLoading.value = false;
    }
  }

  async function initialize(userId: number, token: string) {
    loading.value = true;
    try {
      currentUserId.value = userId;
      const baseItems = await api.knowledgeBases(userId, token);
      activeKnowledgeBaseId.value = activeKnowledgeBaseId.value || baseItems[0]?.id || '';
      documents.value = mergeDocuments(await api.documents(userId, token), documents.value);
      chats.value = await api.chatHistory();
      knowledgeBases.value = decorateKnowledgeBases(baseItems, documents.value);
      activeKnowledgeBaseId.value = activeKnowledgeBaseId.value || knowledgeBases.value[0]?.id || '';
      selectedDocumentId.value = selectedDocumentId.value || documents.value[0]?.id || '';

      for (const item of documents.value) {
        if (item.task_id) {
          startTaskPolling(token, item.task_id);
        }
      }

      if (activeKnowledgeBaseId.value) {
        await refreshKnowledgeOutputs(token);
      }
    } finally {
      loading.value = false;
    }
  }

  async function selectKnowledgeBase(knowledgeBaseId: string, token: string) {
    if (!currentUserId.value) {
      throw new Error('缺少当前用户上下文');
    }
    activeKnowledgeBaseId.value = knowledgeBaseId;
    advice.value = null;
    companion.value = null;
    documentMemoryPreview.value = null;
    selectedDocumentId.value =
      documents.value.find((item) => item.knowledge_base_id === knowledgeBaseId)?.id ?? '';
    await refreshKnowledgeOutputs(token);
  }

  async function createKnowledgeBase(
    payload: { name: string; description: string },
    userId: number,
    token: string,
  ) {
    const created = await api.createKnowledgeBase(userId, payload, token);
    currentUserId.value = userId;
    knowledgeBases.value.unshift(created);
    activeKnowledgeBaseId.value = created.id;
    return created;
  }

  async function refreshDocuments(token: string) {
    if (!currentUserId.value) {
      return;
    }
    documents.value = mergeDocuments(
      await api.documents(currentUserId.value, token, activeKnowledgeBaseId.value || undefined),
      documents.value,
    );
    if (!selectedDocument.value) {
      selectedDocumentId.value = filteredDocuments.value[0]?.id ?? '';
    }
    knowledgeBases.value = decorateKnowledgeBases(knowledgeBases.value, documents.value);
  }

  async function uploadDocuments(token: string, files: File[]) {
    if (!activeKnowledgeBaseId.value || !currentUserId.value) {
      throw new Error('请先选择知识库');
    }
    const uploaded = await api.uploadDocuments(token, currentUserId.value, activeKnowledgeBaseId.value, files);
    documents.value = [...uploaded, ...documents.value];
    selectedDocumentId.value = uploaded[0]?.id ?? selectedDocumentId.value;
    knowledgeBases.value = decorateKnowledgeBases(knowledgeBases.value, documents.value);
  }

  async function indexDocument(token: string, documentId: string) {
    const updated = await api.indexDocument(token, documentId);
    documents.value = documents.value.map((item) =>
      item.id === documentId
        ? {
            ...item,
            status: updated.status,
            task_id: updated.task_id || item.task_id,
          }
        : item,
    );
    knowledgeBases.value = decorateKnowledgeBases(knowledgeBases.value, documents.value);
    if (updated.task_id) {
      startTaskPolling(token, updated.task_id);
    }
  }

  async function cancelDocumentTask(token: string, taskId: string) {
    const result = await api.cancelTask(token, taskId);
    taskRecords.value = {
      ...taskRecords.value,
      [result.task_id]: {
        ...(taskRecords.value[result.task_id] ?? {
          id: result.task_id,
          task_type: 'document_index',
          target_id: result.document_id ?? '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: null,
        }),
        status: result.status,
        updated_at: new Date().toISOString(),
      },
    };
    clearTaskPolling(taskId);
    await refreshDocuments(token);
    return result;
  }

  async function retryDocumentTask(token: string, taskId: string) {
    const result = await api.retryTask(token, taskId);
    if (result.document_id) {
      patchDocument(result.document_id, {
        task_id: result.task_id,
        status: 'queued',
      });
    }
    startTaskPolling(token, result.task_id);
    return result;
  }

  async function deleteDocument(token: string, documentId: string) {
    const result = (await api.deleteDocument(token, documentId)) as DocumentDeleteResult;
    documents.value = documents.value.filter((item) => item.id !== documentId);
    if (selectedDocumentId.value === documentId) {
      selectedDocumentId.value = filteredDocuments.value[0]?.id ?? '';
      documentMemoryPreview.value = null;
    }
    knowledgeBases.value = decorateKnowledgeBases(knowledgeBases.value, documents.value);
    return result;
  }

  async function loadDocumentMemory(token: string, documentId: string) {
    selectedDocumentId.value = documentId;
    documentMemoryLoading.value = true;
    try {
      documentMemoryPreview.value = await api.documentMemoryLibrary(token, documentId);
      return documentMemoryPreview.value;
    } finally {
      documentMemoryLoading.value = false;
    }
  }

  async function ask(token: string, payload: { question: string; topK: number }) {
    if (!activeKnowledgeBaseId.value || !currentUserId.value) {
      throw new Error('请先选择知识库');
    }
    const exchange = await api.chatQuery(token, {
      userId: currentUserId.value,
      knowledgeBaseId: activeKnowledgeBaseId.value,
      question: payload.question,
      topK: payload.topK,
    });
    chats.value = [exchange, ...chats.value];
  }

  async function generateAdvice(token: string, focusGoal?: string) {
    if (!activeKnowledgeBaseId.value) {
      throw new Error('Please select a knowledge base first');
    }

    adviceLoading.value = true;
    try {
      advice.value = await api.advice(token, activeKnowledgeBaseId.value, focusGoal);
      return advice.value;
    } finally {
      adviceLoading.value = false;
    }
  }

  async function askCompanion(token: string, payload: { question: string; topK: number }) {
    if (!activeKnowledgeBaseId.value) {
      throw new Error('Please select a knowledge base first');
    }

    companionLoading.value = true;
    try {
      companion.value = await api.companionReply(
        token,
        activeKnowledgeBaseId.value,
        payload.question,
        payload.topK,
      );
      return companion.value;
    } finally {
      companionLoading.value = false;
    }
  }

  return {
    knowledgeBases,
    documents,
    chats,
    memoryLibrary,
    profile,
    growth,
    advice,
    companion,
    activeKnowledgeBaseId,
    loading,
    knowledgeRefreshLoading,
    memoryRebuildLoading,
    adviceLoading,
    companionLoading,
    lastMemoryRebuild,
    documentMemoryPreview,
    documentMemoryLoading,
    selectedDocumentId,
    selectedDocument,
    taskRecords,
    currentKnowledgeBase,
    filteredDocuments,
    initialize,
    selectKnowledgeBase,
    createKnowledgeBase,
    refreshDocuments,
    refreshKnowledgeOutputs,
    rebuildKnowledgeMemory,
    uploadDocuments,
    indexDocument,
    cancelDocumentTask,
    retryDocumentTask,
    deleteDocument,
    loadDocumentMemory,
    syncTaskStatus,
    ask,
    generateAdvice,
    askCompanion,
  };
});
