<script setup lang="ts">
import { computed, useSlots } from 'vue'

import SocialOutlineIcon from '@/components/social/SocialOutlineIcon.vue'

defineProps<{
  icon: 'ticket' | 'student' | 'document'
  tone: 'green' | 'blue' | 'orange' | 'violet'
  title: string
  description: string
}>()

const slots = useSlots()
const hasOptions = computed(() => Boolean(slots.options))
</script>

<template>
  <article class="issue-document-row" :class="{ 'issue-document-row--with-options': hasOptions }">
    <div class="issue-document-row__lead">
      <span class="issue-document-row__icon" :class="`issue-document-row__icon--${tone}`">
        <SocialOutlineIcon :name="icon" />
      </span>

      <div class="issue-document-row__copy">
        <strong>{{ title }}</strong>
        <p>{{ description }}</p>
      </div>
    </div>

    <div v-if="hasOptions" class="issue-document-row__options">
      <slot name="options" />
    </div>

    <div class="issue-document-row__actions">
      <slot name="actions" />
    </div>
  </article>
</template>

<style scoped>
.issue-document-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas: 'lead actions';
  gap: 16px;
  align-items: center;
  padding: 20px;
}

.issue-document-row--with-options {
  grid-template-columns: minmax(0, 1.15fr) minmax(240px, 0.72fr) auto;
  grid-template-areas: 'lead options actions';
}

.issue-document-row + .issue-document-row {
  border-top: 1px solid #e2e8f0;
}

.issue-document-row__lead {
  grid-area: lead;
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.issue-document-row__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 16px;
  flex: 0 0 auto;
}

.issue-document-row__icon--green {
  background: #ecfdf3;
  color: #16a34a;
}

.issue-document-row__icon--blue {
  background: #eff6ff;
  color: #2563eb;
}

.issue-document-row__icon--orange {
  background: #fff7ed;
  color: #f97316;
}

.issue-document-row__icon--violet {
  background: #f5f3ff;
  color: #9333ea;
}

.issue-document-row__copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.issue-document-row__copy strong {
  color: #0f172a;
  font-size: 18px;
  line-height: 24px;
}

.issue-document-row__copy p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 22px;
}

.issue-document-row__options {
  grid-area: options;
  min-width: 0;
  padding-left: 18px;
  border-left: 1px solid #e2e8f0;
}

.issue-document-row__actions {
  grid-area: actions;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

@media (max-width: 1180px) {
  .issue-document-row {
    grid-template-columns: 1fr;
    grid-template-areas:
      'lead'
      'options'
      'actions';
  }

  .issue-document-row__actions {
    justify-content: flex-start;
  }

  .issue-document-row__options {
    padding-left: 0;
    border-left: 0;
  }
}

@media (max-width: 640px) {
  .issue-document-row {
    padding: 16px;
    gap: 14px;
  }

  .issue-document-row__lead {
    align-items: flex-start;
    gap: 14px;
  }

  .issue-document-row__icon {
    width: 52px;
    height: 52px;
    border-radius: 14px;
  }

  .issue-document-row__copy strong {
    font-size: 16px;
    line-height: 22px;
  }
}
</style>
