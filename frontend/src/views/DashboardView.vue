<script setup lang="ts">
import { computed } from 'vue'

import GenericRoleDashboard from '@/components/dashboard/GenericRoleDashboard.vue'
import HeadSocialDashboard from '@/components/dashboard/HeadSocialDashboard.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const isHeadSocialDashboard = computed(() => auth.effectiveRole === 'head_social')
</script>

<template>
  <HeadSocialDashboard v-if="isHeadSocialDashboard" />
  <GenericRoleDashboard v-else />
</template>
