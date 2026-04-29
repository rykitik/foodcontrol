import type {
  CashierOfflineGrantClaims,
  CashierOfflineGrantIssueResponse,
  CashierTerminalProvisionRequest,
  User,
} from '@/types'
import type { CashierOfflineGrantEnvelope, CashierStoragePartition } from '@/types/cashierOfflineStorage'

import { getCashierOfflineContextVersion, resetCashierOfflineContextVersion } from '@/services/cashierOfflineContext'
import { issueCashierOfflineGrant, provisionCashierTerminal } from '@/services/api'
import {
  getLegacyStorageKeysForMigration,
  initializeCashierStoragePartition,
  readOfflineGrantForActivePartitionSync,
  readTerminalMetaForActivePartitionSync,
  resetCashierStoragePartitionContext,
  restoreCashierStoragePartitionForUser,
  setActiveCashierStoragePartition,
  upsertOfflineGrantForPartition,
  upsertSnapshotMeta,
  upsertTerminalMetaForPartition,
} from '@/services/cashierOfflineStorage'

const STORAGE_ROLE = 'cashier' as const

export interface CashierTerminalBinding {
  terminal_id: string
  building_id: number | null
  display_name: string
  provisioned_at: string
}

export interface StoredCashierOfflineGrant extends CashierOfflineGrantEnvelope {}

interface GrantValidationContext {
  expectedTerminalId: string
  expectedUserId: string
  expectedRole: User['role'] | null | undefined
}

export interface CashierOfflineGrantValidationResult {
  valid: boolean
  reason?: string
  claims?: CashierOfflineGrantClaims
}

interface DecodedCashierOfflineGrantToken {
  header: { alg?: string; kid?: string }
  claims: CashierOfflineGrantClaims
}

let cashierOfflineBootstrapPromise: Promise<void> | null = null
const GRANT_CLOCK_SKEW_LEEWAY_SECONDS = 300

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function readLegacyLocalStorage<T>(key: string): T | null {
  if (!canUseLocalStorage()) {
    return null
  }

  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function removeLegacyLocalStorage(key: string): void {
  if (!canUseLocalStorage()) {
    return
  }
  localStorage.removeItem(key)
}

function isCashierUser(user: User | null | undefined): user is User & { role: 'cashier' } {
  return Boolean(user && user.role === STORAGE_ROLE)
}

function resolvePartition(terminalId: string, userId: string): CashierStoragePartition {
  return {
    terminal_id: terminalId,
    user_id: userId,
    role: STORAGE_ROLE,
  }
}

function resolveTerminalDisplayName(user: User): string {
  const buildingLabel = user.building_name?.trim() || `Building ${user.building_id ?? 'N/A'}`
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'workstation'
  return `${buildingLabel} terminal @ ${hostname}`.slice(0, 120)
}

function readLegacyTerminalBindingFallback(): CashierTerminalBinding | null {
  const keys = getLegacyStorageKeysForMigration()
  const parsed = readLegacyLocalStorage<CashierTerminalBinding>(keys.terminal)
  if (!parsed || !parsed.terminal_id) {
    return null
  }
  return parsed
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function decodeJsonSegment<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment)
  const json = new TextDecoder().decode(bytes)
  return JSON.parse(json) as T
}

function decodeCashierOfflineGrantToken(
  grant: Pick<CashierOfflineGrantIssueResponse, 'grant_token'>,
): DecodedCashierOfflineGrantToken | null {
  const parts = grant.grant_token.split('.')
  if (parts.length !== 3) {
    return null
  }

  const headerPart = parts[0]
  const claimsPart = parts[1]
  if (!headerPart || !claimsPart) {
    return null
  }

  try {
    return {
      header: decodeJsonSegment<{ alg?: string; kid?: string }>(headerPart),
      claims: decodeJsonSegment<CashierOfflineGrantClaims>(claimsPart),
    }
  } catch {
    return null
  }
}

