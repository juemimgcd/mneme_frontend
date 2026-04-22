<script setup lang="ts">
import { computed } from 'vue';
import ActivityFeed from '@/components/dashboard/ActivityFeed.vue';
import MetricCard from '@/components/common/MetricCard.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import { useWorkspaceStore } from '@/stores/workspace';
import type { ActivityItem, DashboardMetric } from '@/lib/types';

const workspace = useWorkspaceStore();

const pendingCount = computed(
  () =>
    workspace.filteredDocuments.filter((item) =>
      ['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(item.status),
    ).length,
);

const lastExchange = computed(() => workspace.chats[0] ?? null);
const latestTheme = computed(() => workspace.profile?.main_themes[0] ?? null);
const latestStage = computed(() => workspace.growth?.stage_summary ?? '');
const memoryCount = computed(() => workspace.memoryLibrary?.timeline.length ?? 0);
const latestTask = computed(() =>
  Object.values(workspace.taskRecords)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null,
);
const completedTasks = computed(
  () =>
    Object.values(workspace.taskRecords).filter((item) => item.status === 'completed').length,
);
const failedTasks = computed(
  () =>
    Object.values(workspace.taskRecords).filter((item) =>
      ['failed', 'cancelled', 'canceled'].includes(item.status),
    ).length,
);

function formatTimestamp(value?: string) {
  if (!value) {
    return '--';
  }
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const dashboardMetrics = computed<DashboardMetric[]>(() => [
  {
    label: 'Open Shelf',
    value: String(workspace.knowledgeBases.length),
    change: workspace.currentKnowledgeBase?.name ?? 'No active collection',
    tone: 'teal',
  },
  {
    label: 'Indexed',
    value: String(
      workspace.filteredDocuments.filter((item) => item.status === 'indexed').length,
    ),
    change: `${memoryCount.value} notes extracted`,
    tone: 'indigo',
  },
  {
    label: 'Activity',
    value: pendingCount.value ? String(pendingCount.value) : String(completedTasks.value),
    change: pendingCount.value
      ? 'Documents are still processing'
      : failedTasks.value
        ? `${failedTasks.value} need review`
        : lastExchange.value
          ? `Latest conversation ${formatTimestamp(lastExchange.value.created_at)}`
          : 'Quiet workspace',
    tone: pendingCount.value || failedTasks.value ? 'coral' : 'teal',
  },
]);

const activityItems = computed<ActivityItem[]>(() => {
  const items: ActivityItem[] = [];

  if (latestTask.value) {
    items.push({
      id: `task_${latestTask.value.id}`,
      title: `Task ${latestTask.value.status}`,
      detail: `Latest index task for ${latestTask.value.target_id}.`,
      timestamp: formatTimestamp(latestTask.value.updated_at),
      tone: ['failed', 'cancelled', 'canceled'].includes(latestTask.value.status)
        ? 'coral'
        : latestTask.value.status === 'completed'
          ? 'teal'
          : 'indigo',
    });
  }

  if (workspace.lastMemoryRebuild) {
    items.push({
      id: `memory_${workspace.lastMemoryRebuild.knowledge_base_id}_${workspace.lastMemoryRebuild.entry_count}`,
      title: 'Notes refreshed',
      detail: `${workspace.lastMemoryRebuild.entry_count} entries across ${workspace.lastMemoryRebuild.processed_document_count} docs.`,
      timestamp: 'Just now',
      tone: 'indigo',
    });
  }

  const latestDocument = [...workspace.filteredDocuments].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  if (latestDocument) {
    items.push({
      id: `doc_${latestDocument.id}`,
      title: latestDocument.name,
      detail: `${latestDocument.status} · ${latestDocument.file_type?.toUpperCase() || 'FILE'}`,
      timestamp: formatTimestamp(latestDocument.created_at),
      tone: latestDocument.status === 'indexed' ? 'teal' : latestDocument.status === 'failed' ? 'coral' : 'indigo',
    });
  }

  if (lastExchange.value) {
    items.push({
      id: `chat_${lastExchange.value.id}`,
      title: 'Latest conversation',
      detail: lastExchange.value.question,
      timestamp: formatTimestamp(lastExchange.value.created_at),
      tone: 'indigo',
    });
  }

  if (workspace.profile) {
    items.push({
      id: `profile_${workspace.profile.knowledge_base_id}`,
      title: 'Reading profile',
      detail: workspace.profile.profile_summary,
      timestamp: workspace.growth?.analysis_window || 'Live',
      tone: 'teal',
    });
  }

  return items.slice(0, 5);
});
</script>

<template>
  <div class="view-stack">
    <SectionHeader
      eyebrow="Workspace Ledger"
      title="Read the room before you begin."
      description="A stable overview of the current collection: source readiness, extracted memory, recent movement, and the strongest reading signals."
    />

    <section class="metric-grid workspace-metric-grid">
      <MetricCard
        v-for="metric in dashboardMetrics"
        :key="metric.label"
        :change="metric.change"
        :label="metric.label"
        :tone="metric.tone"
        :value="metric.value"
      />
    </section>

    <section class="workspace-editorial" aria-label="Current collection and recent activity">
      <SurfacePanel eyebrow="Open Shelf" title="Current collection">
        <div v-if="workspace.currentKnowledgeBase" class="workspace-editorial__split">
          <article class="context-card workspace-editorial__lead">
            <span class="workspace-editorial__index">Active collection</span>
            <header class="knowledge-card__header">
              <strong>{{ workspace.currentKnowledgeBase.name }}</strong>
              <span class="status-pill" :data-status="workspace.currentKnowledgeBase.status">
                {{ workspace.currentKnowledgeBase.status }}
              </span>
            </header>
            <p>{{ workspace.currentKnowledgeBase.description }}</p>
            <dl class="context-card__meta">
              <div>
                <dt>Docs</dt>
                <dd>{{ workspace.currentKnowledgeBase.document_count }}</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>{{ memoryCount }}</dd>
              </div>
            </dl>
          </article>

          <aside class="workspace-ledger" aria-label="Collection signals">
            <article class="growth-card workspace-ledger__row">
              <header>
                <strong>Processing queue</strong>
                <span class="growth-card__trend" :data-trend="pendingCount ? 'steady' : 'up'">
                  {{ pendingCount }}
                </span>
              </header>
              <p>{{ pendingCount ? 'New material is still being processed.' : 'Everything is up to date.' }}</p>
            </article>

            <article class="growth-card workspace-ledger__row">
              <header>
                <strong>Latest conversation</strong>
                <span class="growth-card__trend" data-trend="up">
                  {{ lastExchange?.sources.length ?? 0 }}
                </span>
              </header>
              <p>{{ lastExchange?.question ?? 'No conversation yet.' }}</p>
            </article>

            <article class="growth-card workspace-ledger__row">
              <header>
                <strong>Dominant theme</strong>
                <span class="growth-card__trend" data-trend="up">
                  {{ latestTheme ? 'Live' : '--' }}
                </span>
              </header>
              <p>{{ latestTheme?.theme_name ?? 'No clear theme yet.' }}</p>
            </article>
          </aside>
        </div>
        <div v-else class="workspace-empty-note">
          <strong>No collection selected</strong>
          <p>Create or select a collection to begin building the workspace view.</p>
        </div>
      </SurfacePanel>

      <SurfacePanel eyebrow="Change Log" title="Recent movement">
        <ActivityFeed :items="activityItems" />
      </SurfacePanel>
    </section>

    <SurfacePanel eyebrow="Reading Line" title="What the notes are pointing to">
      <div class="reading-note-list workspace-reading-grid">
        <article class="growth-card growth-card--feature reading-note-row workspace-reading-grid__lead">
          <header>
            <strong>Stage</strong>
            <span class="growth-card__trend" data-trend="up">
              {{ workspace.growth?.analysis_window ?? 'Pending' }}
            </span>
          </header>
          <p>{{ latestStage || 'No summary has been generated yet.' }}</p>
        </article>

        <article v-if="workspace.profile" class="context-card reading-note-row">
          <strong>Profile</strong>
          <p>{{ workspace.profile.profile_summary }}</p>
        </article>

        <article v-if="workspace.profile?.growth_focus.length" class="context-card reading-note-row">
          <strong>Focus</strong>
          <div class="chip-wrap">
            <span
              v-for="item in workspace.profile.growth_focus"
              :key="item"
              class="memory-chip"
            >
              {{ item }}
            </span>
          </div>
        </article>
      </div>
    </SurfacePanel>
  </div>
</template>

<style scoped>
.workspace-editorial {
  display: grid;
  grid-template-columns: minmax(0, 1.32fr) minmax(21rem, 0.82fr);
  gap: var(--space-5);
  align-items: stretch;
}

.workspace-metric-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.workspace-editorial__split {
  display: grid;
  grid-template-columns: minmax(0, 1.08fr) minmax(18rem, 0.92fr);
  gap: var(--space-5);
  align-items: stretch;
}

.workspace-editorial__lead {
  position: relative;
  min-height: 22rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
}

.workspace-editorial__lead::after {
  content: '';
  position: absolute;
  right: -3.5rem;
  bottom: -4rem;
  width: 14rem;
  height: 14rem;
  border: 1px solid rgba(47, 73, 104, 0.12);
  border-radius: 999px;
  background:
    linear-gradient(135deg, transparent 0 47%, rgba(47, 73, 104, 0.1) 47% 49%, transparent 49%),
    rgba(109, 135, 155, 0.06);
}

.workspace-editorial__lead > * {
  position: relative;
  z-index: 1;
}

.workspace-editorial__index {
  width: fit-content;
  margin-bottom: var(--space-5);
  color: var(--app-ink-muted);
  font-family: var(--app-font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.workspace-editorial__lead strong {
  font-family: var(--app-font-display);
  font-size: clamp(1.75rem, 2.6vw, 3rem);
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 1;
}

.workspace-ledger,
.workspace-reading-grid {
  display: grid;
  gap: var(--space-4);
}

.workspace-ledger {
  align-content: stretch;
}

.workspace-ledger__row {
  display: grid;
  gap: var(--space-3);
  min-height: 0;
}

.workspace-ledger__row header {
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--app-line);
}

.workspace-ledger__row strong {
  font-size: 1rem;
}

.workspace-ledger__row p,
.reading-note-row p {
  line-height: var(--lh-relaxed);
}

.workspace-reading-grid {
  grid-template-columns: minmax(0, 1.2fr) repeat(2, minmax(0, 0.9fr));
  align-items: stretch;
}

.workspace-reading-grid__lead {
  min-height: 100%;
}

.workspace-reading-grid__lead p {
  font-size: 1.02rem;
}

.reading-note-row {
  display: grid;
  gap: var(--space-3);
  align-content: start;
}

.workspace-empty-note {
  min-height: 15rem;
  display: grid;
  place-content: center;
  gap: var(--space-2);
  padding: var(--space-6);
  border: 1px dashed var(--app-line-strong);
  border-radius: var(--radius-lg);
  color: var(--app-ink-soft);
  text-align: center;
}

.workspace-empty-note strong {
  color: var(--app-ink);
  font-family: var(--app-font-display);
  font-size: 1.35rem;
}

.workspace-empty-note p {
  margin: 0;
}

@media (max-width: 1100px) {
  .workspace-editorial,
  .workspace-editorial__split,
  .workspace-reading-grid,
  .workspace-metric-grid {
    grid-template-columns: 1fr;
  }
}
</style>
