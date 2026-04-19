<script setup lang="ts">
import { Eye, EyeOff } from 'lucide-vue-next';
import { ref } from 'vue';

interface Testimonial {
  avatarSrc: string;
  name: string;
  handle: string;
  text: string;
}

withDefaults(
  defineProps<{
    username: string;
    password: string;
    loading?: boolean;
    error?: string;
    title?: string;
    description?: string;
    fieldLabel?: string;
    fieldType?: string;
    fieldName?: string;
    fieldPlaceholder?: string;
    passwordLabel?: string;
    passwordPlaceholder?: string;
    passwordAutocomplete?: string;
    passwordMinlength?: number;
    submitLabel?: string;
    supportLabel?: string;
    dividerLabel?: string;
    secondaryLabel?: string;
    secondaryRouteName?: string;
    footerPrompt?: string;
    footerActionLabel?: string;
    footerRouteName?: string;
    heroImageSrc?: string;
    testimonials?: readonly Testimonial[];
    showSecondary?: boolean;
    showFooter?: boolean;
  }>(),
  {
    loading: false,
    error: '',
    title: 'Welcome',
    description: 'Access your account and continue your journey with us',
    fieldLabel: 'Username',
    fieldType: 'text',
    fieldName: 'username',
    fieldPlaceholder: 'Enter your username',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Enter your password',
    passwordAutocomplete: 'current-password',
    passwordMinlength: undefined,
    submitLabel: 'Sign In',
    supportLabel: 'Reset password',
    dividerLabel: 'Or continue with',
    secondaryLabel: 'Continue',
    secondaryRouteName: 'register',
    footerPrompt: 'New to our platform?',
    footerActionLabel: 'Create Account',
    footerRouteName: 'register',
    heroImageSrc: '',
    testimonials: () => [],
    showSecondary: true,
    showFooter: true,
  },
);

const emit = defineEmits<{
  'update:username': [value: string];
  'update:password': [value: string];
  submit: [];
  reset: [];
}>();

const showPassword = ref(false);
</script>

<template>
  <div class="auth-template">
    <section class="auth-template__form">
      <div class="auth-template__content">
        <div class="auth-template__header">
          <h1>{{ title }}</h1>
          <p>{{ description }}</p>
        </div>

        <form class="auth-template__stack" @submit.prevent="emit('submit')">
          <div class="auth-template__field">
            <label :for="fieldName">{{ fieldLabel }}</label>
            <div class="auth-template__glass">
              <input
                :id="fieldName"
                :name="fieldName"
                :type="fieldType"
                :value="username"
                :placeholder="fieldPlaceholder"
                autocomplete="username"
                class="auth-template__input"
                required
                @input="emit('update:username', ($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>

          <div class="auth-template__field">
            <label for="password">{{ passwordLabel }}</label>
            <div class="auth-template__glass">
              <div class="auth-template__password">
                <input
                  id="password"
                  name="password"
                  :type="showPassword ? 'text' : 'password'"
                  :value="password"
                  :placeholder="passwordPlaceholder"
                  :autocomplete="passwordAutocomplete"
                  :minlength="passwordMinlength"
                  class="auth-template__input auth-template__input--password"
                  required
                  @input="emit('update:password', ($event.target as HTMLInputElement).value)"
                />
                <button
                  class="auth-template__icon-button"
                  type="button"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" />
                  <Eye v-else />
                </button>
              </div>
            </div>
          </div>

          <div class="auth-template__meta">
            <label class="auth-template__remember">
              <input type="checkbox" name="rememberMe" />
              <span>Keep me signed in</span>
            </label>
            <button class="auth-template__text-button" type="button" @click="emit('reset')">
              {{ supportLabel }}
            </button>
          </div>

          <p v-if="error" class="form-error auth-template__error" role="alert">{{ error }}</p>

          <button class="auth-template__submit" type="submit" :disabled="loading">
            {{ loading ? `${submitLabel}...` : submitLabel }}
          </button>
        </form>

        <div v-if="showSecondary" class="auth-template__divider">
          <span />
          <strong>{{ dividerLabel }}</strong>
        </div>

        <RouterLink
          v-if="showSecondary"
          class="auth-template__google"
          :to="{ name: secondaryRouteName }"
        >
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
            />
            <path
              fill="#FF3D00"
              d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.337-17.694 10.691z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
            />
          </svg>
          <span>{{ secondaryLabel }}</span>
        </RouterLink>

        <p v-if="showFooter" class="auth-template__footer">
          <span>{{ footerPrompt }}</span>
          <RouterLink :to="{ name: footerRouteName }">{{ footerActionLabel }}</RouterLink>
        </p>
      </div>
    </section>

    <section v-if="heroImageSrc" class="auth-template__visual">
      <div
        class="auth-template__hero"
        :style="{ backgroundImage: `url(${heroImageSrc})` }"
      />

      <div v-if="testimonials.length" class="auth-template__testimonials">
        <article
          v-for="(testimonial, index) in testimonials.slice(0, 3)"
          :key="`${testimonial.name}-${index}`"
          class="auth-template__card"
          :class="{
            'is-xl-only': index === 1,
            'is-2xl-only': index === 2,
          }"
          :style="{ animationDelay: `${1 + index * 0.2}s` }"
        >
          <img :src="testimonial.avatarSrc" :alt="testimonial.name" />
          <div>
            <p class="auth-template__card-name">{{ testimonial.name }}</p>
            <p class="auth-template__card-handle">{{ testimonial.handle }}</p>
            <p class="auth-template__card-text">{{ testimonial.text }}</p>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
