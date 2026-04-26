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

type NavItem = {
  name: string;
  label: string;
  icon: 'vault' | 'spark' | 'upload' | 'chat' | 'graph' | 'memory' | 'insight' | 'settings';
};

const navigationGroups = [
  {
    title: 'Workspace',
    items: [
      { name: 'dashboard', label: 'Desk', icon: 'vault' },
      { name: 'knowledge-bases', label: 'Knowledge', icon: 'spark' },
      { name: 'documents', label: 'Documents', icon: 'upload' },
      { name: 'chat', label: 'Conversations', icon: 'chat' },
    ],
  },
  {
    title: 'Analysis',
    items: [
      { name: 'graph', label: 'Graph', icon: 'graph' },
      { name: 'memory', label: 'Memory', icon: 'memory' },
      { name: 'insights', label: 'Insights', icon: 'insight' },
    ],
  },
  {
    title: 'Settings',
    items: [{ name: 'settings-appearance', label: 'Appearance', icon: 'settings' }],
  },
] satisfies ReadonlyArray<{ title: string; items: NavItem[] }>;

const routeMetaMap: Record<string, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'Workspace',
    title: 'Cognitive Workspace',
    description: 'A single operational surface for your active collection, recent activity, and reading signals.',
  },
  'knowledge-bases': {
    eyebrow: 'Library',
    title: 'Knowledge Bases',
    description: 'Organize collections, inspect scope, and decide which body of knowledge should drive the workspace.',
  },
  documents: {
    eyebrow: 'Ingestion',
    title: 'Documents',
    description: 'Track uploads, indexing state, and source quality across the current knowledge base.',
  },
  chat: {
    eyebrow: 'Dialogue',
    title: 'Conversations',
    description: 'Interrogate the workspace, review grounded answers, and follow source-backed synthesis.',
  },
  graph: {
    eyebrow: 'Topology',
    title: 'Graph',
    description: 'Inspect entities, relationships, and how extracted knowledge is structuring itself.',
  },
  memory: {
    eyebrow: 'Timeline',
    title: 'Memory',
    description: 'Review extracted notes and the evolving thread of facts across indexed material.',
  },
  insights: {
    eyebrow: 'Signals',
    title: 'Insights',
    description: 'Read summaries, growth indicators, and higher-order patterns emerging from the collection.',
  },
  'settings-appearance': {
    eyebrow: 'Settings',
    title: 'Appearance',
    description: 'Tune the visual language of Mneme, from theme and accent color to density and readability.',
  },
};

const mobileNavItems = computed(() => [
  navigationGroups[0].items[0],
  navigationGroups[0].items[1],
  navigationGroups[1].items[0],
  navigationGroups[2].items[0],
]);

const routeMeta = computed(
  () =>
    routeMetaMap[String(route.name)] ?? {
      eyebrow: 'Workspace',
      title: 'Mneme',
      description: 'A knowledge workspace shaped for reading, indexing, and recall.',
    },
);

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
const activeCollectionDescription = computed(
  () =>
    workspace.currentKnowledgeBase?.description ??
    'Choose a collection to ground document ingestion, graph generation, and memory extraction.',
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
    shellReveal.from(shell.querySelector('.mneme-sidebar'), {
      x: -16,
      opacity: 0,
      filter: 'blur(4px)',
      clearProps: 'transform,opacity,filter',
    });
    shellReveal.from(
      shell.querySelectorAll('.mneme-nav__link'),
      {
        x: -8,
        opacity: 0,
        stagger: 0.03,
        duration: 0.2,
        clearProps: 'transform,opacity',
      },
      '-=0.16',
    );
  }

  shellReveal.from(
    shell.querySelectorAll('.mneme-topbar, .app-main .view-stack'),
    {
      y: 12,
      opacity: 0,
      filter: 'blur(4px)',
      stagger: 0.05,
      clearProps: 'transform,opacity,filter',
    },
    includeSidebar ? '-=0.06' : 0,
  );
}

function resolveNavTarget(item: NavItem) {
  return {
    name: item.name,
    query: item.name === 'settings-appearance' ? undefined : appQuery.value,
  };
}

async function initializeWorkspaceContext() {
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
}

