<script setup lang="ts">
defineProps<{
  options: Array<{ id: string; label: string }>;
  selected: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <div class="density-selector" role="group" aria-label="Interface density">
    <button
      v-for="option in options"
      :key="option.id"
      class="density-btn"
      :class="{ 'density-btn--active': selected === option.id }"
      :aria-pressed="selected === option.id"
      type="button"
      @click="emit('select', option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.density-selector {
  display: inline-flex;
  background: var(--bg-strong);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.density-btn {
  padding: 0.45rem 1.1rem;
  border: none;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--fg-soft);
  background: transparent;
  cursor: pointer;
  transition:
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;
  white-space: nowrap;
}

.density-btn:hover {
  color: var(--fg);
  background: rgba(255, 255, 255, 0.05);
}

.density-btn--active {
  background: var(--bg-elevated);
  color: var(--fg);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
}

.density-btn:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
</style>
