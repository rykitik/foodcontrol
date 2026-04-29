<script setup lang="ts">
import SocialOutlineIcon from '@/components/social/SocialOutlineIcon.vue'

defineProps<{
  studentsCount: number
  workdayCount: number
  holidayCount: number
  mealDayCount: number
}>()
</script>

<template>
  <section class="issue-metrics">
    <article class="issue-metric issue-metric--green">
      <span class="issue-metric-icon">
        <SocialOutlineIcon name="student" />
      </span>
      <div class="issue-metric-copy">
        <strong>{{ studentsCount }}</strong>
        <span>студентов</span>
      </div>
    </article>

    <article class="issue-metric issue-metric--blue">
      <span class="issue-metric-icon">
        <SocialOutlineIcon name="calendar" />
      </span>
      <div class="issue-metric-copy">
        <strong>{{ workdayCount }}</strong>
        <span>учебных дней</span>
      </div>
    </article>

    <article class="issue-metric issue-metric--violet">
      <span class="issue-metric-icon">
        <SocialOutlineIcon name="calendar" />
      </span>
      <div class="issue-metric-copy">
        <strong>{{ holidayCount }}</strong>
        <span>праздничных дней</span>
      </div>
    </article>

    <article class="issue-metric issue-metric--orange">
      <span class="issue-metric-icon">
        <SocialOutlineIcon name="ticket" />
      </span>
      <div class="issue-metric-copy">
        <strong>{{ mealDayCount }}</strong>
        <span>дней питания</span>
      </div>
    </article>
  </section>
</template>

<style scoped>
.issue-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #fff;
  overflow: hidden;
}

.issue-metric {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 18px 20px;
}

.issue-metric + .issue-metric {
  border-left: 1px solid #e2e8f0;
}

.issue-metric-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border-radius: 999px;
  flex: 0 0 auto;
}

.issue-metric-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.issue-metric-copy strong {
  color: #0f172a;
  font-size: 20px;
  line-height: 24px;
}

.issue-metric-copy span {
  color: #475569;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
}

.issue-metric--green .issue-metric-icon {
  background: #ecfdf3;
  color: #16a34a;
}

.issue-metric--blue .issue-metric-icon {
  background: #eff6ff;
  color: #2563eb;
}

.issue-metric--violet .issue-metric-icon {
  background: #f5f3ff;
  color: #9333ea;
}

.issue-metric--orange .issue-metric-icon {
  background: #fff7ed;
  color: #ea580c;
}

@media (max-width: 1100px) {
  .issue-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .issue-metric:nth-child(3) {
    border-left: 0;
    border-top: 1px solid #e2e8f0;
  }

  .issue-metric:nth-child(4) {
    border-top: 1px solid #e2e8f0;
  }
}

@media (max-width: 640px) {
  .issue-metrics {
    grid-template-columns: 1fr;
  }

  .issue-metric {
    padding: 14px 16px;
  }

  .issue-metric + .issue-metric,
  .issue-metric:nth-child(3),
  .issue-metric:nth-child(4) {
    border-left: 0;
    border-top: 1px solid #e2e8f0;
  }
}
</style>
