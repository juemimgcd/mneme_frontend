<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import ThemeCard from '@/components/settings/ThemeCard.vue';
import AccentPicker from '@/components/settings/AccentPicker.vue';
import TypographySettings from '@/components/settings/TypographySettings.vue';
import DensitySelector from '@/components/settings/DensitySelector.vue';
import LivePreviewPanel from '@/components/settings/LivePreviewPanel.vue';

const router = useRouter();
const session = useSessionStore();

// ── Theme ────────────────────────────────────────────────────────────────────

type ThemeId = 'deep-sea' | 'solar' | 'graphite' | 'cyber';

interface ThemePreview {
  bg: string;
  elevated: string;
  accent: string;
  text: string;
}

interface AppTheme {
  id: ThemeId;
  label: string;
  preview: ThemePreview;
}

const themes: AppTheme[] = [
  {
    id: 'deep-sea',
    label: 'Deep Sea',
    preview: { bg: '#06080c', elevated: '#0d1118', accent: '#7f9dff', text: '#f6f7fb' },
  },
  {
    id: 'solar',
    label: 'Solar',
    preview: { bg: '#1a1200', elevated: '#231800', accent: '#f5c96a', text: '#fef3d0' },
  },
  {
    id: 'graphite',
    label: 'Graphite',
    preview: { bg: '#111214', elevated: '#1b1e24', accent: '#9cb5ff', text: '#e8eaf0' },
  },
  {
    id: 'cyber',
    label: 'Cyber',
    preview: { bg: '#020d07', elevated: '#091b10', accent: '#39e87b', text: '#ccf5de' },
  },
];

const selectedThemeId = ref<ThemeId>('deep-sea');
const selectedTheme = computed(() => themes.find((t) => t.id === selectedThemeId.value)!);

function selectTheme(id: string) {
  selectedThemeId.value = id as ThemeId;
}

// ── Accent color ─────────────────────────────────────────────────────────────

const accentColors = [
  { id: 'indigo', value: '#7f9dff', label: 'Indigo' },
  { id: 'teal', value: '#4fc3c0', label: 'Teal' },
  { id: 'amber', value: '#f5c96a', label: 'Amber' },
  { id: 'coral', value: '#ff8872', label: 'Coral' },
  { id: 'violet', value: '#c07aff', label: 'Violet' },
  { id: 'sage', value: '#78c17a', label: 'Sage' },
];

const selectedAccentId = ref('indigo');
const selectedAccentColor = computed(
  () => accentColors.find((c) => c.id === selectedAccentId.value)?.value ?? '#7f9dff',
);

// ── Typography ────────────────────────────────────────────────────────────────

const dyslexicFont = ref(false);
const fontSize = ref(16);

// ── Density ──────────────────────────────────────────────────────────────────

const densityOptions = [
  { id: 'compact', label: 'Compact' },
  { id: 'normal', label: 'Normal' },
  { id: 'spacious', label: 'Spacious' },
];
const selectedDensity = ref('normal');

// ── Navigation ────────────────────────────────────────────────────────────────

const workspaceNavItems = [
  { name: 'dashboard', label: 'Desk' },
  { name: 'knowledge-bases', label: 'Collections' },
  { name: 'documents', label: 'Library' },
  { name: 'chat', label: 'Notes' },
];

const analysisNavItems = [
  { name: 'graph', label: 'Canvas' },
  { name: 'memory', label: 'Memory' },
  { name: 'insights', label: 'Review' },
];

