import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import {
  matchesUserStatus,
  sortUsersByDisplayPriority,
  studentPageSizeOptions,
  userStatusFilterOptions,
  type UserStatusFilter,
} from '@/config/adminFilters'
import { resolveRoleHome, roleLabels } from '@/config/navigation'
import { buildingOptions, userRoleOptions } from '@/config/options'
import { studentStatusFilterOptions } from '@/config/studentFilters'
import {
  createStudent,
  createUser,
  downloadImportTemplate,
  getCategories,
  getStudentHistory,
  importEntityFile,
  listAuditLogs,
  listStudentGroups,
  listStudentsPage,
  listUsers,
  updateStudent,
  updateUser,
} from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { copyTextToClipboard } from '@/utils/clipboard'
import { saveBlob } from '@/utils/files'
import { toMoscowDateKey } from '@/utils/adminPresentation'
import { mergeStudentGroupName } from '@/utils/studentGroups'
import { formatStudentCode, studentCodeLabel } from '@/utils/studentPresentation'
import type {
  Category,
  AuditLogEntry,
  ImportSummary,
  MealRecord,
  PaginatedResult,
  Student,
  StudentCreateRequest,
  StudentListFilter,
  StudentStatusFilter,
  StudentUpdateRequest,
  User,
  UserCreateRequest,
  UserRole,
  UserUpdateRequest,
} from '@/types'

export type AdminSection = 'users' | 'students' | 'import' | 'catalogs' | 'audit'

export interface AdminMetricCard {
  label: string
  value: string
  note: string
  icon: 'students' | 'student' | 'category' | 'clock'
  tone: 'blue' | 'green' | 'violet' | 'orange'
}

