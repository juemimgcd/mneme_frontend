<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import AppIcon from '@/components/common/AppIcon.vue';
import { mergeQuery, readQueryString } from '@/lib/route-query';
import { useTheme } from '@/composables/useTheme';
import { useSessionStore } from '@/stores/session';
import { useWorkspaceStore } from '@/stores/workspace';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const workspace = useWorkspaceStore();
const { theme, toggleTheme } = useTheme();

const navigation = [
  { name: 'dashboard', label: 'Overview', icon: 'vault' as const },
  { name: 'knowledge-bases', label: 'Collections', icon: 'spark' as const },
  { name: 'documents', label: 'Ingest', icon: 'upload' as const },
  { name: 'chat', label: 'Retrieve', icon: 'chat' as const },
  { name: 'graph', label: 'Graph', icon: 'graph' as const },
  { name: 'memory', label: 'Memory', icon: 'memory' as const },
  { name: 'insights', label: 'Signals', icon: 'insight' as const },
];

const routeTitle = computed(() => {
  const current = navigation.find((item) => item.name === route.name);
  return current?.label ?? 'Workspace';
});

const indexedCount = computed(
  () => workspace.filteredDocuments.filter((item) => item.status === 'indexed').length,
);
const pendingCount = computed(
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
const memoryCount = computed(() => workspace.memoryLibrary?.timeline.length ?? 0);
const focusItems = computed(() =>
  workspace.profile?.growth_focus.slice(0, 2) ??
  workspace.growth?.recent_focus.slice(0, 2) ??
  [],
);
const appQuery = computed(() =>
  workspace.activeKnowledgeBaseId ? { kb: workspace.activeKnowledgeBaseId } : {},
);

onMounted(async () => {
  if (session.user && session.token && !workspace.knowledgeBases.length) {
    await workspace.initialize(session.user.id, session.token);
  }

  const queryKnowledgeBaseId = readQueryString(route.query, 'kb');
  if (
    session.token &&
    queryKnowledgeBaseId &&
    workspace.knowledgeBases.some((item) => item.id === queryKnowledgeBaseId) &&
    workspace.activeKnowledgeBaseId !== queryKnowledgeBaseId
  ) {
    await workspace.selectKnowledgeBase(queryKnowledgeBaseId, session.token);
  }
});

watch(
  () => [session.token, route.query.kb, workspace.knowledgeBases.length] as const,
  async ([token]) => {
    if (!token || !workspace.knowledgeBases.length) {
      return;
    }

    const queryKnowledgeBaseId = readQueryString(route.query, 'kb');
    if (
      queryKnowledgeBaseId &&
      workspace.knowledgeBases.some((item) => item.id === queryKnowledgeBaseId) &&
      workspace.activeKnowledgeBaseId !== queryKnowledgeBaseId
    ) {
      await workspace.selectKnowledgeBase(queryKnowledgeBaseId, token);
    }
  },
);

watch(
  () => workspace.activeKnowledgeBaseId,
  async (knowledgeBaseId) => {
    const currentQueryKnowledgeBaseId = readQueryString(route.query, 'kb');
    if (!knowledgeBaseId || currentQueryKnowledgeBaseId === knowledgeBaseId) {
      return;
    }

    await router.replace({
      path: route.path,
      query: mergeQuery(route.query, { kb: knowledgeBaseId }),
    });
  },
);

async function handleKnowledgeBaseChange(event: Event) {
  const nextId = (event.target as HTMLSelectElement).value;
  if (session.token) {
    await workspace.selectKnowledgeBase(nextId, session.token);
  }
}

async function refreshKnowledgeOutputs() {
  if (!session.token) {
    return;
  }
  await workspace.refreshKnowledgeOutputs(session.token);
}

function logout() {
  session.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="app-shell">
    <aside class="app-sidebar" aria-label="Primary navigation">
      <RouterLink class="brandmark" :to="{ name: 'dashboard' }">
        <span class="brandmark__glyph">M</span>
        <span>
          <strong>Mneme</strong>
          <small>RAG Workspace</small>
        </span>
      </RouterLink>

      <div class="app-sidebar__note">
        <p class="app-sidebar__caption">RAG memory workspace.</p>
      </div>

      <nav class="app-nav">
        <RouterLink
          v-for="item in navigation"
          :key="item.name"
          class="app-nav__link"
          :to="{ name: item.name, query: appQuery }"
        >
          <AppIcon :name="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>

      <div class="app-sidebar__footer">
        <p class="app-sidebar__caption">
          Active KB:
          <strong>{{ workspace.currentKnowledgeBase?.name ?? 'None selected' }}</strong>
        </p>
        <p class="app-sidebar__caption">
          Indexed:
          <strong>{{ indexedCount }}</strong>
          / {{ workspace.filteredDocuments.length }} docs
        </p>
      </div>
    </aside>

    <div class="app-shell__content">
      <header class="app-topbar">
        <div>
          <p class="app-topbar__eyebrow">RAG Memory Workspace</p>
          <h1 class="app-topbar__title">{{ routeTitle }}</h1>
          <div class="app-topbar__status">
            <span v-if="workspace.currentKnowledgeBase" class="status-pill" :data-status="workspace.currentKnowledgeBase.status">
              {{ workspace.currentKnowledgeBase.status }}
            </span>
            <span class="memory-chip">Indexed {{ indexedCount }}/{{ workspace.filteredDocuments.length }}</span>
            <span class="memory-chip">Memory {{ memoryCount }}</span>
            <span v-if="pendingCount" class="memory-chip">Queue {{ pendingCount }}</span>
            <span v-if="latestTask" class="memory-chip">Task {{ latestTask.status }}</span>
            <span v-for="item in focusItems" :key="item" class="memory-chip">{{ item }}</span>
          </div>
        </div>

        <div class="app-topbar__actions">
          <label class="kb-switcher">
            <span>Knowledge Context</span>
            <select
              :value="workspace.activeKnowledgeBaseId"
              aria-label="Switch knowledge base"
              @change="handleKnowledgeBaseChange"
            >
              <option
                v-for="item in workspace.knowledgeBases"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select>
          </label>

          <button class="ghost-button" type="button" @click="toggleTheme">
            <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
            <span>{{ theme === 'dark' ? 'Light' : 'Dark' }}</span>
          </button>

          <button
            class="ghost-button"
            type="button"
            :disabled="workspace.knowledgeRefreshLoading"
            @click="refreshKnowledgeOutputs"
          >
            <AppIcon name="refresh" />
            <span>{{ workspace.knowledgeRefreshLoading ? 'Refreshing' : 'Refresh' }}</span>
          </button>

          <button class="ghost-button" type="button" @click="logout">
            <span>{{ session.user?.username ?? 'Sign out' }}</span>
          </button>
        </div>
      </header>

      <main id="app-main" class="app-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>