function logout() {
  session.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <div class="settings-page">
    <!-- ── Desktop Sidebar ─────────────────────────────────────────────────── -->
    <aside class="settings-sidebar" aria-label="Settings navigation">
      <RouterLink class="settings-brand" :to="{ name: 'dashboard' }">
        <span class="settings-brand__glyph" aria-hidden="true">M</span>
        <span class="settings-brand__text">
          <strong>Mneme</strong>
          <small>Settings</small>
        </span>
      </RouterLink>

      <nav class="settings-nav" aria-label="Navigation">
        <div class="settings-nav__group">
          <p class="settings-nav__caption">Workspace</p>
          <RouterLink
            v-for="item in workspaceNavItems"
            :key="item.name"
            class="settings-nav__link"
            :to="{ name: item.name }"
          >{{ item.label }}</RouterLink>
        </div>

        <div class="settings-nav__group">
          <p class="settings-nav__caption">Analysis</p>
          <RouterLink
            v-for="item in analysisNavItems"
            :key="item.name"
            class="settings-nav__link"
            :to="{ name: item.name }"
          >{{ item.label }}</RouterLink>
        </div>

        <div class="settings-nav__group">
          <p class="settings-nav__caption">Settings</p>
          <RouterLink
            class="settings-nav__link settings-nav__link--current"
            :to="{ name: 'settings-appearance' }"
          >Appearance</RouterLink>
        </div>
      </nav>

      <div class="settings-sidebar__footer">
        <button class="settings-signout" type="button" @click="logout">Sign out</button>
      </div>
    </aside>

    <!-- ── Main Content ────────────────────────────────────────────────────── -->
    <main id="app-main" class="settings-main">
      <header class="settings-header">
        <nav class="settings-breadcrumb" aria-label="Breadcrumb">
          <RouterLink :to="{ name: 'dashboard' }">Settings</RouterLink>
          <span aria-hidden="true">›</span>
          <span aria-current="page">Appearance</span>
        </nav>
        <h1 class="settings-title">Appearance</h1>
        <p class="settings-desc">
          Customize how Mneme looks and feels. Changes are applied instantly and saved locally.
        </p>
      </header>

      <div class="settings-body">
        <!-- Settings form column -->
        <div class="settings-form">
          <!-- Theme -->
          <section class="settings-section" aria-labelledby="theme-heading">
            <div class="settings-section__head">
              <h2 id="theme-heading" class="settings-section__title">Theme</h2>
              <p class="settings-section__hint">Choose a base color scheme for the interface.</p>
            </div>
            <div class="theme-grid">
              <ThemeCard
                v-for="theme in themes"
                :key="theme.id"
                :id="theme.id"
                :label="theme.label"
                :active="selectedThemeId === theme.id"
                :preview="theme.preview"
                @select="selectTheme"
              />
            </div>
          </section>

          <!-- Accent color -->
          <section class="settings-section" aria-labelledby="accent-heading">
            <div class="settings-section__head">
              <h2 id="accent-heading" class="settings-section__title">Accent Color</h2>
              <p class="settings-section__hint">
                Highlight color used for active states and interactive elements.
              </p>
            </div>
            <AccentPicker
              :colors="accentColors"
              :selected="selectedAccentId"
              @select="selectedAccentId = $event"
            />
          </section>

          <!-- Typography -->
          <section class="settings-section" aria-labelledby="typography-heading">
            <div class="settings-section__head">
              <h2 id="typography-heading" class="settings-section__title">Typography</h2>
              <p class="settings-section__hint">Font and sizing preferences for readability.</p>
            </div>
            <TypographySettings
              v-model:dyslexic-font="dyslexicFont"
              v-model:font-size="fontSize"
            />
          </section>

          <!-- Interface density -->
          <section class="settings-section" aria-labelledby="density-heading">
            <div class="settings-section__head">
              <h2 id="density-heading" class="settings-section__title">Interface Density</h2>
              <p class="settings-section__hint">
                Control spacing and padding throughout the interface.
              </p>
            </div>
            <DensitySelector
              :options="densityOptions"
              :selected="selectedDensity"
              @select="selectedDensity = $event"
            />
          </section>
        </div>

        <!-- Live preview column (xl+) -->
        <aside class="settings-preview" aria-label="Live preview">
          <div class="settings-preview__sticky">
            <LivePreviewPanel
              :theme-label="selectedTheme.label"
              :theme-bg="selectedTheme.preview.bg"
              :theme-elevated="selectedTheme.preview.elevated"
              :theme-accent="selectedTheme.preview.accent"
              :theme-text="selectedTheme.preview.text"
              :accent-color="selectedAccentColor"
              :dyslexic-font="dyslexicFont"
              :font-size="fontSize"
              :density="selectedDensity"
            />
          </div>
        </aside>
      </div>
    </main>

    <!-- ── Mobile Bottom Navigation ──────────────────────────────────────── -->
    <nav class="bottom-nav" aria-label="Mobile navigation">
      <RouterLink class="bottom-nav__item" :to="{ name: 'dashboard' }">
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22" aria-hidden="true">
          <path
            d="M5 10.5 12 6l7 4.5v7L12 22l-7-4.5Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Home</span>
      </RouterLink>

      <RouterLink class="bottom-nav__item" :to="{ name: 'knowledge-bases' }">
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22" aria-hidden="true">
          <path
            d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Collections</span>
      </RouterLink>

      <RouterLink
        class="bottom-nav__item bottom-nav__item--active"
        :to="{ name: 'settings-appearance' }"
        aria-current="page"
      >
        <svg viewBox="0 0 24 24" fill="none" width="22" height="22" aria-hidden="true">
          <path
            d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Appearance</span>
      </RouterLink>
    </nav>
  </div>
</template>

<style scoped>
/* ── Page shell ─────────────────────────────────────────────────────────────── */
.settings-page {
  display: flex;
  min-height: 100vh;
  background:
    radial-gradient(circle at 10% -10%, rgba(127, 157, 255, 0.1), transparent 30%),
    radial-gradient(circle at 92% 8%, rgba(255, 255, 255, 0.03), transparent 26%),
    var(--bg);
  color: var(--fg);
  font-family: var(--font-sans);
}

/* ── Sidebar ─────────────────────────────────────────────────────────────────── */
.settings-sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 240px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.025) 0%, transparent 100%),
    var(--bg-elevated);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 1rem;
  gap: 1.5rem;
  z-index: 20;
  overflow-y: auto;
}

