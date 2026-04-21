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
const appQuery = computed(() =>
  workspace.activeKnowledgeBaseId ? { kb: workspace.activeKnowledgeBaseId } : {},
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
    shell.querySelectorAll('.app-topbar, .app-main .view-stack'),
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
  <div ref="shellElement" class="app-shell">
    <aside class="app-sidebar" aria-label="Primary navigation">
      <RouterLink class="brandmark" :to="{ name: 'dashboard' }">
        <span class="brandmark__glyph">M</span>
        <span>
          <strong>Mneme</strong>
          <small>Notebook</small>
        </span>
      </RouterLink>

      <div class="app-sidebar__note">
        <p class="app-sidebar__caption">Collections, notes, and reading in one quiet workspace.</p>
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
          Open shelf:
          <strong>{{ workspace.currentKnowledgeBase?.name ?? 'None selected' }}</strong>
        </p>
        <p class="app-sidebar__caption">
          Ready:
          <strong>{{ indexedCount }}</strong>
          / {{ workspace.filteredDocuments.length }} docs
        </p>
      </div>
    </aside>

    <div class="app-shell__content">
      <header class="app-topbar">
        <div>
          <p class="app-topbar__eyebrow">Knowledge Notebook</p>
          <h1 class="app-topbar__title">{{ routeTitle }}</h1>
          <div class="app-topbar__status">
            <span v-if="workspace.currentKnowledgeBase" class="status-pill" :data-status="workspace.currentKnowledgeBase.status">
              {{ workspace.currentKnowledgeBase.status }}
            </span>
            <span class="memory-chip">{{ indexedCount }} indexed of {{ workspace.filteredDocuments.length }}</span>
            <span class="memory-chip">Notes {{ memoryCount }}</span>
            <span v-if="pendingCount" class="memory-chip">{{ pendingCount }} processing</span>
            <span v-else-if="latestTask" class="memory-chip">Latest {{ latestTask.status }}</span>
          </div>
        </div>

        <div class="app-topbar__actions">
          <label class="kb-switcher app-topbar__switcher">
            <span>Shelf</span>
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

          <details class="app-utility-menu">
            <summary class="ghost-button app-utility-menu__trigger">
              <span>{{ session.user?.username ?? 'Workspace' }}</span>
              <AppIcon name="arrow" />
            </summary>

            <div class="app-utility-menu__content">
              <button class="app-utility-menu__action" type="button" @click="toggleTheme">
                <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
                <span>Switch to {{ theme === 'dark' ? 'light' : 'dark' }}</span>
              </button>

              <button
                class="app-utility-menu__action"
                type="button"
                :disabled="workspace.knowledgeRefreshLoading"
                @click="refreshKnowledgeOutputs"
              >
                <AppIcon name="refresh" />
                <span>{{ workspace.knowledgeRefreshLoading ? 'Refreshing workspace' : 'Refresh workspace' }}</span>
              </button>

              <button
                class="app-utility-menu__action app-utility-menu__action--danger"
                type="button"
                @click="logout"
              >
                <span>Sign out</span>
              </button>
            </div>
          </details>
        </div>
      </header>

      <main id="app-main" class="app-main">
        <RouterView v-slot="{ Component, route: nestedRoute }">
          <Transition name="shell-view" mode="out-in">
            <component :is="Component" :key="nestedRoute.fullPath" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>
