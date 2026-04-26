<script setup lang="ts">
defineProps<{
  dyslexicFont: boolean;
  fontSize: number;
}>();

const emit = defineEmits<{
  'update:dyslexicFont': [value: boolean];
  'update:fontSize': [value: number];
}>();

function onFontSizeInput(event: Event) {
  emit('update:fontSize', Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="typography-settings">
    <!-- Dyslexic-friendly font row -->
    <div class="setting-row">
      <div class="setting-info">
        <span id="dyslexic-label" class="setting-label">Dyslexic-friendly font</span>
        <p class="setting-hint">Uses OpenDyslexic for improved readability</p>
      </div>
      <button
        class="toggle"
        :class="{ 'toggle--on': dyslexicFont }"
        role="switch"
        :aria-checked="dyslexicFont"
        aria-labelledby="dyslexic-label"
        type="button"
        @click="emit('update:dyslexicFont', !dyslexicFont)"
      >
        <span class="toggle__thumb" />
        <span class="sr-only">{{ dyslexicFont ? 'On' : 'Off' }}</span>
      </button>
    </div>

    <!-- Base font size row -->
    <div class="setting-row">
      <div class="setting-info">
        <label class="setting-label" for="font-size-range">Base font size</label>
        <p class="setting-hint">Adjusts the root font size across the interface</p>
      </div>
      <div class="size-control">
        <input
          id="font-size-range"
          type="range"
          class="range-input"
          min="12"
          max="24"
          step="1"
          :value="fontSize"
          aria-label="Base font size"
          @input="onFontSizeInput"
        />
        <span class="size-value" aria-live="polite" aria-atomic="true">{{ fontSize }}px</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.typography-settings {
  display: flex;
  flex-direction: column;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--border);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--fg);
  cursor: pointer;
}

.setting-hint {
  margin: 0.2rem 0 0;
  font-size: 0.78rem;
  color: var(--fg-soft);
  line-height: 1.5;
}

/* Toggle switch */
.toggle {
  flex-shrink: 0;
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--border-strong);
  border: none;
  border-radius: 12px;
  cursor: pointer;
  padding: 0;
  transition: background 200ms ease;
}

.toggle--on {
  background: var(--primary);
}

.toggle__thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 200ms ease;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.toggle--on .toggle__thumb {
  transform: translateX(20px);
}

.toggle:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Range slider */
.size-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-shrink: 0;
}

.range-input {
  width: 120px;
  height: 4px;
  appearance: none;
  -webkit-appearance: none;
  background: var(--border-strong);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.range-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
  box-shadow: 0 0 0 3px rgba(127, 157, 255, 0.2);
}

.range-input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: var(--primary);
  cursor: pointer;
}

.range-input:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 4px;
}

.size-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--primary);
  min-width: 3rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
