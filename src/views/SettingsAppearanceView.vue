<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ThemeCard from '@/components/settings/ThemeCard.vue';
import AccentPicker from '@/components/settings/AccentPicker.vue';
import TypographySettings from '@/components/settings/TypographySettings.vue';
import DensitySelector from '@/components/settings/DensitySelector.vue';
import LivePreviewPanel from '@/components/settings/LivePreviewPanel.vue';
import { useTheme } from '@/composables/useTheme';

type ThemeId = 'deep-sea' | 'solar' | 'graphite' | 'cyber';
type DensityId = 'compact' | 'comfortable' | 'spacious';

type ThemeDefinition = {
  id: ThemeId;
  label: string;
  subtitle: string;
  mode: 'dark' | 'light';
  preview: {
    base: string;
    elevated: string;
    accent: string;
    text: string;
  };
  tokens: {
    bg: string;
    surfaceContainerLow: string;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    onSurface: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    accentStrong: string;
  };
};

const STORAGE_KEY = 'mneme-appearance-v2';
const { setTheme } = useTheme();

const themes: ThemeDefinition[] = [
  {
    id: 'deep-sea',
    label: 'Deep Sea',
    subtitle: 'Current Dark',
    mode: 'dark',
    preview: {
      base: '#031427',
      elevated: '#102034',
      accent: '#adc6ff',
      text: '#d3e4fe',
    },
    tokens: {
      bg: '#031427',
      surfaceContainerLow: '#0b1c30',
      surfaceContainer: '#102034',
      surfaceContainerHigh: '#1b2b3f',
      surfaceContainerHighest: '#26364a',
      onSurface: '#d3e4fe',
      onSurfaceVariant: '#c2c6d6',
      outline: '#8c909f',
      outlineVariant: '#424754',
      accentStrong: '#d8e2ff',
    },
  },
  {
    id: 'solar',
    label: 'Solar',
    subtitle: 'Clean Light',
    mode: 'light',
    preview: {
      base: '#f8fafc',
      elevated: '#ffffff',
      accent: '#4d8eff',
      text: '#132338',
    },
    tokens: {
      bg: '#eef3fa',
      surfaceContainerLow: '#f7f9fc',
      surfaceContainer: '#ffffff',
      surfaceContainerHigh: '#edf2f8',
      surfaceContainerHighest: '#dfe7f1',
      onSurface: '#16253a',
      onSurfaceVariant: '#5c6b82',
      outline: '#90a0b5',
      outlineVariant: '#cad4e1',
      accentStrong: '#0f3f82',
    },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    subtitle: 'Neutral Dark',
    mode: 'dark',
    preview: {
      base: '#0a0a0a',
      elevated: '#171717',
      accent: '#d6dbe4',
      text: '#f3f4f6',
    },
    tokens: {
      bg: '#0b0d11',
      surfaceContainerLow: '#11141a',
      surfaceContainer: '#151922',
      surfaceContainerHigh: '#1d222c',
      surfaceContainerHighest: '#262d38',
      onSurface: '#f3f4f6',
      onSurfaceVariant: '#b5bcc7',
      outline: '#8a92a0',
      outlineVariant: '#353b46',
      accentStrong: '#ffffff',
    },
  },
  {
    id: 'cyber',
    label: 'Cyber',
    subtitle: 'High Contrast',
    mode: 'dark',
    preview: {
      base: '#02070b',
      elevated: '#09131d',
      accent: '#00e5ff',
      text: '#d5faff',
    },
    tokens: {
      bg: '#02070b',
      surfaceContainerLow: '#071018',
      surfaceContainer: '#0b1620',
      surfaceContainerHigh: '#10212d',
      surfaceContainerHighest: '#16303f',
      onSurface: '#d5faff',
      onSurfaceVariant: '#89b8c7',
      outline: '#4d7a87',
      outlineVariant: '#1b3944',
      accentStrong: '#8cf6ff',
    },
  },
];

