<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import type { AdminMetricCard } from '@/composables/useAdminWorkspace'

defineProps<{
  cards: AdminMetricCard[]
}>()
</script>

<template>
  <section class="admin-metrics" aria-label="Сводка администратора">
    <article v-for="card in cards" :key="card.label" class="admin-metric" :class="`tone-${card.tone}`">
      <span class="admin-metric__icon" aria-hidden="true">
        <AppIcon :name="card.icon" />
      </span>
      <div>
        <p>{{ card.label }}</p>
        <strong>{{ card.value }}</strong>
        <span>{{ card.note }}</span>
      </div>
    </article>
  </section>
</template>

<style scoped>
.admin-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 22px;
}

.admin-metric {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  min-height: 132px;
  padding: 24px;
  border: 1px solid #dce5f1;
  border-radius: 16px;
  background: #fff;
}

.admin-metric__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
}

.admin-metric p,
.admin-metric span {
  margin: 0;
  color: #5c6a82;
  font-size: 14px;
  line-height: 1.35;
}

.admin-metric strong {
  display: block;
  margin: 4px 0 8px;
  color: #07172f;
  font-size: 30px;
  line-height: 1;
  font-weight: 800;
}

.tone-blue .admin-metric__icon {
  background: #eef5ff;
  color: #0866ff;
}

.tone-green .admin-metric__icon {
  background: #ebf9f0;
  color: #079455;
}

.tone-violet .admin-metric__icon {
  background: #f4efff;
  color: #7c3aed;
}

.tone-orange .admin-metric__icon {
  background: #fff4e8;
  color: #f97316;
}

@media (max-width: 1280px) {
  .admin-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .admin-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
