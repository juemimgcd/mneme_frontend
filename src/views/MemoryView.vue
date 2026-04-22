<script setup lang="ts">
import { computed, ref } from 'vue';
import EmptyState from '@/components/common/EmptyState.vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import MemoryConstellation from '@/components/memory/MemoryConstellation.vue';
import TimelineList from '@/components/memory/TimelineList.vue';
import type { MemoryGraphFocus } from '@/components/memory/types';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const session = useSessionStore();
const workspace = useWorkspaceStore();
const drawerOpen = ref(false);
const selectedFocus = ref<MemoryGraphFocus | null>(null);

const totalEntries = computed(() => workspace.memoryLibrary?.timeline.length ?? 0);
const themeCount = computed(() => workspace.memoryLibrary?.by_theme.length ?? 0);
const typeCount = computed(() => Object.keys(workspace.memoryLibrary?.by_type ?? {}).length);
const latestEntryDate = computed(() => {
  const latest = [...(workspace.memoryLibrary?.timeline ?? [])].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  )[0];
  if (!latest) {
    return 'Waiting';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(latest.created_at));
});

const focusTitle = computed(() => selectedFocus.value?.label ?? 'Atlas overview');
const focusSummary = computed(
  () =>
    selectedFocus.value?.summary ??
    'Select a node in the graph to inspect related notes, themes, and entry context.',
);
const focusCount = computed(() => selectedFocus.value?.count ?? totalEntries.value);

async function rebuildMemory() {
  if (!session.token) {
    return;
  }
  await workspace.rebuildKnowledgeMemory(session.token);
}

function handleFocusChange(value: MemoryGraphFocus | null) {
  selectedFocus.value = value;
}

function openDrawer() {
  drawerOpen.value = true;
}

function closeDrawer() {
  drawerOpen.value = false;
}
</script>

<template>
  <div class="view-stack memory-page">
    <div class="memory-page__header">
      <SectionHeader
        eyebrow="Graph View"
        title="Memory graph."
        description="An Obsidian-inspired graph for browsing extracted notes, themes, and knowledge base connections."
      />

      <div class="memory-page__actions">
        <button class="ghost-button memory-page__utility" type="button" @click="openDrawer">
          Open Sidebar
        </button>
        <button
          class="primary-button memory-page__utility"
          type="button"
          :disabled="workspace.memoryRebuildLoading"
          @click="rebuildMemory"
        >
          {{ workspace.memoryRebuildLoading ? 'Rebuilding...' : 'Rebuild Graph' }}
        </button>
      </div>
    </div>

    <SurfacePanel eyebrow="Linked Notes" title="Graph canvas">
      <div class="memory-stage-shell">
        <MemoryConstellation
          v-if="workspace.memoryLibrary"
          :library="workspace.memoryLibrary"
          :knowledge-bases="workspace.knowledgeBases"
          :active-knowledge-base-id="workspace.activeKnowledgeBaseId"
          @focus-change="handleFocusChange"
          @request-rail="openDrawer"
        />
        <EmptyState
          v-else
          title="No extracted notes yet"
          description="Once processing finishes, this stage will fill with the memory graph."
        />
      </div>
    </SurfacePanel>

    <div v-if="drawerOpen" class="memory-drawer__backdrop" @click="closeDrawer" />
    <aside class="memory-drawer" :data-open="drawerOpen">
      <div class="memory-drawer__panel">
        <div class="memory-drawer__header">
          <div>
            <p class="memory-drawer__eyebrow">Right Sidebar</p>
            <h2>Linked context</h2>
          </div>
          <button class="ghost-button memory-page__utility" type="button" @click="closeDrawer">Close</button>
        </div>

        <div class="memory-drawer__content">
          <article class="context-card memory-drawer__summary">
            <header class="knowledge-card__header">
              <strong>{{ focusTitle }}</strong>
              <span class="inline-badge">{{ focusCount }}</span>
            </header>
            <p>{{ focusSummary }}</p>
          </article>

          <div class="memory-drawer__stats">
            <article class="context-card memory-drawer__stat">
              <strong>{{ totalEntries }}</strong>
              <span>Notes</span>
            </article>
            <article class="context-card memory-drawer__stat">
              <strong>{{ themeCount }}</strong>
              <span>Themes</span>
            </article>
            <article class="context-card memory-drawer__stat">
              <strong>{{ typeCount }}</strong>
              <span>Types</span>
            </article>
            <article class="context-card memory-drawer__stat">
              <strong>{{ latestEntryDate }}</strong>
              <span>Latest</span>
            </article>
          </div>

          <article v-if="workspace.lastMemoryRebuild" class="growth-card memory-drawer__summary">
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

          <TimelineList
            v-if="workspace.memoryLibrary"
            :library="workspace.memoryLibrary"
            :focus="selectedFocus"
            sidebar
          />
          <EmptyState
            v-else
            title="No extracted notes yet"
            description="The sidebar will show notebook detail after note extraction finishes."
          />
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.memory-page {
  gap: var(--space-5);
}

.memory-page__header {
  display: flex;
  justify-content: space-between;
  gap: var(--space-5);
  align-items: end;
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--app-line);
}

.memory-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.memory-page__utility {
  white-space: nowrap;
}

.memory-stage-shell {
  min-height: min(78vh, 900px);
}

.memory-drawer__backdrop {
  position: fixed;
  inset: 0;
  z-index: 35;
  background: rgba(38, 32, 25, 0.24);
  backdrop-filter: blur(3px);
}

.memory-drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  width: min(460px, 92vw);
  pointer-events: none;
}

.memory-drawer__panel {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  width: 100%;
  height: 100%;
  padding: 1.15rem;
  border-left: 1px solid var(--app-line);
  background:
    linear-gradient(180deg, rgba(255, 252, 246, 0.94), transparent 20%),
    var(--app-paper-strong);
  box-shadow: -18px 0 42px rgba(72, 59, 43, 0.14);
  transform: translateX(104%);
  transition: transform 240ms ease;
  pointer-events: auto;
}

.memory-drawer[data-open='true'] .memory-drawer__panel {
  transform: translateX(0);
}

.memory-drawer__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
  padding-bottom: 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--app-line) 78%, transparent);
}

.memory-drawer__eyebrow {
  margin: 0;
  color: var(--app-ink-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.memory-drawer__header h2 {
  margin: 0.2rem 0 0;
  color: var(--app-ink);
  font-family: var(--app-font-display);
  font-size: 1.3rem;
  font-weight: 500;
}

.memory-drawer__content {
  display: grid;
  gap: 0.9rem;
  align-content: start;
  overflow-y: auto;
  padding-top: 1rem;
}

.memory-drawer__summary {
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 74%),
    var(--app-panel);
}

.memory-drawer__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.memory-drawer__stat {
  display: grid;
  gap: 0.25rem;
  padding: 0.95rem 1rem;
  border-radius: 16px;
}

.memory-drawer__stat strong {
  color: var(--app-ink);
  font-family: var(--app-font-display);
  font-size: 1.25rem;
  font-weight: 500;
}

.memory-drawer__stat span {
  color: var(--app-ink-muted);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

@media (max-width: 900px) {
  .memory-page__header {
    align-items: stretch;
    flex-direction: column;
  }

  .memory-stage-shell {
    min-height: 68vh;
  }
}
</style>
