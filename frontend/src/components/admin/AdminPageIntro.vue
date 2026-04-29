<script setup lang="ts">
interface AdminIntroStat {
  label: string
  value: string
  note: string
}

interface AdminQuickLink {
  label: string
  path: string
  tone: 'primary' | 'secondary'
}

defineProps<{
  stats: AdminIntroStat[]
}>()

const emit = defineEmits<{
  navigate: [path: string]
}>()

const quickLinks: AdminQuickLink[] = [
  { label: 'Студенты', path: '/social', tone: 'primary' },
  { label: 'Категории', path: '/categories-settings', tone: 'primary' },
  { label: 'Календарь', path: '/holidays', tone: 'secondary' },
  { label: 'Отчеты', path: '/reports', tone: 'secondary' },
  { label: 'Аудит', path: '/audit', tone: 'secondary' },
]
</script>

<template>
  <header class="admin-intro">
    <div class="admin-intro-hero">
      <div class="admin-intro-copy">
        <p class="eyebrow">Управление системой</p>
        <h1>Пользователи, студенты и импорт данных</h1>
        <div class="admin-intro-focus">
          <span>Учетные записи</span>
          <span>Массовая загрузка</span>
          <span>Ручное создание</span>
        </div>
      </div>

      <aside class="admin-intro-nav">
        <span class="admin-intro-label">Навигация</span>
        <strong>Смежные разделы</strong>
        <div class="admin-intro-actions">
          <p-button
            v-for="link in quickLinks"
            :key="link.path"
            :label="link.label"
            severity="secondary"
            outlined
            :class="[
              'admin-intro-action',
              link.tone === 'primary' ? 'admin-intro-action--primary' : 'admin-intro-action--secondary',
            ]"
            @click="emit('navigate', link.path)"
          />
        </div>
      </aside>
    </div>

    <div class="admin-intro-state">
      <span class="admin-intro-label">Состояние раздела</span>

      <div class="admin-intro-state-grid">
        <article v-for="item in stats" :key="item.label" class="admin-intro-state-card">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p>{{ item.note }}</p>
        </article>
      </div>
    </div>
  </header>
</template>

<style scoped>
.admin-intro {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.admin-intro-hero,
.admin-intro-state,
.admin-intro-state-card {
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
}

.admin-intro-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.88fr);
  gap: 18px;
  padding: 24px;
  background:
    radial-gradient(circle at top left, rgba(29, 78, 216, 0.12), transparent 36%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 250, 252, 0.86));
}

.admin-intro-copy,
.admin-intro-nav,
.admin-intro-state-card {
  display: flex;
  flex-direction: column;
}

.admin-intro-copy {
  gap: 12px;
}

.admin-intro-copy h1 {
  margin: 0;
  color: var(--text);
  font-size: clamp(1.6rem, 2.6vw, 2.35rem);
  line-height: 1.08;
}

.admin-intro-focus {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.admin-intro-focus span {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  font-size: 0.86rem;
  font-weight: 700;
}

.admin-intro-nav {
  gap: 12px;
  padding: 18px;
  border-radius: calc(var(--radius-xl) - 6px);
  border: 1px solid rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.82)),
    radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 34%);
}

.admin-intro-label {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-intro-nav strong {
  color: var(--text);
  font-size: 1.08rem;
}

.admin-intro-state-card p {
  margin: 0;
  color: var(--muted);
}

.admin-intro-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.admin-intro-action {
  flex: 1 1 calc(50% - 10px);
}

.admin-intro-action--primary :deep(.p-button) {
  border-color: rgba(15, 23, 42, 0.18);
  color: var(--text);
}

.admin-intro-action--secondary :deep(.p-button) {
  opacity: 0.92;
}

.admin-intro-state {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.82)),
    radial-gradient(circle at top left, rgba(14, 165, 233, 0.08), transparent 32%);
}

.admin-intro-state-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.admin-intro-state-card {
  gap: 6px;
  min-height: 96px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.78);
}

.admin-intro-state-card span {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-intro-state-card strong {
  color: var(--text);
  font-size: clamp(1.35rem, 2.4vw, 1.9rem);
  line-height: 1;
}

@media (max-width: 1180px) {
  .admin-intro-hero {
    grid-template-columns: 1fr;
  }

  .admin-intro-state-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .admin-intro-hero,
  .admin-intro-state {
    padding: 18px;
  }

  .admin-intro-actions {
    flex-direction: column;
  }

  .admin-intro-action {
    flex-basis: auto;
  }

  .admin-intro-action :deep(.p-button) {
    width: 100%;
  }
}
</style>
