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

    </section>
  </div>
</template>
