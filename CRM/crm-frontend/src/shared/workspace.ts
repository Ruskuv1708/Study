import { roleMatches } from './roleLabels'

export const getSelectedWorkspaceId = () => {
  try {
    return localStorage.getItem('crm_workspace_id')
  } catch {
    return null
  }
}

export const getWorkspaceParams = (currentUser?: { role?: string } | null) => {
  if (!currentUser) return undefined
  if (!roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN'])) return undefined
  const workspaceId = getSelectedWorkspaceId()
  return workspaceId ? { workspace_id: workspaceId } : undefined
}
