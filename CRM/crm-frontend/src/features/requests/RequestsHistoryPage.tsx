import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { type RequestItem, type Department } from './types'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import useIsMobile from '../../shared/useIsMobile'

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

const normalizeId = (value?: string | null): string | null => value ? value.toLowerCase() : null
const areIdsEqual = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false
  return normalizeId(a) === normalizeId(b)
}

function RequestsHistoryPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userNameCache, setUserNameCache] = useState<Record<string, string>>({})
  const isMobile = useIsMobile()

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token) return navigate('/')
    try {
      const res = await axios.get('/access/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const normalized = normalizeUser(res.data)
      setCurrentUser(normalized)
      if (!roleMatches(normalized.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])) {
        navigate('/requests')
      }
    } catch (err) {
      console.error(err)
      navigate('/')
    }
  }

  const cacheUserNames = (users: any[]) => {
    setUserNameCache(prev => {
      const next = { ...prev }
      users.forEach(user => {
        if (user?.id && user?.full_name) {
          next[user.id] = user.full_name
        }
      })
      return next
    })
  }

  const fetchAssignedUserName = async (userId?: string | null) => {
    if (!userId) return
    if (userNameCache[userId]) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      const res = await axios.get(`/access/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      cacheUserNames([normalizeUser(res.data)])
    } catch (err) {
      console.warn('Unable to load assigned user info', err)
    }
  }

  const ensureAssignedUserNames = async (reqs: RequestItem[]) => {
    const ids = Array.from(new Set(reqs.filter(r => r.assigned_to_id).map(r => r.assigned_to_id)))
    await Promise.all(ids.map(id => fetchAssignedUserName(id)))
  }

  const getAssignedName = (req: RequestItem) => {
    if (req.assignee?.full_name) return req.assignee.full_name
    if (!req.assigned_to_id) return null
    if (userNameCache[req.assigned_to_id]) {
      return userNameCache[req.assigned_to_id]
    }
    return null
  }

  const fetchHistory = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    const params = getWorkspaceParams(currentUser)
    try {
      const [reqRes, deptRes] = await Promise.all([
        axios.get('/workflow/requests/history', { headers: { Authorization: `Bearer ${token}` }, params }),
        axios.get('/workflow/departments', { headers: { Authorization: `Bearer ${token}` }, params })
      ])
      setRequests(reqRes.data || [])
      await ensureAssignedUserNames(reqRes.data || [])
      setDepartments(deptRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrentUser()
  }, [])

  useEffect(() => {
    if (!currentUser) return
    fetchHistory()
  }, [currentUser])

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'critical': return '#ff4d4f';
      case 'high': return '#faad14';
      case 'medium': return '#1890ff';
      default: return '#52c41a';
    }
  }

  const formatDescription = (description?: string | null) => {
    if (!description) return null
    const normalized = description.replace(/\n+/g, ' • ').trim()
    if (normalized.length <= 220) return normalized
    return `${normalized.slice(0, 220)}...`
  }

  const getDoneAt = (req: RequestItem) => {
    const doneAt = req.meta_data?.done_at
    return doneAt || req.updated_at || null
  }

  const canView = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])
  }, [currentUser])

  if (!canView) {
    return <div style={{ padding: '40px' }}>Loading...</div>
  }

  return (
    <div className="crm-page-shell" style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobile ? "16px" : "40px", fontFamily: "sans-serif" }}>
      <div className="crm-page-header" style={{ marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Request History</h1>
          <button 
            onClick={() => navigate('/requests')}
            style={{ background: "none", border: "none", padding: 0, color: "gray", cursor: "pointer", marginTop: "5px" }}
          >
            ← Back to Requests
          </button>
        </div>
      </div>

      {loading ? <p>Loading...</p> : (
        <div style={{ display: "grid", gap: "15px" }}>
          {requests.length === 0 && <p style={{color: "gray"}}>No completed requests found.</p>}
          {requests.map(req => {
            const assignedName = getAssignedName(req)
            const doneAt = getDoneAt(req)
            const details = formatDescription(req.description)
            return (
              <div key={req.id} style={{
                border: "1px solid #eee",
                borderRadius: "8px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: "white",
                boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <h3 style={{ margin: 0 }}>{req.title}</h3>
                      <span style={{
                        fontSize: "12px",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        color: "white",
                        backgroundColor: getPriorityColor(req.priority)
                      }}>
                        {req.priority.toUpperCase()}
                      </span>
                    </div>
                    <p style={{ margin: "5px 0 0 0", color: "gray", fontSize: "14px" }}>
                      Status: <strong>{req.status.replace("_", " ").toUpperCase()}</strong> • 
                      Dept: <strong>{departments.find(d => areIdsEqual(d.id, req.department_id))?.name || "Unknown"}</strong>
                    </p>
                    {details && (
                      <p style={{ margin: "6px 0 0 0", color: "#555", fontSize: "13px" }}>
                        {details}
                      </p>
                    )}
                    <div style={{ marginTop: "8px", fontSize: "12px", color: "gray" }}>
                      Created: {req.created_at ? new Date(req.created_at).toLocaleString() : '—'} • 
                      Done: {doneAt ? new Date(doneAt).toLocaleString() : '—'}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    {assignedName && (
                      <span style={{ fontSize: "12px", color: "gray" }}>
                        Assigned to: {assignedName}
                      </span>
                    )}
                    <button style={{ border: "1px solid #ccc", background: "white", width: isMobile ? '100%' : 'auto' }} onClick={() => navigate(`/requests/${req.id}`)}>
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default RequestsHistoryPage