const accentColors = [
  { id: 'blue', value: '#adc6ff', strong: '#d8e2ff', label: 'Blue' },
  { id: 'violet', value: '#a78bfa', strong: '#ddd6fe', label: 'Violet' },
  { id: 'emerald', value: '#34d399', strong: '#bbf7d0', label: 'Emerald' },
  { id: 'amber', value: '#fbbf24', strong: '#fde68a', label: 'Amber' },
];

const densityOptions = [
  { id: 'compact', label: 'Compact' },
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'spacious', label: 'Spacious' },
] satisfies ReadonlyArray<{ id: DensityId; label: string }>;

const selectedThemeId = ref<ThemeId>('deep-sea');
const selectedAccentId = ref('blue');
const dyslexicFont = ref(false);
const fontSize = ref(16);
const selectedDensity = ref<DensityId>('comfortable');

const selectedTheme = computed(() => themes.find((theme) => theme.id === selectedThemeId.value) ?? themes[0]);
const selectedAccent = computed(
  () => accentColors.find((color) => color.id === selectedAccentId.value) ?? accentColors[0],
);

function loadAppearanceState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const state = JSON.parse(raw) as Partial<{
      themeId: ThemeId;
      accentId: string;
      dyslexicFont: boolean;
      fontSize: number;
      density: DensityId;
    }>;

    if (state.themeId && themes.some((item) => item.id === state.themeId)) {
      selectedThemeId.value = state.themeId;
    }
    if (state.accentId && accentColors.some((item) => item.id === state.accentId)) {
      selectedAccentId.value = state.accentId;
    }
    if (typeof state.dyslexicFont === 'boolean') {
      dyslexicFont.value = state.dyslexicFont;
    }
    if (typeof state.fontSize === 'number' && state.fontSize >= 12 && state.fontSize <= 24) {
      fontSize.value = state.fontSize;
    }
    if (state.density && densityOptions.some((item) => item.id === state.density)) {
      selectedDensity.value = state.density;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function applyAppearance() {
  const root = document.documentElement;
  const { tokens, mode } = selectedTheme.value;

  root.style.setProperty('--mneme-bg', tokens.bg);
  root.style.setProperty('--mneme-surface-container-low', tokens.surfaceContainerLow);
  root.style.setProperty('--mneme-surface-container', tokens.surfaceContainer);
  root.style.setProperty('--mneme-surface-container-high', tokens.surfaceContainerHigh);
  root.style.setProperty('--mneme-surface-container-highest', tokens.surfaceContainerHighest);
  root.style.setProperty('--mneme-on-surface', tokens.onSurface);
  root.style.setProperty('--mneme-on-surface-variant', tokens.onSurfaceVariant);
  root.style.setProperty('--mneme-outline', tokens.outline);
  root.style.setProperty('--mneme-outline-variant', tokens.outlineVariant);
  root.style.setProperty('--mneme-accent', selectedAccent.value.value);
  root.style.setProperty('--mneme-accent-strong', selectedAccent.value.strong);
  root.style.setProperty('--mneme-density', selectedDensity.value);
  root.style.fontSize = `${fontSize.value}px`;
  root.dataset.readingFont = dyslexicFont.value ? 'dyslexic' : 'default';
  setTheme(mode);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      themeId: selectedThemeId.value,
      accentId: selectedAccentId.value,
      dyslexicFont: dyslexicFont.value,
      fontSize: fontSize.value,
      density: selectedDensity.value,
    }),
  );
}

loadAppearanceState();

watch(
  [selectedThemeId, selectedAccentId, dyslexicFont, fontSize, selectedDensity],
  applyAppearance,
  { immediate: true },
);
</script>

