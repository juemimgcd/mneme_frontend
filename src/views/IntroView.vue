<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SpiralAnimation from '@/components/ui/SpiralAnimation.vue';

const router = useRouter();
const isReady = ref(false);

const enterExperience = () => {
  router.push({ name: 'landing' });
};

let revealTimer: number | null = null;

onMounted(() => {
  revealTimer = window.setTimeout(() => {
    isReady.value = true;
  }, 1800);
});

onBeforeUnmount(() => {
  if (revealTimer !== null) {
    window.clearTimeout(revealTimer);
  }
});
</script>

<template>
  <main class="intro-page">
    <SpiralAnimation />

    <div class="intro-page__veil" />

    <header class="intro-page__brand">
      <span class="intro-page__eyebrow">Mneme / Memory Workspace</span>
      <strong class="intro-page__logotype">MNEME</strong>
    </header>

    <section class="intro-page__content">
      <p class="intro-page__kicker">Open Sequence</p>
      <h1>让记忆先出现，再进入工作台。</h1>
      <p class="intro-page__summary">
        这个引入页作为前端打开时的第一屏，保留一段纯黑场与螺旋粒子，随后进入原有产品落地页。
      </p>

      <button
        class="intro-page__enter"
        :class="{ 'is-visible': isReady }"
        type="button"
        @click="enterExperience"
      >
        Enter
      </button>
    </section>

    <footer class="intro-page__meta">
      <span>Vue 3 + TypeScript + GSAP</span>
      <span>Press Enter To Continue</span>
    </footer>
  </main>
</template>
