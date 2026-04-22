<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { gsap } from 'gsap';
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
  { name: 'dashboard', label: 'Desk', icon: 'vault' as const },
  { name: 'knowledge-bases', label: 'Collections', icon: 'spark' as const },
  { name: 'documents', label: 'Library', icon: 'upload' as const },
  { name: 'chat', label: 'Notes', icon: 'chat' as const },
  { name: 'graph', label: 'Canvas', icon: 'graph' as const },
  { name: 'memory', label: 'Memory', icon: 'memory' as const },
  { name: 'insights', label: 'Review', icon: 'insight' as const },
];

const navigationGroups = computed(() => [
  {
    title: 'Workspace',
    items: navigation.slice(0, 4),
  },
  {
    title: 'Analysis',
    items: navigation.slice(4),
  },
]);

const routeTitle = computed(() => {
  const current = navigation.find((item) => item.name === route.name);
  return current?.label ?? 'Notebook';
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
const memoryCount = computed(() => workspace.memoryLibrary?.timeline.length ?? 0);
const appQuery = computed(() =>
  workspace.activeKnowledgeBaseId ? { kb: workspace.activeKnowledgeBaseId } : {},
);
const displayedTags = computed(() =>
  Array.isArray(workspace.profile?.growth_focus)
    ? workspace.profile.growth_focus.slice(0, 4)
    : navigation.slice(1, 5).map((item) => item.label),
);
const searchKeyword = ref('');
const normalizedSearchKeyword = computed(() => searchKeyword.value.trim().toLowerCase());
const filteredKnowledgeBases = computed(() =>
  workspace.knowledgeBases.filter((item) => {
    if (!normalizedSearchKeyword.value) {
      return true;
    }
    return `${item.name} ${item.description}`.toLowerCase().includes(normalizedSearchKeyword.value);
  }),
);
const filteredDocuments = computed(() =>
  workspace.filteredDocuments
    .filter((item) => {
      if (!normalizedSearchKeyword.value) {
        return true;
      }
      return `${item.name} ${item.status}`.toLowerCase().includes(normalizedSearchKeyword.value);
    })
    .slice(0, 8),
);

let shellReveal: gsap.core.Timeline | null = null;
const shellElement = ref<HTMLElement | null>(null);

function runPageReveal({ includeSidebar = false }: { includeSidebar?: boolean } = {}) {
  if (document.documentElement.classList.contains('reduced-motion')) {
    return;
  }

  const shell = shellElement.value;
  if (!shell) {
    return;
  }

  shellReveal?.kill();
  shellReveal = gsap.timeline({
    defaults: { duration: 0.28, ease: 'power2.out' },
  });

  if (includeSidebar) {
    shellReveal.from(shell.querySelector('.app-sidebar'), {
      x: -14,
      opacity: 0,
      filter: 'blur(4px)',
      clearProps: 'transform,opacity,filter',
    });
    shellReveal.from(
      shell.querySelectorAll('.app-nav__link'),
      {
        x: -8,
        opacity: 0,
        stagger: 0.03,
        duration: 0.22,
        clearProps: 'transform,opacity',
      },
      '-=0.16',
    );
  }

  shellReveal.from(
    shell.querySelectorAll('.app-topbar, .app-list-column, .app-main .view-stack'),
    {
      y: 12,
      opacity: 0,
      filter: 'blur(4px)',
      stagger: 0.05,
      clearProps: 'transform,opacity,filter',
    },
    includeSidebar ? '-=0.08' : 0,
  );
  shellReveal.from(
    shell.querySelectorAll('.app-main .surface-panel, .app-main .metric-card, .app-main .context-card, .app-main .growth-card'),
    {
      y: 10,
      opacity: 0,
      filter: 'blur(3px)',
      stagger: 0.025,
      duration: 0.22,
      clearProps: 'transform,opacity,filter',
    },
    '-=0.12',
  );
}

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

  await nextTick();
  runPageReveal({ includeSidebar: true });
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

onBeforeUnmount(() => {
  shellReveal?.kill();
});

async function selectKnowledgeBase(id: string) {
  if (session.token) {
    await workspace.selectKnowledgeBase(id, session.token);
  }
}

function openDocumentsView() {
  router.push({
    name: 'documents',
    query: appQuery.value,
  });
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
  <div ref="shellElement" class="app-shell">
    <aside class="app-sidebar" aria-label="Primary navigation">
      <RouterLink class="brandmark" :to="{ name: 'dashboard' }">
        <span class="brandmark__glyph">M</span>
        <span>
          <strong>Mneme</strong>
          <small>Workspace</small>
        </span>
      </RouterLink>

      <nav class="app-nav" aria-label="Main sections">
        <section
          v-for="group in navigationGroups"
          :key="group.title"
          class="app-nav-group"
        >
          <p class="app-sidebar__caption">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.name"
            class="app-nav__link"
            :to="{ name: item.name, query: appQuery }"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <section class="app-sidebar__footer" aria-label="Tags">
        <p class="app-sidebar__caption">Tags</p>
        <div class="app-tag-list">
          <span v-for="tag in displayedTags" :key="tag" class="memory-chip">{{ tag }}</span>
        </div>
      </section>
    </aside>

    <div class="app-shell__content">
      <header class="app-topbar app-topbar--clean">
        <h1 class="app-topbar__title">{{ routeTitle }}</h1>

        <label class="app-topbar__search" for="workspace-search">
          <input
            id="workspace-search"
            v-model="searchKeyword"
            type="search"
            aria-label="Search collections or files"
            placeholder="Search collections or files"
          />
        </label>

        <div class="app-topbar__actions app-topbar__actions--compact">
          <button
            class="ghost-button"
            type="button"
            :aria-label="`Switch theme to ${theme === 'dark' ? 'light' : 'dark'}`"
            @click="toggleTheme"
          >
            <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
          </button>
          <button
            class="ghost-button"
            type="button"
            aria-label="Refresh workspace data"
            :disabled="workspace.knowledgeRefreshLoading"
            @click="refreshKnowledgeOutputs"
          >
            <AppIcon name="refresh" />
          </button>
          <button class="ghost-button ghost-button--danger" type="button" @click="logout">Sign out</button>
        </div>
      </header>

      <div class="app-layout">
        <section class="app-list-column" aria-label="Collections and files">
          <article class="surface-panel app-list-panel">
            <header class="surface-panel__header app-list-panel__header">
              <h2 class="surface-panel__title">Collections</h2>
              <span class="memory-chip">{{ filteredKnowledgeBases.length }}</span>
            </header>
            <div class="app-card-list">
              <button
                v-for="item in filteredKnowledgeBases"
                :key="item.id"
                class="app-list-card"
                :data-active="workspace.activeKnowledgeBaseId === item.id"
                :aria-label="`Select collection: ${item.name}${workspace.activeKnowledgeBaseId === item.id ? ' (currently active)' : ''}`"
                type="button"
                @click="selectKnowledgeBase(item.id)"
              >
                <strong>{{ item.name }}</strong>
                <span class="app-list-card__meta">{{ item.document_count }} docs</span>
              </button>
            </div>
          </article>

          <article class="surface-panel app-list-panel">
            <header class="surface-panel__header app-list-panel__header">
              <h2 class="surface-panel__title">Recent files</h2>
              <button class="ghost-button" type="button" aria-label="Open documents view" @click="openDocumentsView">View all</button>
            </header>
            <ul class="app-mini-list">
              <li v-for="item in filteredDocuments" :key="item.id">
                <strong>{{ item.name }}</strong>
                <span class="status-pill" :data-status="item.status">{{ item.status }}</span>
              </li>
            </ul>
            <p v-if="!filteredDocuments.length" class="app-list-empty">
              {{ normalizedSearchKeyword ? 'No matching files' : 'No files yet' }}
            </p>
          </article>

          <article class="surface-panel app-list-panel app-list-panel--stats">
            <div class="app-stat-grid">
              <div>
                <span>Indexed</span>
                <strong>{{ indexedCount }}</strong>
              </div>
              <div>
                <span>Pending</span>
                <strong>{{ pendingCount }}</strong>
              </div>
              <div>
                <span>Memory</span>
                <strong>{{ memoryCount }}</strong>
              </div>
            </div>
          </article>
        </section>

        <main id="app-main" class="app-main app-main--editor">
          <RouterView v-slot="{ Component, route: nestedRoute }">
            <Transition name="shell-view" mode="out-in">
              <component :is="Component" :key="nestedRoute.fullPath" />
            </Transition>
          </RouterView>
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-sidebar {
  gap: 1rem;
}

.app-nav-group {
  display: grid;
  gap: 0.2rem;
}

.app-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.app-shell__content {
  display: grid;
  gap: 0.95rem;
  align-content: start;
}

.app-topbar--clean {
  display: grid;
  grid-template-columns: auto minmax(16rem, 1fr) auto;
  gap: 0.7rem;
  align-items: center;
}

.app-topbar__title {
  margin: 0;
  font-size: clamp(1.35rem, 1.9vw, 1.95rem);
}

.app-topbar__search input {
  width: 100%;
  min-height: 40px;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--app-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--app-panel) 88%, transparent);
  color: var(--app-ink);
}

.app-topbar__actions--compact .ghost-button {
  min-height: 40px;
  min-width: 40px;
  padding: 0.5rem 0.7rem;
  border-radius: 10px;
}

.app-layout {
  display: grid;
  grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
  gap: 0.95rem;
  align-items: start;
}

.app-list-column {
  display: grid;
  gap: 0.95rem;
  position: sticky;
  top: 1.2rem;
}

.app-list-panel {
  padding: 0.85rem;
}

.app-list-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.app-card-list {
  display: grid;
  gap: 0.45rem;
}

.app-list-card {
  text-align: left;
  display: grid;
  gap: 0.15rem;
  width: 100%;
  padding: 0.6rem 0.65rem;
  border: 1px solid var(--app-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--app-panel) 86%, transparent);
  color: var(--app-ink);
}

.app-list-card[data-active='true'] {
  border-color: color-mix(in srgb, var(--app-accent) 40%, transparent);
  background: color-mix(in srgb, var(--app-accent) 16%, var(--app-panel));
}

.app-list-card__meta,
.app-list-empty {
  color: var(--app-ink-soft);
  font-size: 0.85rem;
}

.app-mini-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
}

.app-mini-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.app-stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.app-stat-grid span {
  display: block;
  color: var(--app-ink-soft);
  font-size: 0.75rem;
}

.app-stat-grid strong {
  font-size: 1.25rem;
}

.app-main--editor {
  padding-top: 0;
  min-width: 0;
}

@media (max-width: 1240px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .app-list-column {
    position: static;
  }
}

@media (max-width: 840px) {
  .app-topbar--clean {
    grid-template-columns: 1fr;
  }
}
</style>
