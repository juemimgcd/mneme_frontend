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
      title="Memory layer."
      description="Read extracted entries, clusters, and rebuild state."
    />

    <section class="memory-overview">
      <SurfacePanel eyebrow="Rebuild" title="Memory extraction">
        <div class="memory-overview__hero">
          <article class="context-card workspace-overview__feature">
            <header class="knowledge-card__header">
              <strong>Current layer</strong>
              <span class="inline-badge">{{ totalEntries }} entries</span>
            </header>
            <p>
              {{ themeCount }} themes · {{ typeCount }} types
            </p>
          </article>

          <div class="memory-overview__rail">
            <button
              class="primary-button"
              type="button"
              :disabled="workspace.memoryRebuildLoading"
              @click="rebuildMemory"
            >
              {{ workspace.memoryRebuildLoading ? 'Rebuilding...' : 'Rebuild Memory' }}
            </button>

            <article v-if="workspace.lastMemoryRebuild" class="growth-card">
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

      <SurfacePanel eyebrow="Timeline" title="Memory view">
        <TimelineList v-if="workspace.memoryLibrary" :library="workspace.memoryLibrary" />
        <EmptyState
          v-else
          title="Memory is empty"
          description="Once indexing and extraction are available, this view will show a structured timeline."
        />
      </SurfacePanel>
    </section>
  </div>
</template>
