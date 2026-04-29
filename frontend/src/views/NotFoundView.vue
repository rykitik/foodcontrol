<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AppIcon from '@/components/icons/AppIcon.vue'
import { roleHome } from '@/config/navigation'
import SocialSidebarNav from '@/components/social/SocialSidebarNav.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const homeRoute = computed(() => {
  if (!auth.isAuthenticated) {
    return '/login'
  }

  return roleHome[auth.effectiveRole ?? auth.userRole ?? 'social']
})

const homeLabel = computed(() => (auth.isAuthenticated ? 'На главную' : 'На вход'))
const isEmbedded = computed(() => auth.isAuthenticated)
const showSocialSidebar = computed(() => auth.effectiveRole === 'social')

const backTarget = computed(() => {
  if (typeof window === 'undefined') {
    return null
  }

  const target = window.history.state?.back
  if (typeof target !== 'string' || target.length === 0 || target === route.fullPath) {
    return null
  }

  return target
})

const canGoBack = computed(() => Boolean(backTarget.value))

function goHome() {
  void router.push(homeRoute.value)
}

function goBack() {
  if (!canGoBack.value) {
    return
  }

  router.back()
}

const helpItems = [
  {
    icon: 'info' as const,
    title: 'Проверьте адрес страницы',
    description: 'Убедитесь, что ссылка введена корректно и в адресе нет лишних символов.',
  },
  {
    icon: 'settings' as const,
    title: 'Если ошибка повторяется, сообщите администратору',
    description: 'Опишите, после какого действия открылась эта страница, чтобы проблему было проще воспроизвести.',
  },
]
</script>

