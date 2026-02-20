import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import theme from '../../shared/theme'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import type { FormTemplate, FormRecord } from './types'
import useIsMobile from '../../shared/useIsMobile'

interface RequestItem {
  id: string
  title: string
  description?: string | null
  status: 'new' | 'assigned' | 'in_process' | 'pending' | 'done'
  priority: 'low' | 'medium' | 'high' | 'critical'
  department_id: string
  assigned_to_id?: string | null
  assignee?: {
    id: string
    full_name: string
  } | null
  created_at?: string | null
  updated_at?: string | null
  created_by_id?: string | null
}

interface QueueItem {
  record: FormRecord
  request?: RequestItem | null
}

interface DepartmentUser {
  id: string
  full_name: string
  role?: string
}

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

const statusOptions: Array<RequestItem['status']> = [
  'new',
  'assigned',
  'in_process',
  'pending',
  'done'
]

function FormQueuePage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([])
  const isMobile = useIsMobile()

  const token = localStorage.getItem('crm_token')

  const canManageQueue = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])
  }, [currentUser])

  const requestSettings = useMemo(() => {
    return template?.meta_data?.request_settings || null
  }, [template])

  const fetchCurrentUser = async () => {
    if (!token) return navigate('/')
    const res = await axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const normalized = normalizeUser(res.data)
    setCurrentUser(normalized)
    if (!roleMatches(normalized.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])) {
      navigate('/requests')
    }
    return normalized
  }

  const fetchTemplate = async (user?: any) => {
    if (!token || !id) return null
    const res = await axios.get(`/forms/templates/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: getWorkspaceParams(user || currentUser)
    })
    setTemplate(res.data)
    return res.data
  }

  const fetchQueue = async (user?: any) => {
    if (!token || !id) return
    const res = await axios.get('/forms/records/queue', {
      headers: { Authorization: `Bearer ${token}` },
      params: { template_id: id, ...(getWorkspaceParams(user || currentUser) || {}) }
    })
    setItems(res.data || [])
  }

  const fetchDepartmentUsers = async (departmentId?: string | null) => {
    if (!token || !departmentId) return
    try {
      const res = await axios.get(`/access/departments/${departmentId}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDepartmentUsers(res.data || [])
    } catch (err) {
      console.warn('Unable to load department users', err)
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        const user = await fetchCurrentUser()
        const tmpl = await fetchTemplate(user)
        await fetchQueue(user)
        if (tmpl?.meta_data?.request_settings?.department_id) {
          await fetchDepartmentUsers(tmpl.meta_data.request_settings.department_id)
        }
      } catch (err: any) {
        console.error(err)
        setError(err?.response?.data?.detail || 'Failed to load queue')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [id])

  const handleAssign = async (requestId: string, assigneeId?: string | null) => {
    if (!token) return
    try {
      if (!assigneeId) {
        await axios.post(`/workflow/requests/${requestId}/unassign`, null, {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser)
        })
      } else {
        await axios.post(`/workflow/requests/${requestId}/assign`, { assignee_id: assigneeId }, {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser)
        })
      }
      fetchQueue()
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to update assignee')
    }
  }

  const handleStatusChange = async (requestId: string, status: RequestItem['status']) => {
    if (!token) return
    try {
      await axios.put(`/workflow/requests/${requestId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser)
      })
      fetchQueue()
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to update status')
    }
  }

  const columns = useMemo(() => template?.schema_structure || [], [template])

  const statusBadgeStyle = (status?: string) => ({
    display: 'inline-flex',
    padding: '4px 8px',
    borderRadius: theme.borderRadius.sm,
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'capitalize' as const,
    background: theme.colors.status[status as keyof typeof theme.colors.status] || '#f0f0f0',
    color: theme.colors.statusText[status as keyof typeof theme.colors.statusText] || '#333'
  })

  if (loading) {
    return <div style={{ padding: theme.spacing.lg }}>Loading...</div>
  }

  if (error || !template) {
    return (
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ color: theme.colors.error }}>{error || 'Template not found'}</div>
        <button
          onClick={() => navigate('/forms')}
          style={{
            marginTop: theme.spacing.md,
            background: theme.colors.gray.light,
            border: `1px solid ${theme.colors.gray.border}`,
            padding: '8px 14px',
            borderRadius: theme.borderRadius.md,
            cursor: 'pointer'
          }}
        >
          Back to Templates
        </button>
      </div>
    )
  }

  return (
    <div className="crm-page-shell" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{template.name} - Queue</h2>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            Requests generated by this template.
          </div>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <button
            onClick={() => navigate(`/requests?template_id=${template.id}`)}
            style={{
              background: theme.colors.primary,
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            New Entry
          </button>
          <button
            onClick={() => navigate(`/forms/${template.id}/records`)}
            style={{
              background: theme.colors.gray.light,
              border: `1px solid ${theme.colors.gray.border}`,
              padding: '8px 14px',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            Records
          </button>
          <button
            onClick={() => navigate('/forms')}
            style={{
              background: theme.colors.gray.light,
              border: `1px solid ${theme.colors.gray.border}`,
              padding: '8px 14px',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            Back
          </button>
        </div>
      </div>

      {!requestSettings?.department_id && (
        <div style={{
          background: '#fff6e6',
          border: '1px solid #ffd591',
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          color: '#ad6800'
        }}>
          This template has no request department configured. Queue management is unavailable.
        </div>
      )}

      <div className="crm-inline-grid-scroll" style={{
        background: '#fff',
        borderRadius: theme.borderRadius.lg,
        boxShadow: theme.shadows.sm,
        overflow: 'auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `220px 140px 120px 200px 160px repeat(${columns.length}, minmax(140px, 1fr))`,
          padding: theme.spacing.md,
          fontWeight: 700,
          fontSize: '13px',
          borderBottom: `1px solid ${theme.colors.gray.border}`,
          background: theme.colors.gray.light
        }}>
          <div>Request</div>
          <div>Status</div>
          <div>Priority</div>
          <div>Assignee</div>
          <div>Submitted</div>
          {columns.map(col => (
            <div key={col.key}>{col.label}</div>
          ))}
        </div>
        {items.length === 0 ? (
          <div style={{ padding: theme.spacing.lg, color: theme.colors.gray.text }}>
            No requests yet.
          </div>
        ) : items.map(item => {
          const request = item.request
          return (
            <div
              key={item.record.id}
              style={{
                display: 'grid',
                gridTemplateColumns: `220px 140px 120px 200px 160px repeat(${columns.length}, minmax(140px, 1fr))`,
                padding: theme.spacing.md,
                borderBottom: `1px solid ${theme.colors.gray.border}`,
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 600 }}>{request?.title || 'No request'}</div>
                {request?.id && (
                  <button
                    onClick={() => navigate(`/requests/${request.id}`)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: theme.colors.primary,
                      padding: 0,
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    Open request
                  </button>
                )}
              </div>
              <div>
                {request ? (
                  canManageQueue ? (
                    <select
                      value={request.status}
                      onChange={e => handleStatusChange(request.id, e.target.value as RequestItem['status'])}
                      style={{
                        padding: '6px 8px',
                        borderRadius: theme.borderRadius.sm,
                        border: `1px solid ${theme.colors.gray.border}`
                      }}
                    >
                      {statusOptions.map(status => (
                        <option key={status} value={status}>{status.replace('_', ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <span style={statusBadgeStyle(request.status)}>{request.status.replace('_', ' ')}</span>
                  )
                ) : (
                  <span style={{ color: theme.colors.gray.text }}>—</span>
                )}
              </div>
              <div style={{ textTransform: 'capitalize', fontSize: '12px' }}>{request?.priority || '—'}</div>
              <div>
                {request ? (
                  canManageQueue ? (
                    <select
                      value={request.assigned_to_id || ''}
                      onChange={e => handleAssign(request.id, e.target.value || null)}
                      style={{
                        padding: '6px 8px',
                        borderRadius: theme.borderRadius.sm,
                        border: `1px solid ${theme.colors.gray.border}`,
                        width: '100%'
                      }}
                    >
                      <option value="">Unassigned</option>
                      {departmentUsers.map(user => (
                        <option key={user.id} value={user.id}>{user.full_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span>{request.assignee?.full_name || 'Unassigned'}</span>
                  )
                ) : (
                  <span style={{ color: theme.colors.gray.text }}>—</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>
                {item.record.created_at ? new Date(item.record.created_at).toLocaleString() : '—'}
              </div>
              {columns.map(col => (
                <div key={`${item.record.id}-${col.key}`} style={{ fontSize: '13px' }}>
                  {String(item.record.entry_data?.[col.key] ?? '')}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default FormQueuePage
