<script setup lang="ts">
defineProps<{
  id: string;
  label: string;
  active: boolean;
  preview: {
    bg: string;
    elevated: string;
    accent: string;
    text: string;
  };
}>();

const emit = defineEmits<{
  select: [id: string];
}>();
</script>

<template>
  <button
    class="theme-card"
    :class="{ 'theme-card--active': active }"
    :aria-pressed="active"
    type="button"
    @click="emit('select', id)"
  >
    <div class="theme-card__visual" :style="{ background: preview.bg }">
      <div class="theme-card__bar" :style="{ background: preview.elevated }">
        <span class="theme-card__dot" :style="{ background: preview.accent }" />
        <span class="theme-card__dot" :style="{ background: preview.accent + '55' }" />
      </div>
      <div class="theme-card__content">
        <span class="theme-card__line" :style="{ background: preview.text + '55', width: '68%' }" />
        <span class="theme-card__line" :style="{ background: preview.text + '30', width: '48%' }" />
        <span class="theme-card__chip" :style="{ background: preview.accent + '2a', borderColor: preview.accent + '55' }" />
      </div>
    </div>
    <div class="theme-card__footer" :style="{ background: preview.elevated, borderTopColor: preview.text + '14' }">
      <span class="theme-card__name" :style="{ color: preview.text }">{{ label }}</span>
      <span
        v-if="active"
        class="theme-card__badge"
        :style="{ color: preview.accent, background: preview.accent + '22' }"
      >Active</span>
    </div>
  </button>
</template>

<style scoped>
.theme-card {
  display: flex;
  flex-direction: column;
  border: 2px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: transparent;
  cursor: pointer;
  transition: border-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
  text-align: left;
  padding: 0;
}

.theme-card:hover {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.theme-card--active {
  border-color: var(--primary);
  box-shadow: 0 0 0 1px var(--primary), 0 8px 24px rgba(127, 157, 255, 0.15);
}

.theme-card:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.theme-card__visual {
  height: 84px;
  padding: 10px 10px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.theme-card__bar {
  height: 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
}

.theme-card__dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

.theme-card__content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 2px;
}

.theme-card__line {
  height: 4px;
  border-radius: 2px;
  display: block;
}

.theme-card__chip {
  width: 34px;
  height: 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  margin-top: 2px;
}

.theme-card__footer {
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid transparent;
}

.theme-card__name {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.theme-card__badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 99px;
}
</style>
