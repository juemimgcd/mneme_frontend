<script setup lang="ts">
import type { ChatSource } from '@/lib/types';

defineProps<{
  source: ChatSource;
}>();
</script>

<template>
  <article class="source-card source-card--compact">
    <header>
      <strong>{{ source.document_id }}</strong>
      <span>{{ source.source_page_nos.join(' / ') || 'Unknown pages' }}</span>
    </header>
    <p>{{ source.text }}</p>
    <small>Referenced passage: {{ source.chunk_id }}</small>
  </article>
</template>
