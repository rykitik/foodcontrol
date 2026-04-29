import type { Category, CategoryCreateRequest, CategoryDeleteRequest, CategoryUpdateRequest } from '@/types'

import * as mock from '../mock'
import { authHeaders, requestJson } from '../http'

export async function getCategories(): Promise<Category[]> {
  return requestJson('/categories', { method: 'GET', headers: authHeaders() }, () => mock.getCategories())
}

export async function createCategory(request: CategoryCreateRequest, token?: string | null): Promise<Category> {
  return requestJson(
    '/categories',
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.createCategory(request, token),
  )
}

export async function updateCategory(
  categoryId: number,
  request: CategoryUpdateRequest,
  token?: string | null,
): Promise<Category> {
  return requestJson(
    `/categories/${categoryId}`,
    {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.updateCategory(categoryId, request, token),
  )
}

export async function deleteCategory(
  categoryId: number,
  request: CategoryDeleteRequest,
  token?: string | null,
): Promise<{ id: number; replacement_category_id?: number | null; transferred_students: number }> {
  return requestJson(
    `/categories/${categoryId}`,
    {
      method: 'DELETE',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    },
    () => mock.deleteCategory(categoryId, request, token),
  )
}
