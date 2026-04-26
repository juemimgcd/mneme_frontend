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
      class="density-selector__option"
      :class="{ 'density-selector__option--active': selected === option.id }"
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
  display: flex;
  padding: 0.35rem;
  border: 1px solid var(--app-line);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 100%),
    rgba(16, 32, 52, 0.88);
}

.density-selector__option {
  flex: 1;
  min-height: 2.85rem;
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 0.8rem;
  background: transparent;
  color: var(--app-ink-soft);
  font-size: 0.92rem;
  font-weight: 600;
}

.density-selector__option:hover {
  color: var(--app-ink);
  background: rgba(255, 255, 255, 0.04);
}

.density-selector__option--active {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(38, 54, 74, 0.92);
  color: var(--app-ink);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.03);
}
</style>
