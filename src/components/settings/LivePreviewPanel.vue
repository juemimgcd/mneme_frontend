<script setup lang="ts">
const props = defineProps<{
  themeLabel: string;
  themeBg: string;
  themeElevated: string;
  themeAccent: string;
  themeText: string;
  accentColor: string;
  dyslexicFont: boolean;
  fontSize: number;
  density: string;
}>();

const paddingMap: Record<string, string> = {
  compact: '0.5rem',
  normal: '0.75rem',
  spacious: '1.1rem',
};

function pad(key: string): string {
  return paddingMap[key] ?? '0.75rem';
}
</script>

<template>
  <div class="preview-panel">
    <div class="preview-panel__header">
      <span class="preview-panel__eyebrow">Live Preview</span>
    </div>

    <div
      class="preview-viewport"
      :style="{
        background: props.themeBg,
        fontSize: props.fontSize * 0.55 + 'px',
        fontFamily: props.dyslexicFont ? '\'OpenDyslexic\', sans-serif' : 'inherit',
      }"
    >
      <!-- Mock sidebar -->
      <div class="mock-sidebar" :style="{ background: props.themeElevated }">
        <div class="mock-brand">
          <span class="mock-brand__dot" :style="{ background: props.accentColor }" />
          <span class="mock-brand__wordmark" :style="{ background: props.themeText + '55' }" />
        </div>
        <div class="mock-nav">
          <div
            v-for="i in 5"
            :key="i"
            class="mock-nav-item"
            :class="{ 'mock-nav-item--active': i === 3 }"
            :style="{
              padding: pad(props.density),
              background: i === 3 ? props.accentColor + '18' : 'transparent',
            }"
          >
            <span
              class="mock-nav-icon"
              :style="{ background: i === 3 ? props.accentColor : props.themeText + '3a' }"
            />
            <span
              class="mock-nav-label"
              :style="{ background: i === 3 ? props.themeText + '88' : props.themeText + '33' }"
            />
          </div>
        </div>
      </div>

      <!-- Mock main content -->
      <div class="mock-content" :style="{ padding: pad(props.density) }">
        <!-- Top bar -->
        <div
          class="mock-topbar"
          :style="{
            borderBottomColor: props.themeText + '14',
            paddingBottom: pad(props.density),
            marginBottom: pad(props.density),
          }"
        >
          <div class="mock-page-title" :style="{ background: props.themeText + '70' }" />
          <div class="mock-action" :style="{ background: props.accentColor }" />
        </div>
        <!-- Cards -->
        <div class="mock-cards">
          <div
            v-for="i in 3"
            :key="i"
            class="mock-card"
            :style="{
              background: props.themeElevated,
              borderColor: i === 1 ? props.accentColor + '45' : props.themeText + '12',
              padding: pad(props.density),
            }"
          >
            <div class="mock-card-title" :style="{ background: props.themeText + '65' }" />
            <div class="mock-card-line" :style="{ background: props.themeText + '30' }" />
            <div
              class="mock-card-line"
              :style="{ background: props.themeText + '1e', width: '70%' }"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="preview-panel__footer">
      <span class="preview-meta">{{ props.themeLabel }}</span>
      <span class="preview-sep" aria-hidden="true">·</span>
      <span class="preview-meta">{{ props.fontSize }}px</span>
      <span class="preview-sep" aria-hidden="true">·</span>
      <span class="preview-meta preview-meta--capitalize">{{ props.density }}</span>
    </div>
  </div>
</template>

<style scoped>
.preview-panel {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-elevated);
}

.preview-panel__header {
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
}

.preview-panel__eyebrow {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-soft);
}

/* Viewport */
.preview-viewport {
  display: flex;
  height: 290px;
  overflow: hidden;
}

/* Mock sidebar */
.mock-sidebar {
  width: 68px;
  flex-shrink: 0;
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mock-brand {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0 2px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.mock-brand__dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.mock-brand__wordmark {
  height: 5px;
  border-radius: 2px;
  flex: 1;
}

.mock-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mock-nav-item {
  display: flex;
  align-items: center;
  gap: 5px;
  border-radius: 4px;
}

.mock-nav-icon {
  width: 6px;
  height: 6px;
  border-radius: 2px;
  flex-shrink: 0;
}

.mock-nav-label {
  height: 4px;
  border-radius: 2px;
  flex: 1;
}

/* Mock content */
.mock-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mock-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid transparent;
}

.mock-page-title {
  height: 10px;
  width: 80px;
  border-radius: 4px;
}

.mock-action {
  width: 22px;
  height: 10px;
  border-radius: 4px;
  opacity: 0.75;
}

.mock-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.mock-card {
  border: 1px solid transparent;
  border-radius: 5px;
}

.mock-card-title {
  height: 6px;
  width: 80%;
  border-radius: 3px;
  margin-bottom: 5px;
}

.mock-card-line {
  height: 4px;
  border-radius: 2px;
  margin-top: 3px;
}

/* Footer */
.preview-panel__footer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-top: 1px solid var(--border);
}

.preview-meta {
  font-size: 0.7rem;
  color: var(--fg-soft);
}

.preview-meta--capitalize {
  text-transform: capitalize;
}

.preview-sep {
  color: var(--border-strong);
  font-size: 0.68rem;
}
</style>
