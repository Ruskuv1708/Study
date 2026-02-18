const ROLE_MAP: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  SYSTEM_ADMIN: 'System Admin',
  ADMIN: 'Workspace Admin',
  MANAGER: 'Department Manager',
  USER: 'User',
  VIEWER: 'Viewer',
}

const normalize = (value?: string) => (value || '').toUpperCase()

export const ROLE_DISPLAY_NAMES = ROLE_MAP
export const ROLE_ASSIGNABLE = ['USER']

export const normalizeRole = (role?: string) => normalize(role)
export const roleMatches = (role: string | undefined, candidates: string[]) => {
  if (!role) return false
  const normalized = normalize(role)
  return candidates.map(c => normalize(c)).includes(normalized)
}

export const getRoleLabel = (role?: string) => {
  if (!role) return 'User'
  return ROLE_MAP[normalize(role)] ?? role
}
