<script setup lang="ts">
defineProps<{
  themeLabel: string;
  themeBg: string;
  themeElevated: string;
  themeSurface: string;
  themeSurfaceHigh: string;
  themeSurfaceHighest: string;
  themeText: string;
  themeTextMuted: string;
  accentColor: string;
  dyslexicFont: boolean;
  fontSize: number;
  density: string;
}>();

const densityPadding: Record<string, string> = {
  compact: '0.85rem',
  comfortable: '1rem',
  spacious: '1.2rem',
};
</script>

<template>
  <div class="preview-panel">
    <div class="preview-panel__header">
      <div class="preview-panel__traffic">
        <span />
        <span />
        <span />
      </div>
      <span class="preview-panel__label">Live Preview</span>
      <span class="preview-panel__spacer" />
    </div>

    <div
      class="preview-panel__viewport"
      :style="{
        background: themeBg,
        color: themeText,
        fontSize: `${fontSize * 0.58}px`,
        fontFamily: dyslexicFont ? '\'OpenDyslexic\', sans-serif' : '\'Inter\', sans-serif',
        '--preview-panel': themeSurface,
        '--preview-panel-high': themeSurfaceHigh,
        '--preview-panel-highest': themeSurfaceHighest,
        '--preview-muted': themeTextMuted,
        '--preview-accent': accentColor,
        '--preview-padding': densityPadding[density] ?? densityPadding.comfortable,
      }"
    >
      <div class="preview-panel__glow" />

      <div class="preview-topbar">
        <div class="preview-topbar__brand">
          <span class="preview-topbar__badge" />
          <div>
            <strong>Cognitive Architecture</strong>
            <span>Draft</span>
          </div>
        </div>
      </div>

      <div class="preview-graph">
        <div class="preview-graph__grid" />
        <span class="preview-graph__node preview-graph__node--small preview-graph__node--top" />
        <span class="preview-graph__node preview-graph__node--small preview-graph__node--bottom" />
        <span class="preview-graph__line preview-graph__line--left" />
        <span class="preview-graph__line preview-graph__line--right" />
        <span class="preview-graph__node preview-graph__node--center" />
      </div>

      <div class="preview-copy">
        <span class="preview-copy__line preview-copy__line--wide" />
        <span class="preview-copy__line" />
        <span class="preview-copy__line preview-copy__line--short" />

        <div class="preview-copy__tags">
          <span>#neuroscience</span>
          <span>#design-system</span>
        </div>
      </div>

      <button class="preview-fab" type="button" aria-label="Create new note" />
    </div>

    <div class="preview-panel__footer">
      <span>{{ themeLabel }}</span>
      <span>·</span>
      <span>{{ fontSize }}px</span>
      <span>·</span>
      <span class="preview-panel__footer-capitalize">{{ density }}</span>
    </div>
  </div>
</template>

<style scoped>
.preview-panel {
  overflow: hidden;
  border: 1px solid var(--app-line);
  border-radius: 1.3rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 100%),
    rgba(11, 28, 48, 0.92);
  box-shadow: var(--app-shadow-soft);
}

.preview-panel__header,
.preview-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem;
}

.preview-panel__header {
  border-bottom: 1px solid var(--app-line);
}

.preview-panel__footer {
  border-top: 1px solid var(--app-line);
  color: var(--app-ink-soft);
  font-size: 0.76rem;
}

.preview-panel__traffic {
  display: flex;
  gap: 0.35rem;
}

.preview-panel__traffic span {
  width: 0.52rem;
  height: 0.52rem;
  border-radius: 999px;
}

.preview-panel__traffic span:first-child {
  background: rgba(248, 113, 113, 0.8);
}

.preview-panel__traffic span:nth-child(2) {
  background: rgba(250, 204, 21, 0.8);
}

.preview-panel__traffic span:last-child {
  background: rgba(74, 222, 128, 0.8);
}

.preview-panel__label {
  color: var(--app-ink-soft);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.preview-panel__spacer {
  width: 2.3rem;
}

.preview-panel__viewport {
  position: relative;
  min-height: 35rem;
  padding: var(--preview-padding);
  overflow: hidden;
}

.preview-panel__glow {
  position: absolute;
  top: -4rem;
  right: -2rem;
  width: 14rem;
  height: 14rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--preview-accent) 18%, transparent);
  filter: blur(52px);
  pointer-events: none;
}

