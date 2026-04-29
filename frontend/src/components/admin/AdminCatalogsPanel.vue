<script setup lang="ts">
import AppIcon from '@/components/icons/AppIcon.vue'
import { buildingOptions } from '@/config/options'
import { getAdminRoleLabel } from '@/utils/adminPresentation'
import type { Category, UserRole } from '@/types'

defineProps<{
  categories: Category[]
}>()

const roleRules: Array<{ role: UserRole; buildingRequired: boolean; description: string }> = [
  { role: 'admin', buildingRequired: false, description: 'Полный доступ к системе и техническому администрированию.' },
  { role: 'head_social', buildingRequired: false, description: 'Управление категориями, календарем и межкорпусными процессами.' },
  { role: 'social', buildingRequired: true, description: 'Работа со студентами и выдачей по закрепленному корпусу.' },
  { role: 'cashier', buildingRequired: true, description: 'Терминал, журнал кассы и операции по корпусу обслуживания.' },
  { role: 'accountant', buildingRequired: false, description: 'Печатные формы, финансовые реестры и итоговые документы.' },
]
</script>

<template>
  <section class="admin-catalogs">
    <header class="admin-catalogs__header">
      <div>
        <h2>Справочники</h2>
        <p>Сводка по системным правилам, ролям, корпусам и данным для импорта без перехода по нескольким разделам.</p>
      </div>
    </header>

    <div class="admin-catalogs__grid">
      <article class="catalog-card">
        <header>
          <AppIcon name="building" />
          <strong>Корпуса системы</strong>
        </header>
        <ul>
          <li v-for="building in buildingOptions" :key="building.value">{{ building.label }}</li>
        </ul>
      </article>

      <article class="catalog-card">
        <header>
          <AppIcon name="students" />
          <strong>Роли и доступ</strong>
        </header>
        <ul class="catalog-role-list">
          <li v-for="rule in roleRules" :key="rule.role">
            <strong>{{ getAdminRoleLabel(rule.role) }}</strong>
            <span>{{ rule.buildingRequired ? 'Требует корпус' : 'Корпус не обязателен' }}</span>
            <p>{{ rule.description }}</p>
          </li>
        </ul>
      </article>

      <article class="catalog-card">
        <header>
          <AppIcon name="excel" />
          <strong>Правила импорта студентов</strong>
        </header>
        <ul>
          <li>Обязательные колонки: ФИО, Группа, Категория.</li>
          <li>Колонка Корпус обязательна в каждой строке импорта.</li>
          <li>Категория распознается по `id`, коду или названию.</li>
        </ul>
      </article>

      <article class="catalog-card">
        <header>
          <AppIcon name="category" />
          <strong>Категории питания</strong>
        </header>
        <div class="catalog-category-list">
          <div v-for="category in categories" :key="category.id" class="catalog-category-item">
            <strong>{{ category.name }}</strong>
            <span>{{ category.code }}</span>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.admin-catalogs {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border: 1px solid #dce5f1;
  border-radius: 14px;
  background: #fff;
}

.admin-catalogs__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}

.admin-catalogs__header h2,
.admin-catalogs__header p {
  margin: 0;
}

.admin-catalogs__header h2 {
  color: #07172f;
  font-size: 22px;
}

.admin-catalogs__header p {
  margin-top: 6px;
  color: #5c6a82;
}

.admin-catalogs__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.catalog-card {
  padding: 18px;
  border: 1px solid #e1e9f4;
  border-radius: 12px;
  background: #fbfdff;
}

.catalog-card header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  color: #07172f;
}

.catalog-card ul {
  margin: 0;
  padding-left: 18px;
  color: #40506a;
  line-height: 1.5;
}

.catalog-role-list {
  padding-left: 0;
  list-style: none;
}

.catalog-role-list li + li {
  margin-top: 12px;
}

.catalog-role-list span,
.catalog-role-list p {
  display: block;
}

.catalog-role-list span {
  margin-top: 3px;
  color: #64748b;
  font-size: 13px;
  font-weight: 700;
}

.catalog-role-list p {
  margin: 4px 0 0;
}

.catalog-category-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.catalog-category-item {
  padding: 12px;
  border: 1px solid #e6edf7;
  border-radius: 10px;
  background: #fff;
}

.catalog-category-item strong,
.catalog-category-item span {
  display: block;
}

.catalog-category-item span {
  margin-top: 4px;
  color: #64748b;
  font-size: 13px;
}

@media (max-width: 960px) {
  .admin-catalogs__header,
  .admin-catalogs__grid {
    grid-template-columns: 1fr;
    flex-direction: column;
  }
}
</style>
