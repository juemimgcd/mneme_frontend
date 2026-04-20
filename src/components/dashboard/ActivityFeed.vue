<script setup lang="ts">
import type { ActivityItem } from '@/lib/types';

defineProps<{
  items: ActivityItem[];
}>();
</script>

<template>
  <ul class="activity-feed">
    <li v-for="item in items" :key="item.id" class="activity-feed__item" :data-tone="item.tone">
      <div class="activity-feed__dot" />
      <div class="activity-feed__content">
        <h3>{{ item.title }}</h3>
        <p>{{ item.detail }}</p>
      </div>
      <time class="activity-feed__time">{{ item.timestamp }}</time>
    </li>
  </ul>
</template>
