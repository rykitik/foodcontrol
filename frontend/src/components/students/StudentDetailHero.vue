<script setup lang="ts">
import { computed } from 'vue'

import AppIcon from '@/components/icons/AppIcon.vue'
import type { AppIconName } from '@/components/icons/appIconRegistry'
import type { Student } from '@/types'
import { formatStudentCode, studentCodeHint, studentCodeLabel } from '@/utils/studentPresentation'

const props = defineProps<{
  student: Student
  mealBuildingLabel: string
  mealSummary: string
  activeTicketsCount: number
  returnLabel: string
}>()

const emit = defineEmits<{
  back: []
}>()

const homeBuildingLabel = computed(() => props.student.building_name || `Корпус ${props.student.building_id}`)
const studentStatusLabel = computed(() => (props.student.is_active ? 'Активен в системе' : 'Отключен в системе'))
const studentCode = computed(() => formatStudentCode(props.student.student_card))
const ticketSummaryLabel = computed(() => {
  if (props.activeTicketsCount === 0) {
    return 'Активного талона нет'
  }

  if (props.activeTicketsCount === 1) {
    return 'Есть активный талон'
  }

  return `${props.activeTicketsCount} активных талона`
})

const categoryPillStyle = computed(() => {
  const color = props.student.category.color
  if (!color || color.length !== 7) {
    return {}
  }

  return {
    borderColor: `${color}33`,
    backgroundColor: `${color}14`,
    color,
  }
})

const summaryCards = computed<
  Array<{
    key: string
    icon: AppIconName
    label: string
    value: string
  }>
>(() => [
  {
    key: 'building',
    icon: 'building',
    label: 'Основной корпус',
    value: homeBuildingLabel.value,
  },
  {
    key: 'meal-building',
    icon: 'building',
    label: 'Корпус питания',
    value: props.mealBuildingLabel,
  },
  {
    key: 'ration',
    icon: 'ruble',
    label: 'Рацион',
    value: props.mealSummary,
  },
  {
    key: 'ticket',
    icon: 'issue',
    label: 'Активный талон',
    value: ticketSummaryLabel.value,
  },
])
</script>

<template>
  <section class="student-hero">
    <div class="student-hero__topbar">
      <p class="eyebrow student-hero__eyebrow">Карточка студента</p>

      <button type="button" class="student-hero__back" @click="emit('back')">
        <AppIcon name="chevronLeft" :size="18" />
        <span>{{ returnLabel }}</span>
      </button>
    </div>

    <div class="student-hero__main">
      <div class="student-hero__identity">
        <h1>{{ student.full_name }}</h1>
        <p class="student-hero__subtitle">{{ student.group_name }} · {{ homeBuildingLabel }}</p>

        <div class="student-hero__pills">
          <span
            class="student-hero__status-pill"
            :class="{ 'student-hero__status-pill--inactive': !student.is_active }"
          >
            <span class="student-hero__status-dot"></span>
            {{ studentStatusLabel }}
          </span>

          <span class="student-hero__category-pill" :style="categoryPillStyle">
            {{ student.category.name }}
          </span>
        </div>
      </div>

      <article class="student-hero__code-card">
        <span class="student-hero__code-label">{{ studentCodeLabel }}</span>
        <strong>{{ studentCode }}</strong>
        <p>{{ studentCodeHint }}</p>
      </article>
    </div>

    <dl class="student-hero__summary-grid">
      <div v-for="card in summaryCards" :key="card.key" class="student-hero__summary-card">
        <span class="student-hero__summary-icon" aria-hidden="true">
          <AppIcon :name="card.icon" :size="20" />
        </span>
        <div class="student-hero__summary-copy">
          <dt>{{ card.label }}</dt>
          <dd>{{ card.value }}</dd>
        </div>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.student-hero {
  display: flex;
  flex-direction: column;
  gap: var(--student-detail-space-5, 24px);
  padding: 26px 28px 22px;
  border-radius: 24px;
  border: 1px solid rgba(219, 227, 238, 0.9);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.05);
}

.student-hero__topbar,
.student-hero__main,
.student-hero__pills,
.student-hero__summary-card {
  display: flex;
  align-items: flex-start;
}

.student-hero__topbar {
  justify-content: space-between;
  gap: 16px;
}

.student-hero__eyebrow {
  margin-bottom: 0;
  color: #2563eb;
}

.student-hero__back {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 16px;
  border: 1px solid #dbe3ee;
  border-radius: 12px;
  background: #fff;
  color: #475569;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.student-hero__back:hover,
.student-hero__back:focus-visible {
  border-color: #cbd5e1;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
  transform: translateY(-1px);
}

.student-hero__main {
  justify-content: space-between;
  gap: 24px;
}

.student-hero__identity,
.student-hero__summary-copy,
.student-hero__code-card {
  display: flex;
  flex-direction: column;
}

.student-hero__identity {
  gap: 14px;
  min-width: 0;
}

.student-hero__identity h1 {
  margin: 0;
  color: #0f172a;
  font-size: clamp(2.3rem, 3vw, 3.15rem);
  line-height: 1.04;
  letter-spacing: -0.04em;
}

.student-hero__subtitle {
  margin: 0;
  color: #64748b;
  font-size: 1.08rem;
  line-height: 1.35;
}

.student-hero__pills {
  flex-wrap: wrap;
  gap: 12px;
}

.student-hero__status-pill,
.student-hero__category-pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid #dbe3ee;
  background: #fff;
  color: #334155;
  font-weight: 600;
}

.student-hero__status-pill {
  border-color: rgba(34, 197, 94, 0.22);
  background: rgba(240, 253, 244, 0.96);
  color: #15803d;
}

.student-hero__status-pill--inactive {
  border-color: rgba(239, 68, 68, 0.2);
  background: rgba(254, 242, 242, 0.96);
  color: #b91c1c;
}

.student-hero__status-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.9;
}

.student-hero__code-card {
  flex: 0 0 min(320px, 100%);
  gap: 14px;
  padding: 20px 22px;
  border: 1px solid #dbe3ee;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(255, 255, 255, 0.98));
}

.student-hero__code-label {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.student-hero__code-card strong {
  color: #0f172a;
  font-size: clamp(2.2rem, 3vw, 3rem);
  line-height: 1;
  letter-spacing: -0.04em;
}

.student-hero__code-card p {
  margin: 0;
  color: #64748b;
  line-height: 1.45;
}

.student-hero__summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

.student-hero__summary-card {
  gap: 14px;
  padding: 18px 16px;
  border: 1px solid #dbe3ee;
  border-radius: 18px;
  background: #fff;
}

.student-hero__summary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 42px;
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: rgba(37, 99, 235, 0.08);
  color: #2563eb;
}

.student-hero__summary-copy {
  gap: 6px;
  min-width: 0;
}

.student-hero__summary-copy dt {
  color: #64748b;
  font-size: 0.84rem;
  line-height: 1.25;
}

.student-hero__summary-copy dd {
  margin: 0;
  color: #0f172a;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.4;
}

@media (max-width: 1120px) {
  .student-hero__main,
  .student-hero__summary-grid {
    grid-template-columns: 1fr 1fr;
  }

  .student-hero__main {
    display: grid;
  }

  .student-hero__code-card {
    flex-basis: auto;
  }
}

@media (max-width: 860px) {
  .student-hero {
    padding: 22px 20px 20px;
  }

  .student-hero__topbar,
  .student-hero__main,
  .student-hero__summary-grid {
    display: flex;
    flex-direction: column;
  }

  .student-hero__back {
    width: 100%;
    justify-content: center;
  }
}
</style>
