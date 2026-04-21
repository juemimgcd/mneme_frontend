<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { gsap } from 'gsap';
import SpiralAnimation from '@/components/ui/SpiralAnimation.vue';

const router = useRouter();
const isReady = ref(false);
const introElement = ref<HTMLElement | null>(null);

const enterExperience = () => {
  router.push({ name: 'login' });
};

let revealTimer: number | null = null;
let introReveal: gsap.core.Timeline | null = null;

onMounted(() => {
  if (!document.documentElement.classList.contains('reduced-motion') && introElement.value) {
    introReveal = gsap.timeline({ defaults: { ease: 'power3.out' } });
    introReveal
      .from(introElement.value.querySelector('.intro-page__brand'), {
        y: -16,
        opacity: 0,
        filter: 'blur(8px)',
        duration: 0.56,
      })
      .from(
        introElement.value.querySelector('.intro-page__hint'),
        { y: 12, opacity: 0, duration: 0.52 },
        '-=0.26',
      )
      .from(
        introElement.value.querySelector('.intro-page__meta'),
        { y: 12, opacity: 0, duration: 0.48 },
        '-=0.3',
      );
  }

  revealTimer = window.setTimeout(() => {
    isReady.value = true;
    if (!document.documentElement.classList.contains('reduced-motion') && introElement.value) {
      gsap.fromTo(
        introElement.value.querySelector('.intro-page__enter'),
        { y: 12, opacity: 0, scale: 0.98 },
        { y: 0, opacity: 1, scale: 1, duration: 0.58, ease: 'back.out(1.12)', clearProps: 'transform,opacity' },
      );
    }
  }, 1800);
});

onBeforeUnmount(() => {
  introReveal?.kill();
  if (revealTimer !== null) {
    window.clearTimeout(revealTimer);
  }
});
</script>

<template>
  <main ref="introElement" class="intro-page">
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
