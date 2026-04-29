export interface CashierTerminal {
  id: string
  building_id: number
  building_name?: string | null
  display_name: string
  status: 'active' | 'disabled'
  provisioning_expires_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface CashierTerminalProvisionRequest {
  terminal_id?: string
  provisioning_code?: string
  display_name?: string
}

export interface CashierTerminalProvisionResponse {
  terminal: CashierTerminal
  terminal_id: string
  provisioning_code: string | null
  new_terminal: boolean
}

export interface CashierOfflineGrantIssueRequest {
  terminal_id: string
}

export interface CashierOfflineGrantIssueResponse {
  grant_token: string
  grant_id: string
  jti: string
  role: 'cashier'
  terminal_id: string
  terminal_display_name: string
  building_id: number
  building_name?: string | null
  issued_at: string
  expires_at: string
  algorithm: string
  key_id: string
  issuer: string
  audience: string
  public_key: string
}

export interface CashierOfflineGrantClaims {
  iss: string
  aud: string | string[]
  sub: string
  jti: string
  role: 'cashier'
  building_id: number | null
  terminal_id: string
  iat: number
  nbf?: number
  exp: number
  typ: 'cashier_offline_grant'
}
