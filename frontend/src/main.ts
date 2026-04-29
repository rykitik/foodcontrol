import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'
import { registerSW } from 'virtual:pwa-register'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Checkbox from 'primevue/checkbox'
import Chip from 'primevue/chip'
import Divider from 'primevue/divider'
import Dropdown from 'primevue/dropdown'
import AutoComplete from 'primevue/autocomplete'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'

import App from './App.vue'
import router from './router'
import { listenAuthSessionExpired } from './services/authSession'
import { announceMockMode } from './services/mockGuardrails'
import { useAuthStore } from './stores/auth'
import { pinia } from './stores/pinia'

import 'primeicons/primeicons.css'
import './assets/main.css'

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({ immediate: true })
}

announceMockMode()

const app = createApp(App)

app.use(pinia)

const auth = useAuthStore()
let sessionRedirectPromise: Promise<void> | null = null

listenAuthSessionExpired(() => {
  if (sessionRedirectPromise || auth.sessionState === 'anonymous') {
    return
  }

  sessionRedirectPromise = (async () => {
    const currentRoute = router.currentRoute.value
    const redirectPath = currentRoute.path === '/login' ? null : currentRoute.fullPath

    auth.logout()

    await router.replace(auth.buildLoginLocation({ reason: 'expired', redirect: redirectPath })).catch(() => undefined)
  })().finally(() => {
    sessionRedirectPromise = null
  })
})

app.use(router)
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: false,
    },
  },
})

app.component('PButton', Button)
app.component('PCard', Card)
app.component('PCheckbox', Checkbox)
app.component('PChip', Chip)
app.component('PDivider', Divider)
app.component('PDropdown', Dropdown)
app.component('PAutoComplete', AutoComplete)
app.component('PInputNumber', InputNumber)
app.component('PInputText', InputText)
app.component('PPassword', Password)
app.component('PTag', Tag)
app.component('PTextarea', Textarea)

app.mount('#app')
