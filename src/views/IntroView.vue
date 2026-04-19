<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import SpiralAnimation from '@/components/ui/SpiralAnimation.vue';

const router = useRouter();
const isReady = ref(false);

const enterExperience = () => {
  router.push({ name: 'login' });
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
      <strong class="intro-page__logotype">MNEME</strong>
    </header>

    <section class="intro-page__content">
      <p class="intro-page__hint">Memory Workspace</p>

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
      <span>Press Enter To Continue</span>
    </footer>
  </main>
</template>
