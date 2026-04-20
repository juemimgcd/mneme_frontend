<script setup lang="ts">
import { computed } from 'vue';
import type { MemoryLibrary } from '@/lib/types';
import type { MemoryGraphFocus } from '@/components/memory/types';

const props = defineProps<{
  library: MemoryLibrary;
  focus?: MemoryGraphFocus | null;
  sidebar?: boolean;
}>();

const visibleTimeline = computed(() => {
  const entryNames = props.focus?.entryNames;
  if (!entryNames?.length || props.focus?.kind === 'root') {
    return [...props.library.timeline].sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  const visible = new Set(entryNames);
  return [...props.library.timeline]
    .filter((entry) => visible.has(entry.entry_name))
    .sort((left, right) => right.created_at.localeCompare(left.created_at));
});

const visibleEntryNames = computed(() => {
  if (props.focus?.entryNames?.length) {
    return new Set(props.focus.entryNames);
  }
  return new Set(props.library.timeline.map((entry) => entry.entry_name));
});

const visibleTypes = computed(() =>
  Object.entries(props.library.by_type)
    .map(([type, entries]) => ({
      type,
      count: entries.filter((entry) => visibleEntryNames.value.has(entry)).length,
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type)),
);

const visibleThemes = computed(() =>
  props.library.by_theme
    .map((theme) => ({
      ...theme,
      entries: theme.entries.filter((entry) => visibleEntryNames.value.has(entry)),
    }))
    .filter((theme) => theme.entries.length > 0)
    .sort((left, right) => right.entries.length - left.entries.length || left.theme_name.localeCompare(right.theme_name)),
);

const focusCopy = computed(() => {
  if (!props.focus) {
    return {
      title: 'Open notebook rail',
      description: 'Select a type, theme, or note in the atlas to narrow the reading lane.',
    };
  }

  return {
    title: props.focus.label,
    description: props.focus.summary,
  };
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
</script>

<template>
  <div class="memory-rail" :data-sidebar="sidebar">
    <section class="memory-rail__main">
      <article class="memory-focus">
        <span>Current focus</span>
        <strong>{{ focusCopy.title }}</strong>
        <p>{{ focusCopy.description }}</p>
      </article>

      <ol class="timeline-list memory-timeline">
        <li v-for="entry in visibleTimeline" :key="entry.entry_id" class="timeline-list__item">
          <time class="timeline-list__time">{{ formatDate(entry.created_at) }}</time>
          <article class="timeline-entry timeline-entry--compact memory-timeline__entry">
            <header class="knowledge-card__header">
              <strong>{{ entry.entry_name }}</strong>
              <span class="inline-badge">{{ entry.entry_type }}</span>
            </header>
            <p>{{ entry.summary }}</p>
          </article>
        </li>
      </ol>
    </section>

    <aside class="memory-rail__side">
      <section class="memory-panel">
        <header class="memory-panel__header">
          <span>Type spread</span>
          <strong>{{ visibleTypes.length }} active types</strong>
        </header>
        <div class="chip-wrap memory-panel__chips">
          <span v-for="item in visibleTypes" :key="item.type" class="memory-chip">
            {{ item.type }} · {{ item.count }}
          </span>
        </div>
      </section>

      <section class="memory-panel">
        <header class="memory-panel__header">
          <span>Theme clusters</span>
          <strong>{{ visibleThemes.length }} visible groups</strong>
        </header>
        <article
          v-for="theme in visibleThemes"
          :key="theme.theme_name"
          class="theme-card theme-card--compact memory-theme-card"
        >
          <header class="knowledge-card__header">
            <strong>{{ theme.theme_name }}</strong>
            <span class="inline-badge">{{ theme.entries.length }}</span>
          </header>
          <p>{{ theme.entries.join(' / ') }}</p>
        </article>
      </section>
    </aside>
  </div>
</template>

<style scoped>
.memory-rail {
  display: grid;
  grid-template-columns: minmax(0, 1.18fr) minmax(280px, 0.82fr);
  gap: 1rem;
}

.memory-rail[data-sidebar='true'] {
  grid-template-columns: 1fr;
}

.memory-rail__main,
.memory-rail__side {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.memory-rail[data-sidebar='true'] .memory-rail__side {
  order: -1;
}

.memory-focus,
.memory-panel {
  display: grid;
  gap: 0.55rem;
  padding: 1rem 1.05rem;
  border: 1px solid rgba(49, 66, 88, 0.72);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 72%),
    rgba(19, 27, 38, 0.72);
}

.memory-focus span,
.memory-panel__header span {
  color: #76859b;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.memory-focus strong,
.memory-panel__header strong {
  color: #eff5ff;
  font-family: 'Fraunces', serif;
  font-size: 1.16rem;
  font-weight: 500;
}

.memory-focus p,
.memory-theme-card p {
  margin: 0;
  color: #b3bfd0;
  line-height: 1.65;
}

.memory-panel__header {
  display: grid;
  gap: 0.25rem;
}

.memory-panel__chips {
  gap: 0.5rem;
}

.memory-timeline {
  gap: 0.8rem;
}

.memory-timeline__entry {
  position: relative;
  border: 1px solid rgba(49, 66, 88, 0.72);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 74%),
    rgba(23, 32, 44, 0.92);
}

.memory-timeline__entry::before {
  content: '';
  position: absolute;
  top: 1rem;
  bottom: 1rem;
  left: 0;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, #5fd0b1, #6d8dff);
}

.memory-theme-card {
  border: 1px solid rgba(49, 66, 88, 0.6);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.05), transparent 74%),
    rgba(20, 29, 41, 0.9);
}

@media (max-width: 900px) {
  .memory-rail {
    grid-template-columns: 1fr;
  }
}
</style>