export function useAdminWorkspace() {
  const auth = useAuthStore()
  const router = useRouter()
  const route = useRoute()

  const users = ref<User[]>([])
  const studentsPage = ref<PaginatedResult<Student> | null>(null)
  const categories = ref<Category[]>([])
  const auditLogs = ref<AuditLogEntry[]>([])
  const studentGroupSuggestions = ref<string[]>([])
  const loading = ref(false)
  const importLoadingEntity = ref<'students' | null>(null)
  const message = ref('')
  const error = ref('')
  const activeSection = ref<AdminSection>('users')
  const showUserCreate = ref(false)
  const showStudentCreate = ref(false)
  const studentFormResetKey = ref(0)
  const userFormResetKey = ref(0)
  const studentImportResult = ref<ImportSummary | null>(null)
  const userSearch = ref('')
  const studentSearch = ref('')
  const userRoleFilter = ref<UserRole | 'all'>('all')
  const userStatusFilter = ref<UserStatusFilter>('all')
  const userBuildingFilter = ref<number | 'all'>('all')
  const studentCategoryFilter = ref<number | 'all'>('all')
  const studentStatusFilter = ref<StudentStatusFilter>('all')
  const studentPage = ref(1)
  const studentPageSize = ref(25)
  const selectedUserId = ref<string | null>(null)
  const selectedStudentId = ref<string | null>(null)
  const userEditorRef = ref<HTMLElement | null>(null)
  const studentEditorRef = ref<HTMLElement | null>(null)
  const studentHistory = ref<MealRecord[]>([])
  const rolePreview = ref<UserRole>(auth.rolePreview ?? auth.previewableRoles[0] ?? 'social')

  const editUserForm = reactive({
    full_name: '',
    email: '',
    phone: '',
    building_id: 1,
    is_active: true,
  })

  const editStudentForm = reactive({
    full_name: '',
    group_name: '',
    building_id: 1,
    category_id: 1,
    is_active: true,
  })

  const userRoleFilterOptions = computed(() => [{ label: 'Все роли', value: 'all' as const }, ...userRoleOptions])
  const rolePreviewOptions = computed(() =>
    auth.previewableRoles.map((role) => ({
      label: roleLabels[role],
      value: role,
    })),
  )
  const activeUsersCount = computed(() => users.value.filter((user) => user.is_active).length)
  const inactiveUsersCount = computed(() => users.value.length - activeUsersCount.value)
  const hasUserFilters = computed(
    () =>
      userSearch.value.trim().length > 0 ||
      userRoleFilter.value !== 'all' ||
      userStatusFilter.value !== 'all' ||
      userBuildingFilter.value !== 'all',
  )
  const hasStudentFilters = computed(
    () =>
      studentSearch.value.trim().length > 0 ||
      studentCategoryFilter.value !== 'all' ||
      studentStatusFilter.value !== 'all' ||
      studentPageSize.value !== 25,
  )

  const filteredUsers = computed(() => {
    const filtered = users.value.filter((user) => {
      const q = userSearch.value.toLowerCase()
      const matchesQuery = !q || user.full_name.toLowerCase().includes(q) || user.username.toLowerCase().includes(q)
      const matchesRole = userRoleFilter.value === 'all' || user.role === userRoleFilter.value
      const matchesStatus = matchesUserStatus(user, userStatusFilter.value)
      const matchesBuilding = userBuildingFilter.value === 'all' || user.building_id === userBuildingFilter.value
      return matchesQuery && matchesRole && matchesStatus && matchesBuilding
    })

    return sortUsersByDisplayPriority(filtered)
  })

  const visibleStudents = computed(() => studentsPage.value?.items ?? [])
  const studentTotal = computed(() => studentsPage.value?.total ?? 0)
  const visibleStudentsCount = computed(() => visibleStudents.value.length)
  const selectedUser = computed(() => filteredUsers.value.find((user) => user.id === selectedUserId.value) ?? null)
  const selectedStudent = computed(() => visibleStudents.value.find((student) => student.id === selectedStudentId.value) ?? null)
  const selectedUserRequiresBuilding = computed(() => ['social', 'cashier'].includes(selectedUser.value?.role ?? ''))
  const canCreateAdminUsers = computed(() => auth.userRole === 'admin')
  const selectedStudentDisplayCard = computed(() => formatStudentCode(selectedStudent.value?.student_card))
  const selectedStudentEffectiveBuilding = computed(() => {
    if (!selectedStudent.value) {
      return '—'
    }

    return selectedStudent.value.effective_meal_building_name
      ?? selectedStudent.value.building_name
      ?? `Корпус ${selectedStudent.value.building_id}`
  })

  const metricCards = computed<AdminMetricCard[]>(() => [
    {
      label: 'Пользователи',
      value: String(users.value.length),
      note: `Активных: ${activeUsersCount.value}`,
      icon: 'students',
      tone: 'blue',
    },
    {
      label: 'Студенты',
      value: String(studentTotal.value),
      note: 'Всего в системе',
      icon: 'student',
      tone: 'green',
    },
    {
      label: 'Категории',
      value: String(categories.value.length),
      note: 'В справочнике',
      icon: 'category',
      tone: 'violet',
    },
    {
      label: 'Последний импорт',
      value: studentImportResult.value ? `${studentImportResult.value.created}/${studentImportResult.value.updated}` : '—',
      note: studentImportResult.value ? 'Создано / обновлено' : 'Импорт не выполнялся',
      icon: 'clock',
      tone: 'orange',
    },
  ])

  const recentAuditEntries = computed(() => auditLogs.value.slice(0, 6))
  const todayAuditEntries = computed(() => {
    const todayKey = toMoscowDateKey(new Date())

    return auditLogs.value.filter((entry) => {
      return toMoscowDateKey(entry.created_at) === todayKey
    })
  })
  const auditActionsToday = computed(() => todayAuditEntries.value.length)
  const auditUsersToday = computed(() => new Set(todayAuditEntries.value.map((entry) => entry.user_name)).size)
  const latestAuditEntry = computed(() => auditLogs.value[0] ?? null)

  function resetAlerts() {
    message.value = ''
    error.value = ''
  }

  function resetUserFilters() {
    userSearch.value = ''
    userRoleFilter.value = 'all'
    userStatusFilter.value = 'all'
    userBuildingFilter.value = 'all'
  }

  function resetStudentFilters() {
    studentSearch.value = ''
    studentCategoryFilter.value = 'all'
    studentStatusFilter.value = 'all'
    studentPageSize.value = 25
    studentPage.value = 1
  }

  function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    const tagName = target.tagName
    return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
  }

  function focusInputById(inputId: string) {
    const input = document.getElementById(inputId)
    if (!(input instanceof HTMLInputElement)) {
      return
    }
    input.focus()
    input.select()
  }

  function handleAdminHotkeys(event: KeyboardEvent) {
    if (isTypingTarget(event.target)) {
      return
    }

    if (!event.altKey && !event.ctrlKey && !event.metaKey && event.key === '/') {
      event.preventDefault()
      activeSection.value = 'users'
      focusInputById('admin-user-search')
      return
    }

    if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 's') {
      event.preventDefault()
      activeSection.value = 'students'
      focusInputById('admin-student-search')
    }
  }

  async function scrollEditorIntoView(target: HTMLElement | null) {
    await nextTick()
    target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  async function copyFieldValue(value: string, label: string) {
    const text = value.trim()
    if (!text) {
      error.value = `${label} не заполнен`
      return
    }

    resetAlerts()
    try {
      const copied = await copyTextToClipboard(text)
      if (!copied) {
        throw new Error('Не удалось скопировать значение')
      }
      message.value = `${label} скопирован`
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось скопировать значение'
    }
  }

  function openStudentCard(studentId: string) {
    void router.push({
      path: `/students/${studentId}`,
      query: { returnTo: route.fullPath },
    })
  }

  async function fillUserEditor(user: User) {
    selectedUserId.value = user.id
    Object.assign(editUserForm, {
      full_name: user.full_name,
      email: user.email ?? '',
      phone: user.phone ?? '',
      building_id: user.building_id ?? 1,
      is_active: user.is_active,
    })
    await scrollEditorIntoView(userEditorRef.value)
  }

  async function fillStudentEditor(student: Student) {
    const studentId = student.id
    selectedStudentId.value = studentId
    Object.assign(editStudentForm, {
      full_name: student.full_name,
      group_name: student.group_name,
      building_id: student.building_id,
      category_id: student.category_id,
      is_active: student.is_active,
    })
    studentHistory.value = []
    await scrollEditorIntoView(studentEditorRef.value)
    const history = await getStudentHistory(studentId, auth.token)
    if (selectedStudentId.value === studentId) {
      studentHistory.value = history
    }
  }

  function buildStudentListFilter(): StudentListFilter {
    return {
      q: studentSearch.value || undefined,
      category_id: studentCategoryFilter.value === 'all' ? undefined : studentCategoryFilter.value,
      status: studentStatusFilter.value === 'all' ? undefined : studentStatusFilter.value,
      page: studentPage.value,
      page_size: studentPageSize.value,
    }
  }

  async function loadStudentsPage() {
    const studentData = await listStudentsPage(buildStudentListFilter())
    studentsPage.value = studentData
    if (selectedStudentId.value && !studentData.items.some((student) => student.id === selectedStudentId.value)) {
      selectedStudentId.value = null
      studentHistory.value = []
    }
  }

  function changeStudentPage(nextPage: number) {
    const total = studentsPage.value?.total ?? 0
    const maxPage = Math.max(1, Math.ceil(total / studentPageSize.value))
    studentPage.value = Math.min(Math.max(nextPage, 1), maxPage)
    void loadStudentsPage()
  }

  async function loadData() {
    const [usersData, categoryData, groupData, auditData] = await Promise.all([
      listUsers(auth.token),
      getCategories(),
      listStudentGroups(),
      listAuditLogs(auth.token).catch(() => []),
    ])
    users.value = usersData
    categories.value = categoryData
    studentGroupSuggestions.value = groupData
    auditLogs.value = auditData
    await loadStudentsPage()
  }

  async function downloadStudentTemplate() {
    resetAlerts()
    try {
      saveBlob(await downloadImportTemplate('students', auth.token), 'foodcontrol-students-template.xlsx')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось скачать шаблон'
    }
  }

  async function runStudentImport(file: File, dryRun: boolean) {
    importLoadingEntity.value = 'students'
    resetAlerts()

    try {
      const result = await importEntityFile('students', file, dryRun, auth.token)
      studentImportResult.value = result
      message.value = dryRun ? `Файл ${file.name} успешно проверен` : 'Импорт студентов завершен'
      if (!dryRun) {
        await loadData()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось выполнить импорт'
    } finally {
      importLoadingEntity.value = null
    }
  }

  async function submitUser(payload: UserCreateRequest) {
    loading.value = true
    resetAlerts()

    try {
      await createUser(payload, auth.token)
      message.value = 'Пользователь создан'
      userFormResetKey.value += 1
      showUserCreate.value = false
      await loadData()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось создать пользователя'
    } finally {
      loading.value = false
    }
  }

  async function submitStudent(payload: StudentCreateRequest) {
    loading.value = true
    resetAlerts()

    try {
      const student = await createStudent(payload, auth.token)
      studentGroupSuggestions.value = mergeStudentGroupName(studentGroupSuggestions.value, student.group_name)
      message.value = 'Студент добавлен'
      studentFormResetKey.value += 1
      showStudentCreate.value = false
      await loadData()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось добавить студента'
    } finally {
      loading.value = false
    }
  }

  async function saveUserEdit() {
    if (!selectedUser.value) {
      return
    }

    loading.value = true
    resetAlerts()

    try {
      const payload: UserUpdateRequest = {
        full_name: editUserForm.full_name,
        email: editUserForm.email || undefined,
        phone: editUserForm.phone || undefined,
        building_id: selectedUserRequiresBuilding.value ? editUserForm.building_id : null,
        is_active: editUserForm.is_active,
      }
      await updateUser(selectedUser.value.id, payload, auth.token)
      message.value = 'Пользователь обновлен'
      await loadData()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось обновить пользователя'
    } finally {
      loading.value = false
    }
  }

  async function saveStudentEdit() {
    if (!selectedStudent.value) {
      return
    }

    const studentId = selectedStudent.value.id
    loading.value = true
    resetAlerts()

    try {
      const payload: StudentUpdateRequest = {
        full_name: editStudentForm.full_name,
        group_name: editStudentForm.group_name,
        building_id: editStudentForm.building_id,
        category_id: editStudentForm.category_id,
        is_active: editStudentForm.is_active,
      }
      await updateStudent(studentId, payload, auth.token)
      message.value = 'Студент обновлен'
      await loadData()
      if (selectedStudentId.value === studentId) {
        studentHistory.value = await getStudentHistory(studentId, auth.token)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось обновить студента'
    } finally {
      loading.value = false
    }
  }

  async function toggleUser(user: User) {
    loading.value = true
    resetAlerts()

    try {
      await updateUser(user.id, { is_active: !user.is_active }, auth.token)
      message.value = `Статус пользователя ${user.username} обновлен`
      await loadData()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось обновить пользователя'
    } finally {
      loading.value = false
    }
  }

  async function toggleStudent(student: Student) {
    loading.value = true
    resetAlerts()

    try {
      await updateStudent(student.id, { is_active: !student.is_active }, auth.token)
      message.value = `Статус студента ${student.full_name} обновлен`
      await loadData()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Не удалось обновить студента'
    } finally {
      loading.value = false
    }
  }

  function applyRolePreview() {
    auth.setRolePreview(rolePreview.value)
    void router.push(resolveRoleHome(rolePreview.value))
  }

  function openRoleWorkspace(role: UserRole, path: string) {
    auth.setRolePreview(role)
    void router.push(path)
  }

  function clearRolePreview() {
    auth.clearRolePreview()
    void router.push('/admin')
  }

  function logout() {
    auth.logout()
    void router.push(auth.buildLoginLocation({ reason: 'logged_out' }))
  }

  function navigateToSection(section: AdminSection) {
    activeSection.value = section
  }

  function openAuditPage() {
    void router.push('/audit')
  }

  let studentSearchTimer: ReturnType<typeof setTimeout> | null = null

  watch(filteredUsers, (items) => {
    if (selectedUserId.value && !items.some((user) => user.id === selectedUserId.value)) {
      selectedUserId.value = null
    }
  })

  watch([studentCategoryFilter, studentStatusFilter, studentPageSize], async () => {
    studentPage.value = 1
    await loadStudentsPage()
  })

  watch(studentSearch, () => {
    studentPage.value = 1
    if (studentSearchTimer) {
      clearTimeout(studentSearchTimer)
    }
    studentSearchTimer = setTimeout(() => {
      void loadStudentsPage()
    }, 250)
  })

  onMounted(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleAdminHotkeys)
    }
    void loadData()
  })

  onBeforeUnmount(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleAdminHotkeys)
    }
    if (studentSearchTimer) {
      clearTimeout(studentSearchTimer)
    }
  })

  return {
    auth,
    activeSection,
    buildingOptions,
    canCreateAdminUsers,
    categories,
    editStudentForm,
    editUserForm,
    error,
    filteredUsers,
    auditActionsToday,
    auditUsersToday,
    latestAuditEntry,
    hasStudentFilters,
    hasUserFilters,
    importLoadingEntity,
    loading,
    message,
    metricCards,
    rolePreview,
    rolePreviewOptions,
    recentAuditEntries,
    selectedStudent,
    selectedStudentDisplayCard,
    selectedStudentEffectiveBuilding,
    selectedStudentId,
    selectedUser,
    selectedUserId,
    selectedUserRequiresBuilding,
    showStudentCreate,
    showUserCreate,
    studentCategoryFilter,
    studentFormResetKey,
    studentGroupSuggestions,
    studentHistory,
    studentImportResult,
    studentPage,
    studentPageSize,
    studentPageSizeOptions,
    studentSearch,
    studentStatusFilter,
    studentStatusFilterOptions,
    studentTotal,
    studentCodeLabel,
    userBuildingFilter,
    userEditorRef,
    studentEditorRef,
    userFormResetKey,
    userRoleFilter,
    userRoleFilterOptions,
    userSearch,
    userStatusFilter,
    userStatusFilterOptions,
    visibleStudents,
    visibleStudentsCount,
    activeUsersCount,
    applyRolePreview,
    changeStudentPage,
    clearRolePreview,
    copyFieldValue,
    downloadStudentTemplate,
    fillStudentEditor,
    fillUserEditor,
    formatStudentCode,
    logout,
    navigateToSection,
    openAuditPage,
    openStudentCard,
    openRoleWorkspace,
    resetStudentFilters,
    resetUserFilters,
    runStudentImport,
    saveStudentEdit,
    saveUserEdit,
    submitStudent,
    submitUser,
    toggleStudent,
    toggleUser,
  }
}
