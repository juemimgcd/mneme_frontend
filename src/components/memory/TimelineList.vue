<script setup lang="ts">
import type { MemoryLibrary } from '@/lib/types';

defineProps<{
  library: MemoryLibrary;
}>();
</script>

<template>
  <div class="timeline-layout">
    <div class="timeline-layout__main">
      <ol class="timeline-list">
        <li v-for="entry in library.timeline" :key="entry.entry_id">
          <time>{{ new Date(entry.created_at).toLocaleDateString('en-US') }}</time>
          <div class="timeline-entry">
            <header class="knowledge-card__header">
              <strong>{{ entry.entry_name }}</strong>
              <span class="inline-badge">{{ entry.entry_type }}</span>
            </header>
            <p>{{ entry.summary }}</p>
          </div>
        </li>
      </ol>
    </div>

    <aside class="memory-sidegrid">
      <section class="memory-group">
        <h3>By Type</h3>
        <div class="chip-wrap">
          <span v-for="(entries, type) in library.by_type" :key="type" class="memory-chip">
            {{ type }} · {{ entries.length }}
          </span>
        </div>
      </section>

      <section class="memory-group">
        <h3>Themes</h3>
        <article v-for="theme in library.by_theme" :key="theme.theme_name" class="theme-card">
          <header class="knowledge-card__header">
            <strong>{{ theme.theme_name }}</strong>
            <span class="inline-badge">{{ theme.count }}</span>
          </header>
          <p>{{ theme.entries.join(' / ') }}</p>
        </article>
      </section>
    </aside>
  </div>
</template>
