<script setup lang="ts">
import { useCurrentDateTime } from '@/composables/useCurrentDateTime'

withDefaults(
  defineProps<{
    variant?: 'inline' | 'hero'
  }>(),
  {
    variant: 'inline',
  },
)

const { dateLabel, timeLabel } = useCurrentDateTime()
</script>

<template>
  <div class="cashier-terminal-clock" :class="`variant-${variant}`" aria-label="Текущие дата и время">
    <span class="cashier-terminal-clock-date">{{ dateLabel }}</span>
    <span class="cashier-terminal-clock-separator" aria-hidden="true">•</span>
    <strong class="cashier-terminal-clock-time">{{ timeLabel }}</strong>
  </div>
</template>

<style scoped>
.cashier-terminal-clock {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 600;
  line-height: 1.2;
}

.cashier-terminal-clock-time {
  color: var(--text);
  font-size: 0.98rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.cashier-terminal-clock-date {
  color: var(--muted);
}

.cashier-terminal-clock-separator {
  color: rgba(100, 116, 139, 0.72);
  font-size: 0.68rem;
}

.cashier-terminal-clock.variant-hero {
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}

.cashier-terminal-clock.variant-hero .cashier-terminal-clock-date {
  order: 1;
  font-size: clamp(0.88rem, 1.35vw, 1rem);
  font-weight: 600;
  color: rgba(30, 64, 175, 0.64);
}

.cashier-terminal-clock.variant-hero .cashier-terminal-clock-separator {
  display: none;
}

.cashier-terminal-clock.variant-hero .cashier-terminal-clock-time {
  order: 2;
  font-size: clamp(1.5rem, 2.2vw, 2rem);
  font-weight: 800;
  color: rgba(15, 23, 42, 0.8);
}

@media (max-width: 760px) {
  .cashier-terminal-clock {
    gap: 5px;
    font-size: 0.8rem;
  }

  .cashier-terminal-clock-time {
    font-size: 0.92rem;
  }

  .cashier-terminal-clock.variant-hero {
    gap: 4px;
  }

  .cashier-terminal-clock.variant-hero .cashier-terminal-clock-date {
    font-size: 0.86rem;
  }

  .cashier-terminal-clock.variant-hero .cashier-terminal-clock-time {
    font-size: 1.5rem;
  }
}
</style>
