import { computed, ref, watch, type Ref } from 'vue'

import type { Student } from '@/types'

interface UseSocialBulkTicketSelectionOptions {
  students: Ref<Student[]>
  isSelectable: (student: Student) => boolean
}

export function useSocialBulkTicketSelection(options: UseSocialBulkTicketSelectionOptions) {
  const selectedStudentIds = ref<string[]>([])

  const selectableStudents = computed(() => options.students.value.filter((student) => options.isSelectable(student)))
  const selectedStudents = computed(() => selectableStudents.value.filter((student) => selectedStudentIds.value.includes(student.id)))
  const selectedCount = computed(() => selectedStudents.value.length)
  const hasSelection = computed(() => selectedCount.value > 0)
  const allVisibleSelected = computed(
    () => selectableStudents.value.length > 0 && selectableStudents.value.every((student) => selectedStudentIds.value.includes(student.id)),
  )

  function clearSelection() {
    selectedStudentIds.value = []
  }

  function isSelected(studentId: string) {
    return selectedStudentIds.value.includes(studentId)
  }

  function toggleStudent(student: Student, checked: boolean) {
    if (!options.isSelectable(student)) {
      return
    }

    if (checked) {
      if (!selectedStudentIds.value.includes(student.id)) {
        selectedStudentIds.value = [...selectedStudentIds.value, student.id]
      }
      return
    }

    selectedStudentIds.value = selectedStudentIds.value.filter((studentId) => studentId !== student.id)
  }

  function toggleAllVisible(checked: boolean) {
    if (!checked) {
      selectedStudentIds.value = selectedStudentIds.value.filter(
        (studentId) => !selectableStudents.value.some((student) => student.id === studentId),
      )
      return
    }

    const nextIds = new Set(selectedStudentIds.value)
    selectableStudents.value.forEach((student) => {
      nextIds.add(student.id)
    })
    selectedStudentIds.value = Array.from(nextIds)
  }

  watch(
    selectableStudents,
    (students) => {
      const visibleIds = new Set(students.map((student) => student.id))
      selectedStudentIds.value = selectedStudentIds.value.filter((studentId) => visibleIds.has(studentId))
    },
    { immediate: true },
  )

  return {
    allVisibleSelected,
    clearSelection,
    hasSelection,
    isSelected,
    selectedCount,
    selectedStudentIds,
    selectedStudents,
    toggleAllVisible,
    toggleStudent,
  }
}
