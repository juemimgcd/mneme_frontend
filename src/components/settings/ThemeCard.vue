<script setup lang="ts">
defineProps<{
  id: string;
  label: string;
  subtitle: string;
  active: boolean;
  preview: {
    base: string;
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
    <div class="theme-card__preview" :style="{ background: preview.base }">
      <div class="theme-card__preview-overlay" :style="{ background: `linear-gradient(135deg, ${preview.accent}1f, transparent)` }" />
      <div class="theme-card__preview-top">
        <span class="theme-card__preview-badge" :style="{ background: `${preview.accent}20`, borderColor: `${preview.accent}55` }">
          <span :style="{ background: preview.accent }" />
        </span>
        <span class="theme-card__preview-line" :style="{ background: `${preview.text}66` }" />
      </div>
      <div class="theme-card__preview-panel" :style="{ background: preview.elevated, borderColor: `${preview.text}18` }">
        <span class="theme-card__preview-rule" :style="{ background: `${preview.accent}75`, width: '74%' }" />
        <span class="theme-card__preview-rule" :style="{ background: `${preview.text}40`, width: '52%' }" />
      </div>
    </div>

    <div class="theme-card__meta">
      <div>
        <h4>{{ label }}</h4>
        <p>{{ subtitle }}</p>
      </div>
      <span class="theme-card__check" :class="{ 'theme-card__check--active': active }" />
    </div>
  </button>
</template>

<style scoped>
.theme-card {
  position: relative;
  overflow: hidden;
  padding: 0;
  border: 1px solid var(--app-line);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 100%),
    rgba(16, 32, 52, 0.88);
  text-align: left;
  cursor: pointer;
}

.theme-card:hover {
  border-color: var(--app-line-strong);
  transform: translateY(-1px);
}

.theme-card--active {
  border-color: color-mix(in srgb, var(--app-accent) 48%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-accent) 34%, transparent);
}

.theme-card__preview {
  position: relative;
  height: 7.2rem;
  padding: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.theme-card__preview-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.theme-card__preview-top,
.theme-card__preview-panel {
  position: relative;
  z-index: 1;
}

.theme-card__preview-top {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.7rem;
}

.theme-card__preview-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  border: 1px solid transparent;
  border-radius: 999px;
}

.theme-card__preview-badge span {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
}

.theme-card__preview-line {
  height: 0.4rem;
  width: 4rem;
  border-radius: 999px;
}

.theme-card__preview-panel {
  height: 3.9rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.75rem;
}

.theme-card__preview-rule {
  display: block;
  height: 0.32rem;
  border-radius: 999px;
}

.theme-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
}

.theme-card__meta h4 {
  margin: 0;
  color: var(--app-ink);
  font-size: 0.98rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.theme-card__meta p {
  margin: 0.2rem 0 0;
  color: var(--app-ink-soft);
  font-size: 0.82rem;
}

.theme-card__check {
  width: 1.35rem;
  height: 1.35rem;
  border: 2px solid var(--app-line-strong);
  border-radius: 999px;
  flex-shrink: 0;
}

.theme-card__check--active {
  border-color: var(--app-accent);
  background:
    radial-gradient(circle at center, var(--app-accent) 0 42%, transparent 44% 100%);
}
</style>
