<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import SignInPanel from '@/components/ui/SignInPanel.vue';
import { useSessionStore } from '@/stores/session';

const router = useRouter();
const session = useSessionStore();
const form = reactive({
  username: 'mneme_demo',
  password: '12345678',
});

const testimonials = [
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/57.jpg',
    name: 'Sarah Chen',
    handle: '@sarahdigital',
    text: 'The workspace feels calm, focused, and finally lets my notes stay connected.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/men/64.jpg',
    name: 'Marcus Johnson',
    handle: '@marcustech',
    text: 'Less dashboard noise, more clarity. I can move from memory to insight without friction.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/31.jpg',
    name: 'Elena Park',
    handle: '@elenaarchive',
    text: 'It turns scattered writing into a place that actually feels readable and alive.',
  },
] as const;

async function submit() {
  await session.login(form);
  router.push({ name: 'dashboard' });
}
</script>

<template>
  <main class="login-view">
    <SignInPanel
      v-model:username="form.username"
      v-model:password="form.password"
      :error="session.error"
      :hero-image-src="'https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80'"
      :loading="session.loading"
      :testimonials="testimonials"
      description="Access your account and continue your journey with us."
      divider-label="Or"
      footer-action-label="Create Account"
      footer-prompt="No account yet?"
      footer-route-name="register"
      :show-footer="false"
      secondary-label="Sign Up"
      secondary-route-name="register"
      submit-label="Sign In"
      support-label="Reset password"
      title="Welcome"
      @submit="submit"
    />
  </main>
</template>
