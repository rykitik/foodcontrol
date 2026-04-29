<script setup lang="ts">
import { ticketStatusLabels } from '@/config/options'
import type { TicketStatus } from '@/types'

const props = defineProps<{
  status: TicketStatus
}>()

const tones: Record<TicketStatus, string> = {
  active: 'tone-active',
  used: 'tone-used',
  expired: 'tone-expired',
  cancelled: 'tone-cancelled',
}
</script>

<template>
  <span class="ticket-chip" :class="tones[status]">{{ ticketStatusLabels[status] }}</span>
</template>

<style scoped>
.ticket-chip {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 0.85rem;
  border: 1px solid transparent;
}

.tone-active {
  background: rgba(22, 163, 74, 0.12);
  color: #15803d;
  border-color: rgba(22, 163, 74, 0.22);
}

.tone-used {
  background: rgba(71, 85, 105, 0.12);
  color: #334155;
  border-color: rgba(71, 85, 105, 0.18);
}

.tone-expired {
  background: rgba(180, 83, 9, 0.12);
  color: #9a3412;
  border-color: rgba(180, 83, 9, 0.2);
}

.tone-cancelled {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
  border-color: rgba(220, 38, 38, 0.22);
}
</style>