<template>
  <section class="not-found-page" :class="{ 'not-found-page--public': !isEmbedded }">
    <div v-if="showSocialSidebar" class="not-found-workspace">
      <aside class="not-found-workspace__sidebar">
        <SocialSidebarNav :active="null" />
      </aside>

      <div class="not-found-page__main">
        <div class="not-found-card">
          <div class="not-found-card__hero">
            <p class="not-found-card__eyebrow">Ошибка навигации</p>
            <h1>404 — Страница не найдена</h1>
            <p class="not-found-card__copy">
              Похоже, ссылка устарела, страница была перемещена или адрес введен неверно.
            </p>

            <div class="not-found-card__visual" aria-hidden="true">
              <div class="not-found-card__window">
                <div class="not-found-card__window-bar" />
                <div class="not-found-card__window-body">
                  <div class="not-found-card__lens">
                    <span />
                  </div>
                  <div class="not-found-card__lines">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>

            <div class="not-found-card__actions">
              <button type="button" class="not-found-button not-found-button--primary" @click="goHome">
                <AppIcon name="students" />
                <span>{{ homeLabel }}</span>
              </button>
              <button
                v-if="canGoBack"
                type="button"
                class="not-found-button not-found-button--secondary"
                @click="goBack"
              >
                <AppIcon name="chevronLeft" />
                <span>Вернуться назад</span>
              </button>
            </div>
          </div>

          <div class="not-found-card__help">
            <article v-for="item in helpItems" :key="item.title" class="not-found-help-card">
              <span class="not-found-help-card__icon">
                <AppIcon :name="item.icon" />
              </span>
              <div class="not-found-help-card__copy">
                <strong>{{ item.title }}</strong>
                <p>{{ item.description }}</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="not-found-page__main">
      <div class="not-found-card">
        <div class="not-found-card__hero">
          <p class="not-found-card__eyebrow">Ошибка навигации</p>
          <h1>404 — Страница не найдена</h1>
          <p class="not-found-card__copy">
            Похоже, ссылка устарела, страница была перемещена или адрес введен неверно.
          </p>

          <div class="not-found-card__actions">
            <button type="button" class="not-found-button not-found-button--primary" @click="goHome">
              <AppIcon :name="isEmbedded ? 'students' : 'open'" />
              <span>{{ homeLabel }}</span>
            </button>
            <button
              v-if="canGoBack"
              type="button"
              class="not-found-button not-found-button--secondary"
              @click="goBack"
            >
              <AppIcon name="chevronLeft" />
              <span>Вернуться назад</span>
            </button>
          </div>
        </div>

        <div class="not-found-card__help">
          <article v-for="item in helpItems" :key="item.title" class="not-found-help-card">
            <span class="not-found-help-card__icon">
              <AppIcon :name="item.icon" />
            </span>
            <div class="not-found-help-card__copy">
              <strong>{{ item.title }}</strong>
              <p>{{ item.description }}</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.not-found-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.not-found-page--public {
  min-height: 100vh;
  justify-content: center;
  padding: 32px 20px;
  background:
    radial-gradient(circle at top left, rgba(37, 99, 235, 0.08), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #f3f7fb 100%);
}

.not-found-workspace {
  display: grid;
  grid-template-columns: minmax(230px, 276px) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.not-found-workspace__sidebar {
  position: sticky;
  top: 16px;
}

.not-found-page__main {
  min-width: 0;
}

.not-found-card {
  width: min(100%, 1080px);
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 36px 36px 28px;
  margin: auto;
  border: 1px solid #dbe5f0;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.05);
}

.not-found-card__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

.not-found-card__eyebrow,
.not-found-card__copy,
.not-found-card h1,
.not-found-help-card__copy strong,
.not-found-help-card__copy p {
  margin: 0;
}

.not-found-card__eyebrow {
  color: #2563eb;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.not-found-card h1 {
  color: #0f172a;
  font-size: 28px;
  line-height: 36px;
}

.not-found-card__copy {
  max-width: 640px;
  color: #516079;
  font-size: 18px;
  line-height: 24px;
}

.not-found-card__visual {
  width: min(100%, 430px);
  padding: 12px 0 4px;
}

.not-found-card__window {
  position: relative;
  border: 2px solid #c9d6ee;
  border-radius: 18px;
  background: linear-gradient(180deg, #fbfdff 0%, #f3f8ff 100%);
  overflow: hidden;
}

.not-found-card__window::before,
.not-found-card__window::after {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #d9e4f6;
  top: 12px;
}

.not-found-card__window::before {
  left: 16px;
}

.not-found-card__window::after {
  left: 34px;
}

.not-found-card__window-bar {
  height: 24px;
  border-bottom: 2px solid #d7e2f3;
  background: rgba(255, 255, 255, 0.82);
}

.not-found-card__window-body {
  display: grid;
  grid-template-columns: 154px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  padding: 24px 28px 26px;
}

.not-found-card__lens {
  position: relative;
  width: 112px;
  height: 112px;
  margin: 0 auto;
  border: 3px solid #aebfe1;
  border-radius: 999px;
}

.not-found-card__lens::after {
  content: '';
  position: absolute;
  right: -20px;
  bottom: 8px;
  width: 42px;
  height: 10px;
  border-radius: 999px;
  background: #aebfe1;
  transform: rotate(42deg);
}

.not-found-card__lens span {
  position: absolute;
  inset: 26px;
  border: 3px solid #c0cfea;
  border-radius: 999px;
}

.not-found-card__lens span::before,
.not-found-card__lens span::after {
  content: '';
  position: absolute;
  inset: 50%;
  width: 34px;
  height: 3px;
  border-radius: 999px;
  background: #aebfe1;
  transform-origin: center;
}

.not-found-card__lens span::before {
  transform: translate(-50%, -50%) rotate(45deg);
}

.not-found-card__lens span::after {
  transform: translate(-50%, -50%) rotate(-45deg);
}

.not-found-card__lines {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.not-found-card__lines span {
  display: block;
  height: 10px;
  border-radius: 999px;
  background: #d6e2f5;
}

.not-found-card__lines span:nth-child(1) {
  width: 88%;
}

.not-found-card__lines span:nth-child(2) {
  width: 72%;
}

.not-found-card__lines span:nth-child(3) {
  width: 56%;
}

.not-found-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  padding-top: 2px;
}

.not-found-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 46px;
  min-width: 220px;
  padding: 0 18px;
  border-radius: 12px;
  border: 1px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    color 0.2s ease,
    transform 0.2s ease;
}

.not-found-button:hover {
  transform: translateY(-1px);
}

.not-found-button--primary {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
}

.not-found-button--primary:hover {
  background: #15803d;
  border-color: #15803d;
}

.not-found-button--secondary {
  background: #fff;
  border-color: #dbe3ee;
  color: #0f172a;
}

.not-found-button--secondary:hover {
  background: #f8fafc;
}

.not-found-card__help {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e5edf6;
}

.not-found-help-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border-radius: 16px;
  background: #f8fbff;
}

.not-found-help-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid #dbe5f0;
  border-radius: 999px;
  color: #526582;
  background: #fff;
  flex: 0 0 auto;
}

.not-found-help-card__copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.not-found-help-card__copy strong {
  color: #0f172a;
  font-size: 16px;
  line-height: 22px;
}

.not-found-help-card__copy p {
  color: #64748b;
  font-size: 14px;
  line-height: 20px;
}

@media (max-width: 640px) {
  .not-found-page--public {
    padding: 16px;
  }

  .not-found-card {
    padding: 24px 20px;
    border-radius: 20px;
  }

  .not-found-card h1 {
    font-size: 24px;
    line-height: 30px;
  }

  .not-found-card__copy {
    font-size: 16px;
  }

  .not-found-card__window-body {
    grid-template-columns: 1fr;
    padding: 20px;
  }

  .not-found-card__actions {
    flex-direction: column;
  }

  .not-found-button {
    width: 100%;
    min-width: 0;
  }
}

@media (max-width: 920px) {
  .not-found-workspace {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .not-found-workspace__sidebar {
    position: static;
  }
}
</style>
