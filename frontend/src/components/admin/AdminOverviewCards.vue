<script setup lang="ts">
type AdminOverviewTone = 'neutral' | 'warning' | 'info' | 'success'

defineProps<{
  cards: Array<{
    label: string
    value: string
    note: string
    tone: AdminOverviewTone
  }>
}>()
</script>

<template>
  <div class="admin-overview-grid">
    <article
      v-for="card in cards"
      :key="card.label"
      class="admin-overview-card"
      :class="`admin-overview-card--${card.tone}`"
    >
      <div class="admin-overview-head">
        <span>{{ card.label }}</span>
        <i aria-hidden="true" class="admin-overview-dot" />
      </div>
      <strong>{{ card.value }}</strong>
      <p>{{ card.note }}</p>
    </article>
  </div>
</template>

<style scoped>
.admin-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.admin-overview-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 108px;
  padding: 18px;
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  background: rgba(255, 255, 255, 0.9);
}

.admin-overview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.admin-overview-head span,
.admin-overview-card p {
  margin: 0;
  color: var(--muted);
}

.admin-overview-head span {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-overview-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(100, 116, 139, 0.32);
}

.admin-overview-card strong {
  color: var(--text);
  font-size: clamp(1.45rem, 2.6vw, 2rem);
  line-height: 1;
}

.admin-overview-card p {
  font-size: 0.92rem;
}

.admin-overview-card--neutral {
  border-top: 4px solid rgba(71, 85, 105, 0.78);
}

.admin-overview-card--neutral .admin-overview-dot {
  background: rgba(71, 85, 105, 0.78);
}

.admin-overview-card--warning {
  border-top: 4px solid rgba(217, 119, 6, 0.8);
  background: linear-gradient(180deg, rgba(255, 251, 235, 0.96), rgba(255, 255, 255, 0.9));
}

.admin-overview-card--warning .admin-overview-dot {
  background: rgba(217, 119, 6, 0.8);
}

.admin-overview-card--info {
  border-top: 4px solid rgba(2, 132, 199, 0.78);
  background: linear-gradient(180deg, rgba(240, 249, 255, 0.96), rgba(255, 255, 255, 0.9));
}

.admin-overview-card--info .admin-overview-dot {
  background: rgba(2, 132, 199, 0.78);
}

.admin-overview-card--success {
  border-top: 4px solid rgba(22, 163, 74, 0.78);
  background: linear-gradient(180deg, rgba(240, 253, 244, 0.96), rgba(255, 255, 255, 0.9));
}

.admin-overview-card--success .admin-overview-dot {
  background: rgba(22, 163, 74, 0.78);
}

@media (max-width: 1180px) {
  .admin-overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .admin-overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