onMounted(async () => {
  await initializeWorkspaceContext();
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
    if (route.name === 'settings-appearance') {
      return;
    }

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
  <div ref="shellElement" class="app-shell mneme-shell">
    <aside class="mneme-sidebar" aria-label="Primary navigation">
      <RouterLink class="mneme-brand" :to="{ name: 'dashboard', query: appQuery }">
        <span class="mneme-brand__mark">M</span>
        <span class="mneme-brand__copy">
          <strong>Mneme</strong>
          <small>Cognitive Workspace</small>
        </span>
      </RouterLink>

      <nav class="mneme-nav" aria-label="Main sections">
        <section
          v-for="group in navigationGroups"
          :key="group.title"
          class="mneme-nav__group"
        >
          <p class="mneme-nav__caption">{{ group.title }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.name"
            class="mneme-nav__link"
            :to="resolveNavTarget(item)"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </section>
      </nav>

      <div class="mneme-sidebar__footer">
        <article class="mneme-sidebar__card">
          <p class="mneme-nav__caption">Active Collection</p>
          <strong>{{ workspace.currentKnowledgeBase?.name ?? 'No collection selected' }}</strong>
          <p>{{ activeCollectionDescription }}</p>
        </article>

        <div class="mneme-sidebar__stats" aria-label="Workspace metrics">
          <article>
            <span>Indexed</span>
            <strong>{{ indexedCount }}</strong>
          </article>
          <article>
            <span>Queued</span>
            <strong>{{ pendingCount }}</strong>
          </article>
          <article>
            <span>Memory</span>
            <strong>{{ memoryCount }}</strong>
          </article>
        </div>

        <button class="mneme-sidebar__logout" type="button" @click="logout">
          Sign out
        </button>
      </div>
    </aside>

    <div class="app-shell__content mneme-content">
      <header class="app-topbar mneme-topbar">
        <div class="mneme-topbar__copy">
          <p class="app-topbar__eyebrow">{{ routeMeta.eyebrow }}</p>
          <h1 class="app-topbar__title">{{ routeMeta.title }}</h1>
          <p class="app-topbar__description">{{ routeMeta.description }}</p>
        </div>

        <div class="mneme-topbar__controls">
          <label class="mneme-kb-switcher">
            <span>Knowledge Base</span>
            <select
              :value="workspace.activeKnowledgeBaseId ?? ''"
              aria-label="Select active knowledge base"
              @change="selectKnowledgeBase(($event.target as HTMLSelectElement).value)"
            >
              <option disabled value="">Select a collection</option>
              <option
                v-for="item in workspace.knowledgeBases"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </option>
            </select>
          </label>

          <div class="mneme-topbar__actions">
            <button
              class="ghost-button mneme-action"
              type="button"
              :aria-label="`Switch theme to ${theme === 'dark' ? 'light' : 'dark'}`"
              @click="toggleTheme"
            >
              <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
            </button>

            <button
              class="ghost-button mneme-action"
              type="button"
              aria-label="Refresh workspace data"
              :disabled="workspace.knowledgeRefreshLoading"
              @click="refreshKnowledgeOutputs"
            >
              <AppIcon name="refresh" />
            </button>

            <RouterLink
              class="ghost-button mneme-settings-link"
              :to="{ name: 'settings-appearance' }"
            >
              <AppIcon name="settings" />
              <span>Settings</span>
            </RouterLink>
          </div>
        </div>
      </header>

      <main id="app-main" class="app-main mneme-main">
        <RouterView v-slot="{ Component, route: nestedRoute }">
          <Transition name="shell-view" mode="out-in">
            <component :is="Component" :key="nestedRoute.fullPath" />
          </Transition>
        </RouterView>
      </main>
    </div>

    <nav class="mneme-mobile-nav" aria-label="Mobile navigation">
      <RouterLink
        v-for="item in mobileNavItems"
        :key="item.name"
        class="mneme-mobile-nav__item"
        :to="resolveNavTarget(item)"
      >
        <AppIcon :name="item.icon" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
.mneme-shell {
  --bg: var(--mneme-bg, #031427);
  --bg-elevated: var(--mneme-surface-container-low, #0b1c30);
  --bg-strong: var(--mneme-surface-container, #102034);
  --fg: var(--mneme-on-surface, #d3e4fe);
  --fg-soft: var(--mneme-on-surface-variant, #c2c6d6);
  --border: var(--mneme-outline-variant, #424754);
  --border-strong: var(--mneme-outline, #8c909f);
  --primary: var(--mneme-accent, #adc6ff);
  --primary-strong: var(--mneme-accent-strong, #d8e2ff);
  --accent: var(--mneme-accent, #adc6ff);
  --accent-soft: color-mix(in srgb, var(--mneme-accent, #adc6ff) 16%, transparent);
  --app-font-body: 'Inter', 'Segoe UI', sans-serif;
  --app-font-display: 'Inter', 'Segoe UI', sans-serif;
  --app-font-mono: 'IBM Plex Mono', 'Cascadia Mono', monospace;
  --app-paper: var(--bg);
  --app-paper-strong: var(--bg);
  --app-paper-muted: var(--bg-elevated);
  --app-sidebar: #020f1f;
  --app-sidebar-strong: #000b17;
  --app-panel: color-mix(in srgb, var(--bg-strong) 92%, transparent);
  --app-panel-solid: var(--bg-strong);
  --app-panel-muted: color-mix(in srgb, var(--bg-elevated) 96%, transparent);
  --app-ink: var(--fg);
  --app-ink-soft: var(--fg-soft);
  --app-ink-muted: color-mix(in srgb, var(--fg-soft) 74%, transparent);
  --app-line: color-mix(in srgb, var(--border) 88%, transparent);
  --app-line-strong: color-mix(in srgb, var(--border-strong) 82%, transparent);
  --app-shadow: 0 22px 56px rgba(0, 0, 0, 0.34);
  --app-shadow-soft: 0 14px 32px rgba(0, 0, 0, 0.18);
  --app-accent: var(--primary);
  --app-accent-strong: var(--primary-strong);
  --app-blue: var(--primary);
  --app-violet: #a78bfa;
  --app-sage: #34d399;
  --app-gold: #fbbf24;
  --app-rust: #ff8f8f;
  --app-success: #77d7b0;
  --app-warning: #ffd66b;
  --app-danger: #ff9d9d;
  min-height: 100vh;
  max-width: none;
  margin: 0;
  padding: 0;
  gap: 0;
  grid-template-columns: 260px minmax(0, 1fr);
  background:
    radial-gradient(circle at 12% 0%, rgba(173, 198, 255, 0.16), transparent 24rem),
    radial-gradient(circle at 88% 0%, rgba(77, 142, 255, 0.14), transparent 22rem),
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 14rem),
    var(--bg);
  color: var(--fg);
}

.mneme-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem 1rem;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 32%),
    linear-gradient(180deg, rgba(2, 15, 31, 0.98), rgba(2, 15, 31, 0.96));
  box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.03);
  overflow-y: auto;
}

.mneme-brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.35rem 0.4rem 0.8rem;
  color: var(--fg);
  text-decoration: none;
}

.mneme-brand__mark {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.8rem;
  background:
    radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.26), transparent 36%),
    linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%);
  color: #05204b;
  font-size: 1rem;
  font-weight: 800;
  box-shadow: 0 10px 26px rgba(77, 142, 255, 0.22);
}

.mneme-brand__copy strong {
  display: block;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.mneme-brand__copy small {
  display: block;
  margin-top: 0.15rem;
  color: rgba(211, 228, 254, 0.68);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.mneme-nav {
  display: grid;
  gap: 1rem;
}

.mneme-nav__group {
  display: grid;
  gap: 0.2rem;
}

.mneme-nav__caption {
  margin: 0 0 0.28rem;
  padding: 0 0.55rem;
  color: rgba(211, 228, 254, 0.52);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.mneme-nav__link {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-height: 2.8rem;
  padding: 0.72rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 0.85rem;
  color: rgba(211, 228, 254, 0.76);
  text-decoration: none;
}

.mneme-nav__link :deep(.app-icon) {
  width: 1rem;
  height: 1rem;
}

.mneme-nav__link.router-link-active,
.mneme-nav__link:hover {
  color: var(--primary);
  border-color: rgba(77, 142, 255, 0.14);
  background:
    linear-gradient(90deg, rgba(77, 142, 255, 0.12), rgba(77, 142, 255, 0.04) 72%, transparent),
    rgba(255, 255, 255, 0.02);
  box-shadow: inset 2px 0 0 #4d8eff;
}

.mneme-sidebar__footer {
  margin-top: auto;
  display: grid;
  gap: 0.9rem;
}

.mneme-sidebar__card,
.mneme-sidebar__stats {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 100%),
    rgba(16, 32, 52, 0.92);
}

.mneme-sidebar__card {
  padding: 0.9rem;
}

.mneme-sidebar__card strong {
  display: block;
  margin-bottom: 0.45rem;
  color: var(--fg);
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.mneme-sidebar__card p:last-child {
  margin: 0;
  color: rgba(211, 228, 254, 0.72);
  font-size: 0.82rem;
  line-height: 1.6;
}

.mneme-sidebar__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0.85rem;
}

.mneme-sidebar__stats article {
  display: grid;
  gap: 0.18rem;
}

.mneme-sidebar__stats span {
  color: rgba(211, 228, 254, 0.58);
  font-size: 0.7rem;
}

.mneme-sidebar__stats strong {
  color: var(--fg);
  font-size: 1.15rem;
  font-weight: 700;
}

.mneme-sidebar__logout {
  min-height: 2.8rem;
  padding: 0.75rem 0.9rem;
  border: 1px solid rgba(255, 180, 171, 0.18);
  border-radius: 0.85rem;
  background: rgba(147, 0, 10, 0.14);
  color: #ffb4ab;
  font-weight: 600;
}

.mneme-content {
  min-width: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025), transparent 100%),
    rgba(3, 20, 39, 0.76);
}

.mneme-topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.5rem;
  align-items: end;
  padding: 2rem 2rem 1.5rem;
  border: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 100%),
    rgba(3, 20, 39, 0.92);
  box-shadow: none;
}

.mneme-topbar__copy .app-topbar__eyebrow {
  margin: 0 0 0.55rem;
  color: rgba(211, 228, 254, 0.52);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.mneme-topbar__copy .app-topbar__title {
  margin: 0;
  color: var(--fg);
  font-size: clamp(2rem, 2.8vw, 2.7rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.mneme-topbar__copy .app-topbar__description {
  max-width: 48rem;
  margin: 0.65rem 0 0;
  color: rgba(211, 228, 254, 0.72);
  font-size: 0.95rem;
  line-height: 1.7;
}

.mneme-topbar__controls {
  display: flex;
  align-items: end;
  gap: 0.9rem;
}

.mneme-kb-switcher {
  display: grid;
  gap: 0.35rem;
  min-width: 15rem;
}

.mneme-kb-switcher span {
  color: rgba(211, 228, 254, 0.54);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.mneme-kb-switcher select {
  min-height: 2.8rem;
  padding: 0.72rem 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.85rem;
  background: rgba(16, 32, 52, 0.92);
  color: var(--fg);
}

.mneme-topbar__actions {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.mneme-action,
.mneme-settings-link {
  min-height: 2.8rem;
  border-radius: 0.85rem;
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(16, 32, 52, 0.92);
}

.mneme-action {
  min-width: 2.8rem;
  padding-inline: 0.8rem;
}

.mneme-settings-link {
  color: var(--fg);
}

.mneme-settings-link.router-link-active {
  color: var(--primary);
  border-color: rgba(77, 142, 255, 0.18);
}

.mneme-settings-link:hover,
.mneme-action:hover {
  background: rgba(27, 43, 63, 0.96);
}

.mneme-main {
  padding: 2rem;
}

.mneme-mobile-nav {
  display: none;
}

@media (max-width: 1100px) {
  .mneme-topbar {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .mneme-topbar__controls {
    flex-wrap: wrap;
    align-items: stretch;
  }
}

@media (max-width: 920px) {
  .mneme-shell {
    grid-template-columns: 1fr;
  }

  .mneme-sidebar {
    display: none;
  }

  .mneme-content {
    min-height: 100vh;
    padding-bottom: 5.5rem;
  }

  .mneme-main,
  .mneme-topbar {
    padding-inline: 1.25rem;
  }

  .mneme-main {
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
  }

  .mneme-topbar {
    padding-top: 1.5rem;
    padding-bottom: 1.1rem;
  }

  .mneme-kb-switcher {
    min-width: min(100%, 20rem);
  }

  .mneme-mobile-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 40;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.45rem;
    padding: 0.55rem 0.9rem calc(0.9rem + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(2, 15, 31, 0.88);
    backdrop-filter: blur(18px);
  }

  .mneme-mobile-nav__item {
    display: grid;
    justify-items: center;
    gap: 0.2rem;
    padding: 0.5rem 0.35rem;
    border-radius: 0.9rem;
    color: rgba(211, 228, 254, 0.62);
    text-decoration: none;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .mneme-mobile-nav__item.router-link-active {
    color: var(--primary);
    background: rgba(77, 142, 255, 0.08);
  }

  .mneme-mobile-nav__item :deep(.app-icon) {
    width: 1rem;
    height: 1rem;
  }
}

@media (max-width: 640px) {
  .mneme-topbar__actions {
    width: 100%;
  }

  .mneme-settings-link {
    flex: 1;
    justify-content: center;
  }
}
</style>
