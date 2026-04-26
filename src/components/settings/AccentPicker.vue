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
      class="accent-picker__swatch"
      :class="{ 'accent-picker__swatch--active': selected === color.id }"
      :style="{ '--swatch': color.value }"
      :aria-checked="selected === color.id"
      :aria-label="color.label"
      role="radio"
      type="button"
      @click="emit('select', color.id)"
    >
      <span v-if="selected === color.id" class="accent-picker__check" />
    </button>
  </div>
</template>

<style scoped>
.accent-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.accent-picker__swatch {
  position: relative;
  width: 3rem;
  height: 3rem;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 999px;
  background: var(--swatch);
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.22);
}

.accent-picker__swatch:hover {
  transform: scale(1.04);
}

.accent-picker__swatch--active {
  box-shadow:
    0 0 0 4px rgba(16, 32, 52, 1),
    0 0 0 6px color-mix(in srgb, var(--swatch) 75%, transparent);
}

.accent-picker__check {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 0.8rem;
  height: 0.4rem;
  border-left: 2px solid rgba(0, 24, 56, 0.88);
  border-bottom: 2px solid rgba(0, 24, 56, 0.88);
  transform: rotate(-45deg) translateY(-1px);
}
</style>