.preview-topbar {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  padding-bottom: var(--preview-padding);
  border-bottom: 1px solid color-mix(in srgb, var(--preview-muted) 20%, transparent);
}

.preview-topbar__brand {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.preview-topbar__badge {
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid color-mix(in srgb, var(--preview-muted) 20%, transparent);
  border-radius: 0.8rem;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.16), transparent 34%),
    color-mix(in srgb, var(--preview-accent) 22%, var(--preview-panel-high));
}

.preview-topbar strong,
.preview-topbar span {
  display: block;
}

.preview-topbar strong {
  margin-bottom: 0.18rem;
}

.preview-topbar span {
  color: var(--preview-accent);
}

.preview-graph,
.preview-copy {
  position: relative;
  z-index: 1;
  border: 1px solid color-mix(in srgb, var(--preview-muted) 18%, transparent);
  border-radius: 1rem;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 100%),
    var(--preview-panel);
}

.preview-graph {
  height: 13rem;
  margin-top: var(--preview-padding);
  overflow: hidden;
}

.preview-graph__grid {
  position: absolute;
  inset: 0;
  opacity: 0.12;
  background-image:
    linear-gradient(to right, currentColor 1px, transparent 1px),
    linear-gradient(to bottom, currentColor 1px, transparent 1px);
  background-size: 1rem 1rem;
}

.preview-graph__node,
.preview-graph__line {
  position: absolute;
  display: block;
}

.preview-graph__node {
  border-radius: 999px;
}

.preview-graph__node--center {
  top: 50%;
  left: 50%;
  width: 3.2rem;
  height: 3.2rem;
  background: color-mix(in srgb, var(--preview-accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--preview-accent) 55%, transparent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--preview-accent) 18%, transparent);
  transform: translate(-50%, -50%);
}

.preview-graph__node--small {
  width: 2.1rem;
  height: 2.1rem;
  border: 1px solid color-mix(in srgb, var(--preview-muted) 22%, transparent);
  background: var(--preview-panel-high);
}

.preview-graph__node--top {
  top: 1.6rem;
  left: 2.4rem;
}

.preview-graph__node--bottom {
  right: 2.4rem;
  bottom: 1.8rem;
  border-color: color-mix(in srgb, var(--preview-accent) 40%, transparent);
}

.preview-graph__line {
  height: 1px;
  transform-origin: left center;
}

.preview-graph__line--left {
  top: 3rem;
  left: 3.8rem;
  width: 8rem;
  background: color-mix(in srgb, var(--preview-muted) 26%, transparent);
  transform: rotate(26deg);
}

.preview-graph__line--right {
  right: 4rem;
  bottom: 3.2rem;
  width: 8rem;
  background: color-mix(in srgb, var(--preview-accent) 42%, transparent);
  transform: rotate(-28deg);
}

.preview-copy {
  display: grid;
  gap: 0.7rem;
  margin-top: var(--preview-padding);
  padding: var(--preview-padding);
}

.preview-copy__line {
  display: block;
  height: 0.58rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--preview-muted) 34%, transparent);
}

.preview-copy__line--wide {
  width: 88%;
}

.preview-copy__line--short {
  width: 66%;
}

.preview-copy__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.3rem;
}

.preview-copy__tags span {
  padding: 0.32rem 0.52rem;
  border: 1px solid color-mix(in srgb, var(--preview-accent) 18%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--preview-accent) 10%, transparent);
  color: var(--preview-accent);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.preview-fab {
  position: absolute;
  right: 1.5rem;
  bottom: 1.5rem;
  width: 3rem;
  height: 3rem;
  border: 0;
  border-radius: 999px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent),
    var(--preview-accent);
  box-shadow: 0 14px 28px color-mix(in srgb, var(--preview-accent) 24%, transparent);
}

.preview-fab::before,
.preview-fab::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  background: rgba(0, 33, 77, 0.88);
  border-radius: 999px;
}

.preview-fab::before {
  width: 0.9rem;
  height: 0.14rem;
}

.preview-fab::after {
  width: 0.14rem;
  height: 0.9rem;
}

.preview-panel__footer-capitalize {
  text-transform: capitalize;
}
</style>
