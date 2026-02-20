import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from '../../shared/theme'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import type { Department, RequestItem } from './types'
import useIsMobile from '../../shared/useIsMobile'

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role),
})

const areIdsEqual = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false
  return a.toLowerCase() === b.toLowerCase()
}

const statusPalette = {
  new: { label: 'NEW', color: '#e6f7ff', text: '#1890ff' },
  assigned: { label: 'ASSIGNED', color: '#f6ffed', text: '#52c41a' },
  in_process: { label: 'IN PROCESS', color: '#fff7e6', text: '#faad14' },
  pending: { label: 'PENDING', color: '#fff1f0', text: '#ff4d4f' },
  done: { label: 'DONE', color: '#f0f0f0', text: '#595959' },
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical':
      return '#ff4d4f'
    case 'high':
      return '#faad14'
    case 'medium':
      return '#1890ff'
    default:
      return '#52c41a'
  }
}

function AssignedRequestsPage() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const summary = useMemo(() => {
    const newCount = requests.filter(req => req.status === 'new').length
    const pendingCount = requests.filter(req => req.status === 'pending').length
    return {
      assigned: requests.length,
      newCount,
      pendingCount,
    }
  }, [requests])

  const canChangeStatus = (req: RequestItem) => {
    if (!currentUser) return false
    if (roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN'])) return true
    if (roleMatches(currentUser.role, ['MANAGER'])) {
      return areIdsEqual(req.department_id, currentUser.department_id) || areIdsEqual(req.assigned_to_id, currentUser.id)
    }
    return areIdsEqual(req.assigned_to_id, currentUser.id) || areIdsEqual(req.created_by_id, currentUser.id)
  }

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/')
      return null
    }
    const res = await axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const normalized = normalizeUser(res.data)
    setCurrentUser(normalized)
    return normalized
  }

  const fetchData = async (user: any) => {
    const token = localStorage.getItem('crm_token')
    if (!token || !user?.id) return
    const workspaceParams = getWorkspaceParams(user) || {}
    const params = { ...workspaceParams, assignee_id: user.id }
    const [requestRes, departmentRes] = await Promise.all([
      axios.get('/workflow/requests', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
      axios.get('/workflow/departments', {
        headers: { Authorization: `Bearer ${token}` },
        params: workspaceParams,
      }),
    ])
    const assignedOnly: RequestItem[] = (requestRes.data || []).filter((req: RequestItem) => areIdsEqual(req.assigned_to_id, user.id))
    setRequests(assignedOnly)
    setDepartments(departmentRes.data || [])
  }

  useEffect(() => {
    ;(async () => {
      try {
        const user = await fetchCurrentUser()
        if (!user) return
        await fetchData(user)
      } catch (err: any) {
        console.error(err)
        setError(err?.response?.data?.detail || 'Failed to load assigned requests')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleStatusChange = async (requestId: string, status: RequestItem['status']) => {
    const token = localStorage.getItem('crm_token')
    if (!token || !currentUser) return
    setUpdating(prev => ({ ...prev, [requestId]: true }))
    try {
      await axios.put(
        `/workflow/requests/${requestId}/status`,
        { status },
        {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser),
        }
      )
      await fetchData(currentUser)
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to update status')
    } finally {
      setUpdating(prev => ({ ...prev, [requestId]: false }))
    }
  }

  if (loading) {
    return <div style={{ padding: theme.spacing.lg }}>Loading...</div>
  }

  if (error) {
    return (
      <div style={{ padding: theme.spacing.lg, color: theme.colors.error }}>
        {error}
      </div>
    )
  }

  return (
    <div className="crm-page-shell" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>Assigned Requests</h1>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            This page shows requests currently assigned to you.
          </div>
        </div>
        <button
          onClick={() => navigate('/requests')}
          style={{
            background: '#fff',
            border: `1px solid ${theme.colors.gray.border}`,
            borderRadius: theme.borderRadius.md,
            padding: '8px 12px',
            cursor: 'pointer',
            width: isMobile ? '100%' : 'auto'
          }}
        >
          All Requests
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: theme.spacing.md }}>
        <div style={{ background: '#fff', borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, boxShadow: theme.shadows.sm }}>
          <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>Assigned to you</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{summary.assigned}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, boxShadow: theme.shadows.sm }}>
          <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>New</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{summary.newCount}</div>
        </div>
        <div style={{ background: '#fff', borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, boxShadow: theme.shadows.sm }}>
          <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>Pending</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{summary.pendingCount}</div>
        </div>
      </div>

      {requests.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg, color: theme.colors.gray.text }}>
          No assigned requests right now.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: theme.spacing.md }}>
          {requests.map(req => {
            const statusStyle = statusPalette[req.status] || statusPalette.new
            const departmentName = departments.find(dep => areIdsEqual(dep.id, req.department_id))?.name || 'Unknown'
            return (
              <div
                key={req.id}
                style={{
                  background: '#fff',
                  borderRadius: theme.borderRadius.lg,
                  padding: theme.spacing.lg,
                  boxShadow: theme.shadows.sm,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing.sm,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong>{req.title}</strong>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          background: getPriorityColor(req.priority),
                          color: '#fff',
                          textTransform: 'uppercase',
                        }}
                      >
                        {req.priority}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: theme.colors.gray.text }}>
                      Department: <strong>{departmentName}</strong>
                    </div>
                    {req.description && (
                      <div style={{ fontSize: '13px', color: theme.colors.gray.text }}>
                        {req.description}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        background: statusStyle.color,
                        color: statusStyle.text,
                        fontWeight: 700,
                      }}
                    >
                      {statusStyle.label}
                    </span>
                    <button
                      onClick={() => navigate(`/requests/${req.id}`)}
                      style={{
                        background: '#fff',
                        border: `1px solid ${theme.colors.gray.border}`,
                        borderRadius: theme.borderRadius.md,
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>

                {canChangeStatus(req) && (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', color: theme.colors.gray.text }}>Status</label>
                    <select
                      value={req.status}
                      onChange={e => handleStatusChange(req.id, e.target.value as RequestItem['status'])}
                      disabled={Boolean(updating[req.id])}
                      style={{
                        padding: '6px 10px',
                        borderRadius: theme.borderRadius.md,
                        border: `1px solid ${theme.colors.gray.border}`,
                        background: '#fff',
                      }}
                    >
                      <option value="new">NEW</option>
                      <option value="assigned">ASSIGNED</option>
                      <option value="in_process">IN PROCESS</option>
                      <option value="pending">PENDING</option>
                      <option value="done">DONE</option>
                    </select>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default AssignedRequestsPage
