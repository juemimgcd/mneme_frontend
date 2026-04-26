<script setup lang="ts">
defineProps<{
  colors: ReadonlyArray<{ id: string; value: string; label: string }>;
  selected: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <div class="accent-picker" role="radiogroup" aria-label="Select accent color">
    <button
      v-for="color in colors"
      :key="color.id"
      class="accent-swatch"
      :class="{ 'accent-swatch--active': selected === color.id }"
      role="radio"
      :aria-checked="selected === color.id"
      :aria-label="color.label + (selected === color.id ? ' (selected)' : '')"
      type="button"
      :style="{ '--swatch': color.value }"
      @click="emit('select', color.id)"
    />
  </div>
</template>

<style scoped>
.accent-picker {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.accent-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--swatch);
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.accent-swatch:hover {
  transform: scale(1.2);
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.08);
}

.accent-swatch--active {
  box-shadow: 0 0 0 3px var(--bg-strong), 0 0 0 5px var(--swatch);
}

.accent-swatch:focus-visible {
  outline: 2px solid var(--fg);
  outline-offset: 3px;
}
</style>
