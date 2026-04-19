<script setup lang="ts">
import { reactive } from 'vue';
import { useRouter } from 'vue-router';
import SignInPanel from '@/components/ui/SignInPanel.vue';
import { useSessionStore } from '@/stores/session';

const router = useRouter();
const session = useSessionStore();
const form = reactive({
  username: '',
  password: '',
});

const testimonials = [
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/44.jpg',
    name: 'Leah Santos',
    handle: '@leahnotes',
    text: 'The onboarding feels cinematic without getting in the way of actual work.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/men/28.jpg',
    name: 'Noah Kim',
    handle: '@noaharchive',
    text: 'It gives my writing and research a place to return to instead of disappearing into folders.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/12.jpg',
    name: 'Ava Foster',
    handle: '@avafields',
    text: 'The system feels composed. You can sense the structure before you even upload the first file.',
  },
] as const;

async function submit() {
  await session.register(form);
  router.push({ name: 'dashboard' });
}
</script>

<template>
  <main class="login-view">
    <SignInPanel
      v-model:username="form.username"
      v-model:password="form.password"
      :error="session.error"
      :hero-image-src="'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=2160&q=80'"
      :loading="session.loading"
      :password-minlength="8"
      :show-secondary="false"
      :testimonials="testimonials"
      description="Create your account and continue with a fresh workspace."
      footer-action-label="Sign In"
      footer-prompt="Already have an account?"
      footer-route-name="login"
      password-autocomplete="new-password"
      submit-label="Create Account"
      support-label="Password rules"
      title="Create Account"
      @submit="submit"
    />
  </main>
</template>