<template>
  <div class="view-stack settings-view">
    <section class="settings-view__intro">
      <div>
        <p class="settings-view__eyebrow">Settings / Appearance</p>
        <h2>Customize your cognitive workspace.</h2>
        <p>
          Changes apply instantly across the shell, preview, and content surfaces so you can tune
          contrast, rhythm, and reading comfort in one pass.
        </p>
      </div>
      <span class="settings-view__status">Auto-Sync Enabled</span>
    </section>

    <div class="settings-view__grid">
      <div class="settings-view__controls">
        <section class="settings-section">
          <div class="settings-section__head">
            <div>
              <h3>Theme</h3>
              <p>Choose the base environment for navigation, content panels, and the workspace canvas.</p>
            </div>
          </div>

          <div class="settings-theme-grid">
            <ThemeCard
              v-for="theme in themes"
              :key="theme.id"
              :active="selectedThemeId === theme.id"
              :id="theme.id"
              :label="theme.label"
              :preview="theme.preview"
              :subtitle="theme.subtitle"
              @select="selectedThemeId = $event as ThemeId"
            />
          </div>
        </section>

        <section class="settings-section settings-section--panel">
          <div class="settings-section__head">
            <div>
              <h3>Accent Color</h3>
              <p>Used for active states, primary actions, highlights, and graph emphasis.</p>
            </div>
          </div>

          <AccentPicker
            :colors="accentColors"
            :selected="selectedAccentId"
            @select="selectedAccentId = $event"
          />
        </section>

        <section class="settings-section settings-section--panel">
          <div class="settings-section__head">
            <div>
              <h3>Typography</h3>
              <p>Adjust type size and accessibility defaults for long reading sessions.</p>
            </div>
          </div>

          <TypographySettings
            v-model:dyslexic-font="dyslexicFont"
            v-model:font-size="fontSize"
          />
        </section>

        <section class="settings-section">
          <div class="settings-section__head">
            <div>
              <h3>Interface Density</h3>
              <p>Control spacing between panels, controls, and navigation rows.</p>
            </div>
          </div>

          <DensitySelector
            :options="densityOptions"
            :selected="selectedDensity"
            @select="selectedDensity = $event as DensityId"
          />
        </section>
      </div>

      <aside class="settings-view__preview">
        <LivePreviewPanel
          :accent-color="selectedAccent.value"
          :density="selectedDensity"
          :dyslexic-font="dyslexicFont"
          :font-size="fontSize"
          :theme-bg="selectedTheme.tokens.bg"
          :theme-elevated="selectedTheme.tokens.surfaceContainerLow"
          :theme-label="selectedTheme.label"
          :theme-surface="selectedTheme.tokens.surfaceContainer"
          :theme-surface-high="selectedTheme.tokens.surfaceContainerHigh"
          :theme-surface-highest="selectedTheme.tokens.surfaceContainerHighest"
          :theme-text="selectedTheme.tokens.onSurface"
          :theme-text-muted="selectedTheme.tokens.onSurfaceVariant"
        />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  gap: 2rem;
}

.settings-view__intro {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.settings-view__eyebrow {
  margin: 0 0 0.65rem;
  color: rgba(211, 228, 254, 0.56);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.settings-view__intro h2 {
  margin: 0 0 0.55rem;
  color: var(--app-ink);
  font-size: clamp(1.7rem, 2vw, 2.3rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.settings-view__intro p:last-child {
  max-width: 44rem;
  margin: 0;
  color: var(--app-ink-soft);
  line-height: 1.7;
}

.settings-view__status {
  display: inline-flex;
  align-items: center;
  min-height: 2rem;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--app-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--app-ink-soft);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.settings-view__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(22rem, 28rem);
  gap: 2rem;
  align-items: start;
}

.settings-view__controls {
  display: grid;
  gap: 1.6rem;
}

.settings-section {
  display: grid;
  gap: 1rem;
}

.settings-section--panel {
  padding: 1.4rem;
  border: 1px solid var(--app-line);
  border-radius: 1.25rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 100%),
    rgba(16, 32, 52, 0.88);
}

.settings-section__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
}

.settings-section__head h3 {
  margin: 0 0 0.35rem;
  color: var(--app-ink);
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.settings-section__head p {
  margin: 0;
  color: var(--app-ink-soft);
  line-height: 1.65;
}

.settings-theme-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.settings-view__preview {
  position: sticky;
  top: 1.5rem;
}

@media (max-width: 1180px) {
  .settings-view__grid {
    grid-template-columns: 1fr;
  }

  .settings-view__preview {
    position: static;
  }
}

@media (max-width: 720px) {
  .settings-view__intro {
    flex-direction: column;
  }

  .settings-theme-grid {
    grid-template-columns: 1fr;
  }

  .settings-section--panel {
    padding: 1.1rem;
  }
}
</style>