/* Brand */
.settings-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  color: var(--fg);
  border-radius: 8px;
  padding: 0.2rem 0.3rem;
  transition: background 150ms ease;
}

.settings-brand:hover {
  background: rgba(255, 255, 255, 0.04);
}

.settings-brand:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.settings-brand__glyph {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 8px;
  background: linear-gradient(135deg, #233a55 0%, #667f92 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1rem;
  color: #fbf8f2;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(47, 73, 104, 0.4);
}

.settings-brand__text strong {
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.settings-brand__text small {
  font-size: 0.7rem;
  color: var(--fg-soft);
  display: block;
}

/* Nav */
.settings-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.settings-nav__group {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.settings-nav__caption {
  margin: 0 0 0.3rem;
  padding: 0 0.5rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--fg-soft);
  opacity: 0.55;
}

.settings-nav__link {
  display: block;
  padding: 0.52rem 0.75rem;
  border-radius: 7px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--fg-soft);
  text-decoration: none;
  transition: background 150ms ease, color 150ms ease;
}

.settings-nav__link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--fg);
}

.settings-nav__link--current,
.settings-nav__link.router-link-active {
  background: rgba(127, 157, 255, 0.12);
  color: var(--primary);
}

.settings-nav__link:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* Sidebar footer */
.settings-sidebar__footer {
  padding-top: 1rem;
  border-top: 1px solid var(--border);
}

.settings-signout {
  width: 100%;
  padding: 0.52rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: transparent;
  color: var(--fg-soft);
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}

.settings-signout:hover {
  background: rgba(255, 90, 90, 0.08);
  color: #ff6b6b;
  border-color: rgba(255, 90, 90, 0.25);
}

.settings-signout:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

/* ── Main ────────────────────────────────────────────────────────────────────── */
.settings-main {
  flex: 1;
  margin-left: 240px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* Header */
.settings-header {
  padding: 2rem 2.5rem 1.5rem;
  border-bottom: 1px solid var(--border);
}

.settings-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.6rem;
  font-size: 0.78rem;
  color: var(--fg-soft);
}

.settings-breadcrumb a {
  color: var(--fg-soft);
  text-decoration: none;
  transition: color 150ms ease;
}

.settings-breadcrumb a:hover {
  color: var(--fg);
}

.settings-breadcrumb a:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
  border-radius: 3px;
}

.settings-title {
  margin: 0 0 0.4rem;
  font-size: 1.85rem;
  font-weight: 700;
  letter-spacing: -0.045em;
  line-height: 1.1;
  color: var(--fg);
}

.settings-desc {
  margin: 0;
  font-size: 0.88rem;
  color: var(--fg-soft);
  line-height: 1.65;
  max-width: 52ch;
}

/* Body — 2-column on xl */
.settings-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 2rem;
  padding: 2rem 2.5rem;
  align-items: start;
  flex: 1;
}

/* Form column */
.settings-form {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Section */
.settings-section {
  padding: 1.75rem 0;
  border-bottom: 1px solid var(--border);
}

.settings-section:last-child {
  border-bottom: none;
}

.settings-section__head {
  margin-bottom: 1.25rem;
}

.settings-section__title {
  margin: 0 0 0.3rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--fg);
  letter-spacing: -0.02em;
}

.settings-section__hint {
  margin: 0;
  font-size: 0.8rem;
  color: var(--fg-soft);
  line-height: 1.55;
}

/* Theme grid */
.theme-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.75rem;
}

/* Preview column */
.settings-preview {
  /* visible at xl+; hidden below */
}

.settings-preview__sticky {
  position: sticky;
  top: 1.5rem;
}

/* ── Bottom navigation (mobile) ─────────────────────────────────────────────── */
.bottom-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  padding: 0.5rem 0 max(0.5rem, env(safe-area-inset-bottom, 0.5rem));
  z-index: 30;
}

.bottom-nav__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.22rem;
  flex: 1;
  padding: 0.35rem 0.5rem;
  text-decoration: none;
  color: var(--fg-soft);
  font-size: 0.68rem;
  font-weight: 500;
  transition: color 150ms ease;
}

.bottom-nav__item:hover,
.bottom-nav__item--active,
.bottom-nav__item.router-link-active {
  color: var(--primary);
}

.bottom-nav__item:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

/* ── Responsive ─────────────────────────────────────────────────────────────── */

/* Hide preview below 1280px */
@media (max-width: 1280px) {
  .settings-body {
    grid-template-columns: 1fr;
  }

  .settings-preview {
    display: none;
  }
}

/* Collapse to mobile layout below 768px */
@media (max-width: 768px) {
  .settings-sidebar {
    display: none;
  }

  .settings-main {
    margin-left: 0;
    padding-bottom: 5rem;
  }

  .settings-header {
    padding: 1.25rem 1.25rem 1rem;
  }

  .settings-body {
    padding: 1.25rem;
    gap: 0;
  }

  .theme-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .bottom-nav {
    display: flex;
  }
}
</style>
