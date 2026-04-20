<script setup lang="ts">
import type { KnowledgeBase } from '@/lib/types';

defineProps<{
  items: KnowledgeBase[];
  activeId: string;
}>();

const emit = defineEmits<{
  (event: 'select', id: string): void;
}>();
</script>

<template>
  <div class="knowledge-grid knowledge-grid--list">
    <button
      v-for="item in items"
      :key="item.id"
      class="knowledge-card knowledge-card--list"
      type="button"
      :data-active="item.id === activeId"
      @click="emit('select', item.id)"
    >
      <div class="knowledge-card__header">
        <strong>{{ item.name }}</strong>
        <span class="status-pill" :data-status="item.status">{{ item.status }}</span>
      </div>
      <p>{{ item.description }}</p>
      <dl class="knowledge-card__meta">
        <div>
          <dt>Docs</dt>
          <dd>{{ item.document_count }}</dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd>{{ item.memory_count }}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{{ new Date(item.updated_at).toLocaleDateString('en-US') }}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{{ item.is_default ? 'Default' : 'Custom' }}</dd>
        </div>
      </dl>
    </button>
  </div>
</template>
