<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DocumentsTable from '@/components/documents/DocumentsTable.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import UploadZone from '@/components/documents/UploadZone.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import { mergeQuery, readQueryString } from '@/lib/route-query';
import type { KnowledgeBase } from '@/lib/types';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();
const uploadLoading = ref(false);
const uploadResetKey = ref(0);

const indexedCount = computed(
  () => workspace.filteredDocuments.filter((item) => item.status === 'indexed').length,
);
const pendingCount = computed(
  () =>
    workspace.filteredDocuments.filter((item) =>
      ['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(item.status),
    ).length,
);
const uploadShelf = computed<KnowledgeBase | null>(
  () => workspace.currentKnowledgeBase ?? workspace.knowledgeBases[0] ?? null,
);

async function onUpload(payload: { files: File[]; knowledgeBaseId: string; autoIndex: boolean }) {
  if (!session.token) {
    return;
  }

  uploadLoading.value = true;
  try {
    const uploaded = await workspace.uploadDocuments(session.token, payload.files, payload.knowledgeBaseId);
    if (payload.autoIndex) {
      await Promise.all(uploaded.map((item) => workspace.indexDocument(session.token as string, item.id)));
    }
    uploadResetKey.value += 1;
  } finally {
    uploadLoading.value = false;
  }
}

async function onIndex(documentId: string) {
  if (!session.token) {
    return;
  }
  await workspace.indexDocument(session.token, documentId);
}

async function onCancel(taskId: string) {
  if (!session.token) {
    return;
  }
  await workspace.cancelDocumentTask(session.token, taskId);
}

async function onRetry(taskId: string) {
  if (!session.token) {
    return;
  }
  await workspace.retryDocumentTask(session.token, taskId);
}

async function onDelete(documentId: string) {
  if (!session.token) {
    return;
  }
  await workspace.deleteDocument(session.token, documentId);
}

async function inspectDocument(documentId: string) {
  if (!session.token) {
    return;
  }
  await workspace.loadDocumentMemory(session.token, documentId);
}

async function refreshSignals() {
  if (!session.token) {
    return;
  }
  await workspace.refreshKnowledgeOutputs(session.token);
}

async function rebuildMemory() {
  if (!session.token) {
    return;
  }
  await workspace.rebuildKnowledgeMemory(session.token);
}

async function openGraphForDocument(documentId: string) {
  await router.push({
    name: 'graph',
    query: mergeQuery(route.query, {
      kb: workspace.activeKnowledgeBaseId || undefined,
      scope: 'document',
      graphDoc: documentId,
      doc: documentId,
    }),
  });
}

watch(
  () => [session.token, workspace.filteredDocuments.map((item) => item.id).join('|'), route.query.doc] as const,
  async ([token]) => {
    if (!token) {
      return;
    }

    const queryDocumentId = readQueryString(route.query, 'doc');
    const fallbackDocumentId = workspace.filteredDocuments[0]?.id ?? '';
    const targetId =
      queryDocumentId && workspace.filteredDocuments.some((item) => item.id === queryDocumentId)
        ? queryDocumentId
        : workspace.selectedDocumentId || fallbackDocumentId;

    if (!targetId) {
      return;
    }
    if (
      workspace.documentMemoryPreview &&
      workspace.selectedDocumentId === targetId &&
      queryDocumentId === targetId
    ) {
      return;
    }
    await workspace.loadDocumentMemory(token, targetId);
  },
  { immediate: true },
);

watch(
  () => workspace.selectedDocumentId,
  async (documentId) => {
    const currentDocumentId = readQueryString(route.query, 'doc');
    if ((documentId || '') === currentDocumentId) {
      return;
    }

    await router.replace({
      path: route.path,
      query: mergeQuery(route.query, { doc: documentId || undefined }),
    });
  },
);
</script>

<template>
  <div class="view-stack documents-page">
    <SectionHeader
      eyebrow="Library"
      title="Bring new material into the notebook."
      description="Upload files, process them, and preview the notes extracted from each document."
    />

    <section class="library-ingest-grid documents-page__ingest">
      <SurfacePanel eyebrow="Upload" title="Add files">
        <UploadZone
          :knowledge-bases="workspace.knowledgeBases"
          :active-knowledge-base-id="workspace.activeKnowledgeBaseId"
          :loading="uploadLoading"
          :reset-key="uploadResetKey"
          @upload="onUpload"
        />
      </SurfacePanel>

      <SurfacePanel eyebrow="Status" title="Processing snapshot">
        <div class="growth-stack library-status-list">
          <article v-if="uploadShelf" class="theme-card library-status-row library-status-row--hero">
            <header>
              <strong>{{ uploadShelf.name }}</strong>
              <span class="status-pill" :data-status="uploadShelf.status">
                {{ uploadShelf.status }}
              </span>
            </header>
            <p>
              {{ uploadShelf.description || 'The current shelf is ready for new source material and note extraction.' }}
            </p>
          </article>

          <article class="growth-card library-status-row">
            <header>
              <strong>Ready to use</strong>
              <span class="growth-card__trend" data-trend="up">
                {{ indexedCount }} docs
              </span>
            </header>
            <p>Processed files are already available in search, notes, and citations.</p>
          </article>

          <article class="growth-card library-status-row">
            <header>
              <strong>On this shelf</strong>
              <span class="growth-card__trend" data-trend="steady">
                {{ workspace.filteredDocuments.length }} docs
              </span>
            </header>
            <p>Everything currently attached to the selected collection.</p>
          </article>

          <article class="growth-card library-status-row">
            <header>
              <strong>Processing queue</strong>
              <span class="growth-card__trend" :data-trend="pendingCount ? 'steady' : 'up'">
                {{ pendingCount }} pending
              </span>
            </header>
            <p>Refresh to update notes and summaries, or rebuild memory for a full pass.</p>
          </article>
        </div>
      </SurfacePanel>
    </section>

    <SurfacePanel eyebrow="Notebook Outputs" title="Notes and review">
      <div class="chat-composer__footer review-toolbar">
        <button
          class="ghost-button"
          type="button"
          :disabled="workspace.knowledgeRefreshLoading"
          @click="refreshSignals"
        >
          {{ workspace.knowledgeRefreshLoading ? 'Refreshing...' : 'Refresh Notes' }}
        </button>

        <button
          class="primary-button"
          type="button"
          :disabled="workspace.memoryRebuildLoading"
          @click="rebuildMemory"
        >
          {{ workspace.memoryRebuildLoading ? 'Rebuilding...' : 'Rebuild Notes' }}
        </button>

        <p v-if="workspace.lastMemoryRebuild" class="section-header__description">
          Last rebuild: {{ workspace.lastMemoryRebuild.processed_document_count }} docs,
          {{ workspace.lastMemoryRebuild.entry_count }} entries,
          {{ workspace.lastMemoryRebuild.deleted_entry_count }} replaced.
        </p>
      </div>
    </SurfacePanel>

    <section class="documents-layout documents-page__review">
      <SurfacePanel eyebrow="Queue" title="Document list">
        <DocumentsTable
          :items="workspace.filteredDocuments"
          :selected-id="workspace.selectedDocumentId"
          :task-records="workspace.taskRecords"
          @index="onIndex"
          @cancel="onCancel"
          @retry="onRetry"
          @delete="onDelete"
          @inspect="inspectDocument"
        />
      </SurfacePanel>

      <SurfacePanel eyebrow="Preview" title="Document notes">
        <div v-if="workspace.selectedDocument" class="documents-preview documents-preview--dense">
          <article class="context-card document-note-row document-note-row--summary">
            <header class="knowledge-card__header">
              <strong>{{ workspace.selectedDocument.name }}</strong>
              <span class="status-pill" :data-status="workspace.selectedDocument.status">
                {{ workspace.selectedDocument.status }}
              </span>
            </header>
            <p>{{ workspace.selectedDocument.file_type?.toUpperCase() || 'FILE' }} · {{ workspace.selectedDocument.size_label }}</p>
            <div class="graph-actions">
              <button
                class="ghost-button"
                type="button"
                @click="openGraphForDocument(workspace.selectedDocument.id)"
              >
                View on Canvas
              </button>
            </div>
          </article>

          <article v-if="workspace.documentMemoryLoading" class="context-card document-note-row">
            <strong>Loading</strong>
            <p>Fetching note preview...</p>
          </article>

          <template v-else-if="workspace.documentMemoryPreview">
            <article class="context-card document-note-row">
              <strong>Entries</strong>
              <p>{{ workspace.documentMemoryPreview.timeline.length }} extracted items</p>
            </article>

            <article
              v-for="entry in workspace.documentMemoryPreview.timeline.slice(0, 4)"
              :key="entry.entry_id"
              class="theme-card document-note-row"
            >
              <header class="knowledge-card__header">
                <strong>{{ entry.entry_name }}</strong>
                <span class="inline-badge">{{ entry.entry_type }}</span>
              </header>
              <p>{{ entry.summary }}</p>
            </article>

            <article v-if="workspace.documentMemoryPreview.by_theme.length" class="context-card document-note-row">
              <strong>Themes</strong>
              <div class="chip-wrap">
                <span
                  v-for="theme in workspace.documentMemoryPreview.by_theme"
                  :key="theme.theme_name"
                  class="memory-chip"
                >
                  {{ theme.theme_name }} · {{ theme.count }}
                </span>
              </div>
            </article>
          </template>

          <EmptyState
            v-else
            title="No notes yet"
            description="Select a document after processing to inspect the notes extracted from it."
          />
        </div>

        <EmptyState
          v-else
          title="No document selected"
          description="Choose a document from the list to inspect its status and extracted notes."
        />
      </SurfacePanel>
    </section>
  </div>
</template>

<style scoped>
.library-ingest-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.38fr) minmax(21rem, 0.82fr);
  gap: var(--space-5);
  align-items: stretch;
}

.library-status-row--hero {
  min-height: 12rem;
  background:
    radial-gradient(circle at top right, rgba(47, 73, 104, 0.1), transparent 32%),
    linear-gradient(145deg, rgba(255, 252, 246, 0.92), rgba(240, 245, 247, 0.58)),
    var(--app-panel-solid);
}

.library-status-list,
.documents-preview--dense {
  display: grid;
  gap: var(--space-4);
}

.library-status-row,
.document-note-row {
  display: grid;
  gap: var(--space-3);
  align-content: start;
}

.library-status-row header,
.document-note-row header {
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--app-line);
}

.document-note-row--summary strong {
  font-family: var(--app-font-display);
  font-size: clamp(1.2rem, 1.4vw, 1.65rem);
  letter-spacing: -0.03em;
}

.review-toolbar {
  justify-content: flex-start;
}

.review-toolbar .section-header__description {
  flex: 1 1 24rem;
  margin: 0;
}

@media (max-width: 1040px) {
  .library-ingest-grid {
    grid-template-columns: 1fr;
  }
}
</style>
