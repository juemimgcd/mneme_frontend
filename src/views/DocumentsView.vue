<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DocumentsTable from '@/components/documents/DocumentsTable.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import UploadZone from '@/components/documents/UploadZone.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import { mergeQuery, readQueryString } from '@/lib/route-query';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();

const indexedCount = computed(
  () => workspace.filteredDocuments.filter((item) => item.status === 'indexed').length,
);
const pendingCount = computed(
  () =>
    workspace.filteredDocuments.filter((item) =>
      ['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(item.status),
    ).length,
);

async function onUpload(files: File[]) {
  if (!session.token) {
    return;
  }
  await workspace.uploadDocuments(session.token, files);
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
  <div class="view-stack">
    <SectionHeader
      eyebrow="Ingest"
      title="Run documents through the pipeline."
      description="Upload, index, inspect task state, and preview extracted memory per document."
    />

    <section class="dashboard-grid">
      <SurfacePanel eyebrow="Upload" title="Add files">
        <UploadZone @upload="onUpload" />
      </SurfacePanel>

      <SurfacePanel eyebrow="Status" title="Pipeline snapshot">
        <div class="growth-stack">
          <article class="growth-card">
            <header>
              <strong>Retrievable</strong>
              <span class="growth-card__trend" data-trend="up">
                {{ indexedCount }} docs
              </span>
            </header>
            <p>Indexed files can already participate in retrieval and citation output.</p>
          </article>

          <article class="growth-card">
            <header>
              <strong>Total in context</strong>
              <span class="growth-card__trend" data-trend="steady">
                {{ workspace.filteredDocuments.length }} docs
              </span>
            </header>
            <p>Everything currently attached to the selected collection.</p>
          </article>

          <article class="growth-card">
            <header>
              <strong>Pipeline queue</strong>
              <span class="growth-card__trend" :data-trend="pendingCount ? 'steady' : 'up'">
                {{ pendingCount }} pending
              </span>
            </header>
            <p>Use refresh for latest memory/profile/growth, or rebuild memory for a full extraction rerun.</p>
          </article>
        </div>
      </SurfacePanel>
    </section>

    <SurfacePanel eyebrow="Knowledge Outputs" title="Memory and signals">
      <div class="chat-composer__footer">
        <button
          class="ghost-button"
          type="button"
          :disabled="workspace.knowledgeRefreshLoading"
          @click="refreshSignals"
        >
          {{ workspace.knowledgeRefreshLoading ? 'Refreshing...' : 'Refresh Outputs' }}
        </button>

        <button
          class="primary-button"
          type="button"
          :disabled="workspace.memoryRebuildLoading"
          @click="rebuildMemory"
        >
          {{ workspace.memoryRebuildLoading ? 'Rebuilding...' : 'Rebuild Memory' }}
        </button>

        <p v-if="workspace.lastMemoryRebuild" class="section-header__description">
          Last rebuild: {{ workspace.lastMemoryRebuild.processed_document_count }} docs,
          {{ workspace.lastMemoryRebuild.entry_count }} entries,
          {{ workspace.lastMemoryRebuild.deleted_entry_count }} replaced.
        </p>
      </div>
    </SurfacePanel>

    <section class="documents-layout">
      <SurfacePanel eyebrow="Queue" title="Index queue">
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

      <SurfacePanel eyebrow="Preview" title="Document memory">
        <div v-if="workspace.selectedDocument" class="documents-preview">
          <article class="context-card">
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
                View in Graph
              </button>
            </div>
          </article>

          <article v-if="workspace.documentMemoryLoading" class="context-card">
            <strong>Loading</strong>
            <p>Fetching memory preview...</p>
          </article>

          <template v-else-if="workspace.documentMemoryPreview">
            <article class="context-card">
              <strong>Entries</strong>
              <p>{{ workspace.documentMemoryPreview.timeline.length }} extracted items</p>
            </article>

            <article
              v-for="entry in workspace.documentMemoryPreview.timeline.slice(0, 4)"
              :key="entry.entry_id"
              class="theme-card"
            >
              <header class="knowledge-card__header">
                <strong>{{ entry.entry_name }}</strong>
                <span class="inline-badge">{{ entry.entry_type }}</span>
              </header>
              <p>{{ entry.summary }}</p>
            </article>

            <article v-if="workspace.documentMemoryPreview.by_theme.length" class="context-card">
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
            title="No document memory yet"
            description="Select a document after indexing to inspect its extracted memory."
          />
        </div>

        <EmptyState
          v-else
          title="No document selected"
          description="Choose a document from the queue to inspect task state and memory output."
        />
      </SurfacePanel>
    </section>
  </div>
</template>