function validateCashierOfflineGrantMetadata(
  grant: CashierOfflineGrantIssueResponse,
  decoded: DecodedCashierOfflineGrantToken,
  context: GrantValidationContext,
): string | null {
  if (context.expectedRole !== STORAGE_ROLE) {
    return 'cashier_role_required'
  }

  if (decoded.header.alg !== grant.algorithm) {
    return 'algorithm_mismatch'
  }
  if (grant.key_id && decoded.header.kid !== grant.key_id) {
    return 'key_id_mismatch'
  }
  if (decoded.claims.typ !== 'cashier_offline_grant') {
    return 'grant_type_mismatch'
  }
  if (decoded.claims.role !== STORAGE_ROLE) {
    return 'role_mismatch'
  }
  if (decoded.claims.sub !== context.expectedUserId) {
    return 'subject_mismatch'
  }
  if (decoded.claims.terminal_id !== context.expectedTerminalId) {
    return 'terminal_mismatch'
  }

  const audienceMatches =
    typeof decoded.claims.aud === 'string'
      ? decoded.claims.aud === grant.audience
      : decoded.claims.aud.includes(grant.audience)
  if (!audienceMatches) {
    return 'audience_mismatch'
  }
  if (decoded.claims.iss !== grant.issuer) {
    return 'issuer_mismatch'
  }

  return null
}

function pemToDerBytes(pem: string): ArrayBuffer {
  const content = pem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '')

  const binary = atob(content)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return buffer
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(view.byteLength)
  copy.set(view)
  return copy.buffer
}

async function verifyRs256Signature(token: string, publicKeyPem: string): Promise<boolean> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return false
  }

  const parts = token.split('.')
  if (parts.length !== 3) {
    return false
  }

  const headerPart = parts[0]
  const payloadPart = parts[1]
  const signaturePart = parts[2]
  if (!headerPart || !payloadPart || !signaturePart) {
    return false
  }

  const signingInput = new TextEncoder().encode(`${headerPart}.${payloadPart}`)
  const signature = base64UrlToUint8Array(signaturePart)
  const signingInputBuffer = toArrayBuffer(signingInput)
  const signatureBuffer = toArrayBuffer(signature)

  const publicKey = await crypto.subtle.importKey(
    'spki',
    pemToDerBytes(publicKeyPem),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify'],
  )

  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signatureBuffer, signingInputBuffer)
}

async function persistBootstrapIndexedDb(
  partition: CashierStoragePartition,
  persist: () => Promise<void>,
): Promise<void> {
  try {
    await persist()
    return
  } catch {
    await initializeCashierStoragePartition(partition)
    setActiveCashierStoragePartition(partition)
    await persist()
  }
}

export function readCashierTerminalBinding(user: User | null | undefined): CashierTerminalBinding | null {
  if (!isCashierUser(user)) {
    return null
  }

  const meta = readTerminalMetaForActivePartitionSync()
  if (meta) {
    return {
      terminal_id: meta.terminal_id,
      building_id: meta.building_id,
      display_name: meta.display_name,
      provisioned_at: meta.provisioned_at,
    }
  }

  return null
}

export function readStoredCashierOfflineGrant(user: User | null | undefined): StoredCashierOfflineGrant | null {
  if (!isCashierUser(user)) {
    return null
  }

  return readOfflineGrantForActivePartitionSync()
}

export function clearCashierOfflineAuthLocalState(): void {
  resetCashierOfflineContextVersion()
  resetCashierStoragePartitionContext()
  cashierOfflineBootstrapPromise = null

  const keys = getLegacyStorageKeysForMigration()
  removeLegacyLocalStorage(keys.queue)
  removeLegacyLocalStorage(keys.terminal)
  removeLegacyLocalStorage(keys.grant)
}

