import type { Component } from 'vue'

import IconAlertTriangle from '@/components/icons/glyphs/IconAlertTriangle.vue'
import IconBuilding from '@/components/icons/glyphs/IconBuilding.vue'
import IconCalendar from '@/components/icons/glyphs/IconCalendar.vue'
import IconCalendarCheck from '@/components/icons/glyphs/IconCalendarCheck.vue'
import IconCancel from '@/components/icons/glyphs/IconCancel.vue'
import IconCategory from '@/components/icons/glyphs/IconCategory.vue'
import IconCheck from '@/components/icons/glyphs/IconCheck.vue'
import IconChevronLeft from '@/components/icons/glyphs/IconChevronLeft.vue'
import IconChevronRight from '@/components/icons/glyphs/IconChevronRight.vue'
import IconChevronUp from '@/components/icons/glyphs/IconChevronUp.vue'
import IconClock from '@/components/icons/glyphs/IconClock.vue'
import IconClipboardCheck from '@/components/icons/glyphs/IconClipboardCheck.vue'
import IconDisable from '@/components/icons/glyphs/IconDisable.vue'
import IconDocument from '@/components/icons/glyphs/IconDocument.vue'
import IconDocumentPrint from '@/components/icons/glyphs/IconDocumentPrint.vue'
import IconEdit from '@/components/icons/glyphs/IconEdit.vue'
import IconEye from '@/components/icons/glyphs/IconEye.vue'
import IconExcel from '@/components/icons/glyphs/IconExcel.vue'
import IconInfo from '@/components/icons/glyphs/IconInfo.vue'
import IconHandBlock from '@/components/icons/glyphs/IconHandBlock.vue'
import IconIssue from '@/components/icons/glyphs/IconIssue.vue'
import IconLock from '@/components/icons/glyphs/IconLock.vue'
import IconMore from '@/components/icons/glyphs/IconMore.vue'
import IconOpen from '@/components/icons/glyphs/IconOpen.vue'
import IconPlus from '@/components/icons/glyphs/IconPlus.vue'
import IconPrint from '@/components/icons/glyphs/IconPrint.vue'
import IconRefresh from '@/components/icons/glyphs/IconRefresh.vue'
import IconReports from '@/components/icons/glyphs/IconReports.vue'
import IconReissue from '@/components/icons/glyphs/IconReissue.vue'
import IconRuble from '@/components/icons/glyphs/IconRuble.vue'
import IconSearch from '@/components/icons/glyphs/IconSearch.vue'
import IconSearchMinus from '@/components/icons/glyphs/IconSearchMinus.vue'
import IconSearchPlus from '@/components/icons/glyphs/IconSearchPlus.vue'
import IconSettings from '@/components/icons/glyphs/IconSettings.vue'
import IconSignOut from '@/components/icons/glyphs/IconSignOut.vue'
import IconStudent from '@/components/icons/glyphs/IconStudent.vue'
import IconStudentAdd from '@/components/icons/glyphs/IconStudentAdd.vue'
import IconStudents from '@/components/icons/glyphs/IconStudents.vue'

// New glyphs should stay on the shared 20x20 outline grid.
export const appIconComponents = {
  alertTriangle: IconAlertTriangle,
  building: IconBuilding,
  calendar: IconCalendar,
  calendarCheck: IconCalendarCheck,
  cancel: IconCancel,
  category: IconCategory,
  check: IconCheck,
  chevronLeft: IconChevronLeft,
  chevronRight: IconChevronRight,
  chevronUp: IconChevronUp,
  clipboardCheck: IconClipboardCheck,
  clock: IconClock,
  disable: IconDisable,
  document: IconDocument,
  documentPrint: IconDocumentPrint,
  edit: IconEdit,
  eye: IconEye,
  excel: IconExcel,
  handBlock: IconHandBlock,
  info: IconInfo,
  issue: IconIssue,
  lock: IconLock,
  more: IconMore,
  open: IconOpen,
  plus: IconPlus,
  print: IconPrint,
  refresh: IconRefresh,
  reports: IconReports,
  reissue: IconReissue,
  ruble: IconRuble,
  search: IconSearch,
  searchMinus: IconSearchMinus,
  searchPlus: IconSearchPlus,
  settings: IconSettings,
  signOut: IconSignOut,
  student: IconStudent,
  studentAdd: IconStudentAdd,
  students: IconStudents,
} satisfies Record<string, Component>

export type AppIconName = keyof typeof appIconComponents
