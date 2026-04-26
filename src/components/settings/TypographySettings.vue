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
    <div class="typography-settings__row">
      <div>
        <h4>Dyslexic Friendly Font</h4>
        <p>Switches the interface to OpenDyslexic to improve readability.</p>
      </div>

      <button
        class="typography-toggle"
        :class="{ 'typography-toggle--active': dyslexicFont }"
        :aria-checked="dyslexicFont"
        role="switch"
        type="button"
        @click="emit('update:dyslexicFont', !dyslexicFont)"
      >
        <span class="typography-toggle__thumb" />
      </button>
    </div>

    <div class="typography-settings__row typography-settings__row--stacked">
      <div class="typography-settings__label-row">
        <div>
          <h4>Base Font Size</h4>
          <p>Adjust the core scale of the interface text.</p>
        </div>
        <span class="typography-settings__value">{{ fontSize }}px</span>
      </div>

      <div class="typography-slider">
        <div class="typography-slider__track" />
        <div class="typography-slider__fill" :style="{ width: `${((fontSize - 12) / 12) * 100}%` }" />
        <input
          aria-label="Adjust font size"
          class="typography-slider__input"
          max="24"
          min="12"
          step="2"
          type="range"
          :value="fontSize"
          @input="onFontSizeInput"
        />
      </div>

      <div class="typography-settings__scale">
        <span>A</span>
        <span>A</span>
        <span>A</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.typography-settings {
  display: grid;
  gap: 1.2rem;
}

.typography-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.typography-settings__row--stacked {
  display: grid;
  gap: 1rem;
}

.typography-settings h4 {
  margin: 0 0 0.3rem;
  color: var(--app-ink);
  font-size: 0.98rem;
  font-weight: 600;
}

.typography-settings p {
  margin: 0;
  color: var(--app-ink-soft);
  line-height: 1.6;
}

.typography-toggle {
  position: relative;
  width: 3rem;
  height: 1.75rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: var(--mneme-surface-container-highest, #26364a);
}

.typography-toggle--active {
  background: color-mix(in srgb, var(--app-accent) 45%, var(--mneme-surface-container-highest, #26364a));
}

.typography-toggle__thumb {
  position: absolute;
  top: 0.16rem;
  left: 0.16rem;
  width: 1.42rem;
  height: 1.42rem;
  border-radius: 999px;
  background: var(--mneme-outline, #8c909f);
}

.typography-toggle--active .typography-toggle__thumb {
  transform: translateX(1.24rem);
  background: var(--app-accent);
}

.typography-settings__label-row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}

.typography-settings__value {
  padding: 0.35rem 0.55rem;
  border: 1px solid color-mix(in srgb, var(--app-accent) 24%, transparent);
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--app-accent) 10%, transparent);
  color: var(--app-accent);
  font-family: var(--app-font-mono);
  font-size: 0.82rem;
}

.typography-slider {
  position: relative;
  height: 1.7rem;
}

.typography-slider__track,
.typography-slider__fill {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translateY(-50%);
  height: 0.35rem;
  border-radius: 999px;
}

.typography-slider__track {
  width: 100%;
  background: var(--mneme-surface-container-highest, #26364a);
}

.typography-slider__fill {
  background: var(--app-accent);
}

.typography-slider__input {
  position: absolute;
  inset: 0;
  width: 100%;
  margin: 0;
  appearance: none;
  background: transparent;
}

.typography-slider__input::-webkit-slider-thumb {
  width: 1.15rem;
  height: 1.15rem;
  appearance: none;
  border: 2px solid var(--mneme-bg, #031427);
  border-radius: 999px;
  background: var(--app-accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--app-accent) 40%, transparent);
}

.typography-slider__input::-moz-range-thumb {
  width: 1.15rem;
  height: 1.15rem;
  border: 2px solid var(--mneme-bg, #031427);
  border-radius: 999px;
  background: var(--app-accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--app-accent) 40%, transparent);
}

.typography-settings__scale {
  display: flex;
  justify-content: space-between;
  color: rgba(211, 228, 254, 0.64);
}

.typography-settings__scale span:first-child {
  font-size: 0.86rem;
}

.typography-settings__scale span:nth-child(2) {
  font-size: 1rem;
}

.typography-settings__scale span:last-child {
  font-size: 1.2rem;
}
</style>