export async function validateCashierOfflineGrantLocally(
  grant: CashierOfflineGrantIssueResponse,
  context: GrantValidationContext,
): Promise<CashierOfflineGrantValidationResult> {
  const decoded = decodeCashierOfflineGrantToken(grant)
  if (!decoded) {
    return { valid: false, reason: 'invalid_token_payload' }
  }

  const metadataValidationReason = validateCashierOfflineGrantMetadata(grant, decoded, context)
  if (metadataValidationReason) {
    return { valid: false, reason: metadataValidationReason }
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (typeof decoded.claims.exp !== 'number' || decoded.claims.exp <= nowSeconds - GRANT_CLOCK_SKEW_LEEWAY_SECONDS) {
    return { valid: false, reason: 'grant_expired' }
  }
  if (typeof decoded.claims.nbf === 'number' && decoded.claims.nbf > nowSeconds + GRANT_CLOCK_SKEW_LEEWAY_SECONDS) {
    return { valid: false, reason: 'grant_not_yet_valid' }
  }

  const signatureValid = await verifyRs256Signature(grant.grant_token, grant.public_key)
  if (!signatureValid) {
    return { valid: false, reason: 'invalid_signature' }
  }

  return { valid: true, claims: decoded.claims }
}

async function runCashierOfflineBootstrap(token: string, user: User & { role: 'cashier' }): Promise<void> {
  const bootstrapVersion = getCashierOfflineContextVersion()
  const isStaleBootstrap = () => bootstrapVersion !== getCashierOfflineContextVersion()

  await restoreCashierStoragePartitionForUser(user.id)
  if (isStaleBootstrap()) {
    return
  }

  const legacyBinding = readLegacyTerminalBindingFallback()
  if (legacyBinding?.terminal_id) {
    const legacyPartition = resolvePartition(legacyBinding.terminal_id, user.id)
    if (isStaleBootstrap()) {
      return
    }
    await initializeCashierStoragePartition(legacyPartition)
  }

  const provisioningRequest: CashierTerminalProvisionRequest = {
    display_name: resolveTerminalDisplayName(user),
  }
  const activeTerminalMeta = readTerminalMetaForActivePartitionSync()
  const existingTerminalId = activeTerminalMeta?.terminal_id ?? legacyBinding?.terminal_id
  if (existingTerminalId) {
    provisioningRequest.terminal_id = existingTerminalId
  }

  const provisioned = await provisionCashierTerminal(provisioningRequest, token)
  if (isStaleBootstrap()) {
    return
  }

  const partition = resolvePartition(provisioned.terminal_id, user.id)

  await initializeCashierStoragePartition(partition)
  setActiveCashierStoragePartition(partition)
  if (isStaleBootstrap()) {
    return
  }

  await persistBootstrapIndexedDb(partition, () =>
    upsertTerminalMetaForPartition(
      partition,
      {
        building_id: provisioned.terminal.building_id,
        display_name: provisioned.terminal.display_name,
        provisioned_at: new Date().toISOString(),
        last_seen_at: provisioned.terminal.last_seen_at,
      },
      { requireIndexedDb: true },
    ),
  )
  if (isStaleBootstrap()) {
    return
  }

  const issuedGrant = await issueCashierOfflineGrant({ terminal_id: provisioned.terminal_id }, token)
  if (isStaleBootstrap()) {
    return
  }

  const validation = await validateCashierOfflineGrantLocally(issuedGrant, {
    expectedTerminalId: provisioned.terminal_id,
    expectedUserId: user.id,
    expectedRole: user.role,
  })

  const decodedGrant = decodeCashierOfflineGrantToken(issuedGrant)
  if (!decodedGrant) {
    throw new Error('invalid_token_payload')
  }
  const metadataValidationReason = validateCashierOfflineGrantMetadata(issuedGrant, decodedGrant, {
    expectedTerminalId: provisioned.terminal_id,
    expectedUserId: user.id,
    expectedRole: user.role,
  })
  if (metadataValidationReason) {
    throw new Error(metadataValidationReason)
  }
  if (isStaleBootstrap()) {
    return
  }

  await persistBootstrapIndexedDb(partition, () =>
    upsertOfflineGrantForPartition(
      partition,
      {
        grant: issuedGrant,
        claims: decodedGrant.claims,
        validated_at: new Date().toISOString(),
      },
      { requireIndexedDb: true },
    ),
  )
  if (isStaleBootstrap()) {
    return
  }

  if (!validation.valid || !validation.claims) {
    console.warn('Cashier offline grant persisted but local validation failed:', validation.reason)
  }

  const bootstrapTimestamp = new Date().toISOString()
  await upsertSnapshotMeta(partition, {
    snapshot_version: 'grant_bootstrap_v1',
    generated_at: null,
    freshness_ts: null,
    service_date: null,
    updated_at: bootstrapTimestamp,
  })
}

export async function ensureCashierOfflineGrantBootstrap(params: {
  token: string | null
  user: User | null
}): Promise<void> {
  if (!params.token || !isCashierUser(params.user)) {
    return
  }

  if (!cashierOfflineBootstrapPromise) {
    cashierOfflineBootstrapPromise = runCashierOfflineBootstrap(params.token, params.user)
      .catch((error) => {
        console.warn('Cashier offline bootstrap skipped due to bootstrap failure:', error)
      })
      .finally(() => {
        cashierOfflineBootstrapPromise = null
      })
  }

  return cashierOfflineBootstrapPromise
}
