import type { ImportEntity, ImportSummary } from '@/types'

import { authHeaders, requestBlob, requestForm } from '../http'

export async function importEntityFile(
  entity: ImportEntity,
  file: File,
  dryRun = true,
  token?: string | null,
): Promise<ImportSummary> {
  const formData = new FormData()
  formData.set('file', file)
  formData.set('dry_run', dryRun ? 'true' : 'false')

  return requestForm(`/imports/${entity}`, formData, token)
}

export async function downloadImportTemplate(entity: ImportEntity, token?: string | null): Promise<Blob> {
  return requestBlob(`/imports/templates/${entity}.xlsx`, { method: 'GET', headers: authHeaders(token) })
}
