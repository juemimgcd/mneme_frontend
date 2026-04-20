<script setup lang="ts">
import { computed } from 'vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import TimelineList from '@/components/memory/TimelineList.vue';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const session = useSessionStore();
const workspace = useWorkspaceStore();
const totalEntries = computed(() => workspace.memoryLibrary?.timeline.length ?? 0);
const themeCount = computed(() => workspace.memoryLibrary?.by_theme.length ?? 0);
const typeCount = computed(() => Object.keys(workspace.memoryLibrary?.by_type ?? {}).length);

async function rebuildMemory() {
  if (!session.token) {
    return;
  }
  await workspace.rebuildKnowledgeMemory(session.token);
}
</script>

<template>
  <div class="view-stack">
    <SectionHeader
      eyebrow="Memory"
      title="Extracted notes."
      description="Read what the notebook has pulled out, grouped by time, theme, and type."
    />

    <section class="memory-overview">
      <SurfacePanel eyebrow="Rebuild" title="Note extraction">
        <div class="memory-overview__hero memory-overview__hero--dense">
          <article class="context-card workspace-overview__feature memory-summary-row">
            <header class="knowledge-card__header">
              <strong>Current layer</strong>
              <span class="inline-badge">{{ totalEntries }} entries</span>
            </header>
            <p>
              {{ themeCount }} themes · {{ typeCount }} types
            </p>
          </article>

          <div class="memory-note-list">
            <button
              class="primary-button"
              type="button"
              :disabled="workspace.memoryRebuildLoading"
              @click="rebuildMemory"
            >
              {{ workspace.memoryRebuildLoading ? 'Rebuilding...' : 'Rebuild Notes' }}
            </button>

            <article v-if="workspace.lastMemoryRebuild" class="growth-card memory-summary-row">
              <header>
                <strong>Latest rebuild</strong>
                <span class="growth-card__trend" data-trend="up">
                  {{ workspace.lastMemoryRebuild.entry_count }}
                </span>
              </header>
              <p>
                {{ workspace.lastMemoryRebuild.processed_document_count }} docs processed ·
                {{ workspace.lastMemoryRebuild.deleted_entry_count }} replaced
              </p>
            </article>
          </div>
        </div>
      </SurfacePanel>

      <SurfacePanel eyebrow="Timeline" title="Notebook memory">
        <TimelineList v-if="workspace.memoryLibrary" :library="workspace.memoryLibrary" />
        <EmptyState
          v-else
          title="No extracted notes yet"
          description="Once processing finishes, this view will show a structured timeline of notes."
        />
      </SurfacePanel>
    </section>
  </div>
</template>
