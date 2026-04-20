<script setup lang="ts">
import { computed, reactive } from 'vue';
import SectionHeader from '@/components/common/SectionHeader.vue';
import SurfacePanel from '@/components/common/SurfacePanel.vue';
import KnowledgeBaseGrid from '@/components/knowledge/KnowledgeBaseGrid.vue';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const session = useSessionStore();
const workspace = useWorkspaceStore();
const form = reactive({
  name: '',
  description: '',
});
const runningCount = computed(
  () =>
    workspace.filteredDocuments.filter((item) =>
      ['queued', 'indexing', 'parsing', 'chunking', 'embedding', 'vector_upserting'].includes(item.status),
    ).length,
);
const latestTask = computed(() => {
  const taskIds = workspace.filteredDocuments
    .map((item) => item.task_id)
    .filter((item): item is string => Boolean(item));

  return taskIds
    .map((id) => workspace.taskRecords[id])
    .filter(Boolean)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0] ?? null;
});
const focusItems = computed(() =>
  workspace.profile?.growth_focus.slice(0, 4) ??
  workspace.growth?.recent_focus.slice(0, 4) ??
  [],
);

async function createKnowledgeBase() {
  if (!session.user || !session.token) {
    return;
  }
  await workspace.createKnowledgeBase(form, session.user.id, session.token);
  form.name = '';
  form.description = '';
}

async function selectKnowledgeBase(id: string) {
  if (!session.token) {
    return;
  }
  await workspace.selectKnowledgeBase(id, session.token);
}
</script>

<template>
  <div class="view-stack">
    <SectionHeader
      eyebrow="Collections"
      title="Shape the library."
      description="Create collections, switch between them, and keep the active shelf in view."
    />

    <section class="collections-layout">
      <SurfacePanel eyebrow="Create" title="Add a collection">
        <form class="inline-form inline-form--dense" @submit.prevent="createKnowledgeBase">
          <label>
            <span>Name</span>
            <input v-model="form.name" maxlength="24" required />
          </label>
          <label>
            <span>Description</span>
            <input v-model="form.description" maxlength="120" required />
          </label>
          <button class="primary-button" type="submit">Create</button>
        </form>
      </SurfacePanel>

      <SurfacePanel eyebrow="Active" title="Open collection">
        <div v-if="workspace.currentKnowledgeBase" class="collections-panel collections-panel--dense">
          <article class="context-card collection-row collection-row--summary">
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
                <dd>{{ workspace.memoryLibrary?.timeline.length ?? workspace.currentKnowledgeBase.memory_count }}</dd>
              </div>
            </dl>
          </article>

          <article class="growth-card collection-row">
            <header>
              <strong>Queue</strong>
              <span class="growth-card__trend" :data-trend="runningCount ? 'steady' : 'up'">
                {{ runningCount }}
              </span>
            </header>
            <p>{{ runningCount ? 'New material is still being processed for this shelf.' : 'No active processing right now.' }}</p>
          </article>

          <article v-if="latestTask" class="growth-card collection-row">
            <header>
              <strong>Latest update</strong>
              <span class="growth-card__trend" data-trend="steady">{{ latestTask.status }}</span>
            </header>
            <p>{{ new Date(latestTask.updated_at).toLocaleString('en-US') }}</p>
          </article>

          <article v-if="workspace.profile" class="context-card collection-row">
            <strong>Profile</strong>
            <p>{{ workspace.profile.profile_summary }}</p>
          </article>

          <article v-if="focusItems.length" class="context-card collection-row">
            <strong>Focus</strong>
            <div class="chip-wrap">
              <span v-for="item in focusItems" :key="item" class="memory-chip">{{ item }}</span>
            </div>
          </article>
        </div>
      </SurfacePanel>
    </section>

    <SurfacePanel eyebrow="All Collections" title="Shelf">
      <KnowledgeBaseGrid
        :active-id="workspace.activeKnowledgeBaseId"
        :items="workspace.knowledgeBases"
        @select="selectKnowledgeBase"
      />
    </SurfacePanel>
  </div>
</template>
