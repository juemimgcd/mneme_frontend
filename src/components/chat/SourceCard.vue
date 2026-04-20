<script setup lang="ts">
import type { ChatSource } from '@/lib/types';

defineProps<{
  source: ChatSource;
}>();
</script>

<template>
  <article class="source-card source-card--compact">
    <header>
      <strong>Source {{ source.document_id.slice(0, 8) }}</strong>
      <span>{{
        source.source_page_nos.length ? `Pages ${source.source_page_nos.join(' / ')}` : 'Page unknown'
      }}</span>
    </header>
    <p>{{ source.text }}</p>
    <small>Passage {{ source.chunk_id.slice(0, 10) }}</small>
  </article>
</template>
