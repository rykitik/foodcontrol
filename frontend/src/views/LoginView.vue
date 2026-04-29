<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import loginBuildingBgUrl from '@/assets/login-building-bg.png'
import BrandLogo from '@/components/common/BrandLogo.vue'
import AppIcon from '@/components/icons/AppIcon.vue'
import { APP_NAME, ORG_NAME } from '@/config/app'
import { roleHome } from '@/config/navigation'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = reactive({
  username: '',
  password: '',
})

const loading = ref(false)
const error = ref('')
const currentYear = new Date().getFullYear()
const sessionMessage = computed(() => {
  const reason = typeof route.query.reason === 'string' ? route.query.reason : ''
  if (reason === 'expired') {
    return 'Сессия истекла. Войдите снова.'
  }
  if (reason === 'logged_out') {
    return 'Вы вышли из системы.'
  }
  if (reason === 'network_unreachable') {
    return 'Сервер недоступен. Проверьте сеть и попробуйте снова.'
  }
  return ''
})

async function submit() {
  error.value = ''
  loading.value = true

  try {
    const user = await auth.login({
      username: form.username,
      password: form.password,
    })

    const redirect =
      typeof route.query.redirect === 'string' ? route.query.redirect : roleHome[user.role]
    await router.push(redirect)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Не удалось войти в систему'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <img
      class="login-building-bg"
      :src="loginBuildingBgUrl"
      alt=""
      aria-hidden="true"
      decoding="async"
    />

    <div class="login-content">
      <section class="auth-container" aria-labelledby="login-title">
        <header class="brand-block">
          <div class="brand-block__mark" aria-hidden="true">
            <BrandLogo alt="" />
          </div>

          <div class="brand-block__copy">
            <h1 class="brand-block__title">{{ APP_NAME }}</h1>
            <p class="brand-block__subtitle">{{ ORG_NAME }}</p>
          </div>
        </header>

        <p-card class="login-card">
          <template #title>
            <span id="login-title">Вход в систему</span>
          </template>
          <template #subtitle>
            <span class="login-card__subtitle">Введите логин и пароль для доступа</span>
          </template>
          <template #content>
            <form class="login-form" data-testid="login-form" @submit.prevent="submit">
              <label class="field">
                <span class="field__label">Логин</span>
                <span class="field__control">
                  <span class="field__icon" aria-hidden="true">
                    <AppIcon name="student" />
                  </span>
                  <p-input-text
                    v-model="form.username"
                    autocomplete="username"
                    name="username"
                    class="field-control"
                    placeholder="Введите логин"
                    data-testid="login-username"
                  />
                </span>
              </label>

              <label class="field">
                <span class="field__label">Пароль</span>
                <span class="field__control">
                  <span class="field__icon" aria-hidden="true">
                    <AppIcon name="lock" />
                  </span>
                  <p-password
                    v-model="form.password"
                    autocomplete="current-password"
                    input-id="login-password"
                    name="password"
                    class="field-control"
                    placeholder="Введите пароль"
                    :input-props="{ 'data-testid': 'login-password' }"
                    toggle-mask
                    :feedback="false"
                  />
                </span>
              </label>

              <div v-if="sessionMessage" class="notice-banner notice-banner--info">
                <AppIcon name="info" />
                <span>{{ sessionMessage }}</span>
              </div>

              <div v-if="error" class="notice-banner notice-banner--error">
                <AppIcon name="cancel" />
                <span>{{ error }}</span>
              </div>

              <p-button
                type="submit"
                label="Войти"
                :loading="loading"
                class="login-button"
                data-testid="login-submit"
              />
            </form>
          </template>
        </p-card>
      </section>

      <footer class="login-footer">&copy; {{ ORG_NAME }}, {{ currentYear }}</footer>
    </div>
  </main>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px 32px;
  overflow: hidden;
  background: #f7f9fc;
  isolation: isolate;
}

.login-building-bg {
  position: absolute;
  left: 50%;
  bottom: 40px;
  width: min(1500px, 100vw);
  min-width: 980px;
  height: auto;
  max-width: none;
  opacity: 0.32;
  pointer-events: none;
  transform: translateX(-50%);
  z-index: 0;
  user-select: none;
}

.login-content {
  position: relative;
  z-index: 1;
  width: min(520px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.auth-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.brand-block {
  width: 100%;
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 10px;
}

.brand-block__mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  flex: 0 0 46px;
  min-height: 46px;
  opacity: 0.9;
  filter: saturate(0.9);
}

.brand-block__copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brand-block__title,
.brand-block__subtitle {
  margin: 0;
}

.brand-block__title {
  max-width: 360px;
  color: #132344;
  font-size: clamp(2rem, 2.9vw, 2.5rem);
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.brand-block__subtitle {
  color: #6d788d;
  font-size: 0.96rem;
  font-weight: 600;
  line-height: 1.25;
}

.login-card {
  position: relative;
  z-index: 2;
  width: 100%;
  background: #ffffff;
  border: 1px solid rgba(216, 223, 235, 0.78);
  border-radius: 22px;
  box-shadow:
    0 24px 52px rgba(46, 63, 92, 0.07),
    0 8px 18px rgba(46, 63, 92, 0.04);
}

.login-card :deep(.p-card-body) {
  padding: 32px;
}

.login-card :deep(.p-card-caption) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.login-card :deep(.p-card-title) {
  margin: 0;
  color: #132344;
  font-size: 1.9rem;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.03em;
}

.login-card :deep(.p-card-subtitle) {
  margin: 0;
  color: #7b8598;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
}

.login-card :deep(.p-card-content) {
  padding-top: 24px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field__label {
  color: #6d788d;
  font-size: 0.96rem;
  font-weight: 700;
  line-height: 1.2;
}

.field__control {
  position: relative;
  display: block;
}

.field__icon {
  position: absolute;
  top: 50%;
  left: 18px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8b97ab;
  transform: translateY(-50%);
  pointer-events: none;
}

:deep(input.field-control),
:deep(.field-control .p-inputtext) {
  width: 100%;
  min-height: 56px;
  padding: 0 18px 0 54px;
  border: 1px solid #d5dceb;
  border-radius: 14px;
  background: #ffffff;
  color: #132344;
  box-shadow: none;
}

:deep(input.field-control::placeholder),
:deep(.field-control .p-inputtext::placeholder) {
  color: #98a3b8;
}

:deep(input.field-control:hover),
:deep(.field-control .p-inputtext:hover) {
  border-color: #c4cede;
}

:deep(input.field-control:focus),
:deep(.field-control .p-inputtext:focus) {
  border-color: rgba(12, 163, 108, 0.58);
  box-shadow: 0 0 0 4px rgba(12, 163, 108, 0.12);
}

:deep(.field-control.p-password) {
  width: 100%;
}

:deep(.field-control .p-password-input) {
  padding-right: 50px;
}

:deep(.field-control .p-password-toggle-mask-icon) {
  color: #8895aa;
}

.notice-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 14px 16px;
  border-radius: 14px;
  font-size: 0.96rem;
  font-weight: 600;
  line-height: 1.35;
}

.notice-banner :deep(.app-icon) {
  flex: 0 0 auto;
}

.notice-banner--info {
  background: #e9f3ff;
  color: #1a73e8;
}

.notice-banner--error {
  background: rgba(185, 28, 28, 0.12);
  color: var(--danger);
}

.login-button {
  width: 100%;
  min-height: 56px;
  border: none;
  border-radius: 14px;
  background: #0fa86f;
  color: #ffffff;
  font-size: 1.08rem;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(14, 162, 110, 0.16);
}

.login-button:not(:disabled):hover {
  background: #0c9a67;
}

.login-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px rgba(14, 162, 110, 0.18);
}

.login-footer {
  color: #697386;
  font-size: 0.96rem;
  font-weight: 500;
  text-align: center;
}

@media (max-width: 640px) {
  .login-page {
    padding: 28px 12px 24px;
  }

  .login-building-bg {
    bottom: 24px;
    width: 132vw;
    min-width: 760px;
    opacity: 0.28;
  }

  .login-content {
    gap: 22px;
  }

  .auth-container {
    gap: 24px;
  }

  .brand-block {
    gap: 10px;
  }

  .brand-block__copy {
    min-width: 0;
  }

  .brand-block__title {
    font-size: 1.7rem;
  }

  .brand-block__subtitle {
    font-size: 0.92rem;
  }

  .login-card {
    border-radius: 22px;
  }

  .login-card :deep(.p-card-body) {
    padding: 24px 20px;
  }

  .login-card :deep(.p-card-title) {
    font-size: 1.7rem;
  }

  .login-card :deep(.p-card-subtitle) {
    font-size: 0.95rem;
  }
}
</style>
