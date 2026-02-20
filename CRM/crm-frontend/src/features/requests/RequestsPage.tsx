import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useLocation } from 'react-router-dom'
import { type RequestItem, type Department } from './types'
import type { FormTemplate, FormField } from '../forms/types'
import { ROLE_ASSIGNABLE, normalizeRole, roleMatches } from '../../shared/roleLabels'
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

const templateHasColumn = (template: FormTemplate | null, name: string) => {
  if (!template) return false
  const lower = name.toLowerCase()
  return (template.schema_structure || []).some(field => {
    const key = (field.key || '').toLowerCase()
    const label = (field.label || '').toLowerCase()
    return key === lower || label === lower
  })
}

const makeEmptyRow = (fields: FormField[]) => {
  const row: Record<string, any> = {}
  fields.forEach(field => {
    if (field.type === 'boolean') {
      row[field.key] = false
    } else {
      row[field.key] = ''
    }
  })
  return row
}

function RequestsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([]) // <--- Store Depts
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([])
  const [userNameCache, setUserNameCache] = useState<Record<string, string>>({})
  const [departmentCandidates, setDepartmentCandidates] = useState<Record<string, any[]>>({})
  const [assignNameInputs, setAssignNameInputs] = useState<Record<string, string>>({})
  
  // Form State
  const [isCreating, setIsCreating] = useState(false)
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [rows, setRows] = useState<Array<Record<string, any>>>([])
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const isMobile = useIsMobile()

  const templateFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('template_id')
  }, [location.search])

  const selectedTemplate = useMemo(() => {
    if (!templates.length) return null
    return templates.find(t => areIdsEqual(t.id, selectedTemplateId)) || templates[0]
  }, [templates, selectedTemplateId])

  const selectedFields = useMemo<FormField[]>(() => {
    return selectedTemplate?.schema_structure || []
  }, [selectedTemplate])

  const canSubmitTemplates = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])
  }, [currentUser])

  const templateMap = useMemo(() => {
    const map = new Map<string, FormTemplate>()
    templates.forEach(template => {
      const key = normalizeId(template.id)
      if (key) map.set(key, template)
    })
    return map
  }, [templates])

  // 1. Fetch Data (Requests AND Departments)
  const fetchData = async (user?: any) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return navigate('/')
    const params = getWorkspaceParams(user)

    try {
      // Parallel Fetch
      const [reqRes, deptRes] = await Promise.all([
        axios.get('/workflow/requests', { headers: { Authorization: `Bearer ${token}` }, params }),
        axios.get('/workflow/departments', { headers: { Authorization: `Bearer ${token}` }, params })
      ])

      setRequests(reqRes.data)
      await ensureAssignedUserNames(reqRes.data)
      setDepartments(deptRes.data)
      setLoading(false)
    } catch (err) {
      console.error(err)
    }
  }

  const fetchTemplates = async (user?: any) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      const res = await axios.get('/forms/templates', {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(user)
      })
      setTemplates(res.data || [])
      if (!selectedTemplateId && res.data?.length) {
        setSelectedTemplateId(res.data[0].id)
      }
    } catch (err) {
      console.warn('Unable to load templates', err)
    }
  }

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      const res = await axios.get('/access/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const normalized = normalizeUser(res.data)
      setCurrentUser(normalized)
      return normalized
    } catch (err) {
      console.error(err)
    }
  }

  const fetchDepartmentUsers = async (departmentId?: string) => {
    if (!departmentId) return []
    const token = localStorage.getItem('crm_token')
    if (!token) return []
    try {
      const res = await axios.get(`/access/departments/${departmentId}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const normalized = res.data.map(normalizeUser)
      setDepartmentCandidates(prev => ({ ...prev, [departmentId]: normalized }))
      cacheUserNames(normalized)
      return normalized
    } catch (err) {
      console.warn('Unable to fetch department users fallback', err)
      return []
    }
  }

  const fetchUsers = async (departmentId?: string) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      const res = await axios.get('/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const normalized = res.data.map(normalizeUser)
      setWorkspaceUsers(normalized)
      cacheUserNames(normalized)
    } catch (err) {
      console.error('Unable to fetch users', err)
      if (departmentId) {
        const fallback = await fetchDepartmentUsers(departmentId)
        if (fallback.length > 0) {
          setWorkspaceUsers(fallback)
        }
      }
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

  useEffect(() => {
    ;(async () => {
      const user = await fetchCurrentUser()
      await fetchUsers(user?.department_id)
      await fetchData(user)
      await fetchTemplates(user)
    })()
  }, [])

  useEffect(() => {
    if (!templateFromQuery) return
    setIsCreating(true)
    setSelectedTemplateId(templateFromQuery)
  }, [templateFromQuery])

  useEffect(() => {
    if (!selectedTemplate) return
    setSelectedTemplateId(selectedTemplate.id)
    setRows([makeEmptyRow(selectedFields)])
    setRowErrors({})
  }, [selectedTemplate?.id])

  const updateValue = (rowIndex: number, key: string, value: any) => {
    setRows(prev => prev.map((row, index) => index === rowIndex ? { ...row, [key]: value } : row))
  }

  const addRow = () => {
    setRows(prev => [...prev, makeEmptyRow(selectedFields)])
  }

  const removeRow = (rowIndex: number) => {
    setRows(prev => prev.filter((_, index) => index !== rowIndex))
    setRowErrors({})
  }

  const buildPayload = (row: Record<string, any>) => {
    const data: Record<string, any> = {}
    selectedFields.forEach(field => {
      const value = row[field.key]
      if (field.type === 'number') {
        if (value === '' || value === null || Number.isNaN(value)) return
        data[field.key] = Number(value)
        return
      }
      if (field.type === 'boolean') {
        data[field.key] = Boolean(value)
        return
      }
      if (value === '' && !field.required) return
      data[field.key] = value
    })
    return data
  }

  const validateRow = (row: Record<string, any>) => {
    for (const field of selectedFields) {
      if (!field.required) continue
      const value = row[field.key]
      if (value === '' || value === null || typeof value === 'undefined') {
        return `${field.label} is required`
      }
    }
    return null
  }

  const handleSubmitTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('crm_token')
    if (!token || !selectedTemplate) return
    setRowErrors({})
    const nextErrors: Record<number, string> = {}
    rows.forEach((row, index) => {
      const errorMessage = validateRow(row)
      if (errorMessage) {
        nextErrors[index] = errorMessage
      }
    })
    if (Object.keys(nextErrors).length > 0) {
      setRowErrors(nextErrors)
      return
    }
    setSubmitting(true)
    try {
      for (let index = 0; index < rows.length; index += 1) {
        const payload = buildPayload(rows[index])
        await axios.post('/forms/submit', {
          template_id: selectedTemplate.id,
          data: payload
        }, {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser)
        })
      }
      setIsCreating(false)
      setRows([makeEmptyRow(selectedFields)])
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (requestId: string) => {
    if (!window.confirm('Delete this request?')) return
    const token = localStorage.getItem('crm_token')
    try {
      await axios.delete(`/workflow/requests/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser)
      })
      fetchData()
    } catch (err) {
      alert('Failed to delete request')
    }
  }

  const handleStatusChange = async (requestId: string, status: string) => {
    const token = localStorage.getItem('crm_token')
    try {
      await axios.put(
        `/workflow/requests/${requestId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` }, params: getWorkspaceParams(currentUser) }
      )
      fetchData()
    } catch (err) {
      alert('Failed to update status')
    }
  }

  const assignToUser = async (requestId: string, assigneeId: string) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      await axios.post(
        `/workflow/requests/${requestId}/assign`,
        { assignee_id: assigneeId },
        { headers: { Authorization: `Bearer ${token}` }, params: getWorkspaceParams(currentUser) }
      )
      fetchData()
    } catch (err: any) {
      console.error('assign error', err)
      const detail = err?.response?.data?.detail ?? err?.message ?? ''
      alert(`Failed to assign request${detail ? `: ${detail}` : ''}`)
    }
  }

  const handleAssignByName = async (requestId: string, req: RequestItem) => {
    const inputName = assignNameInputs[requestId]?.trim()
    if (!inputName || !currentUser) return
    let suggestions = getNameSuggestions(req)
    let candidate = suggestions.find(user => user.full_name?.toLowerCase() === inputName.toLowerCase()) ?? suggestions[0]
    if (!candidate && req.department_id) {
      await fetchDepartmentUsers(req.department_id)
      suggestions = getNameSuggestions(req)
      candidate = suggestions.find(user => user.full_name?.toLowerCase() === inputName.toLowerCase()) ?? suggestions[0]
    }
    if (!candidate) {
      alert('No matching user found in this department')
      return
    }
    await assignToUser(requestId, candidate.id)
    setAssignNameInputs(prev => ({ ...prev, [requestId]: '' }))
  }

  const getDepartmentUserPool = (req: RequestItem) => {
    const workspaceList = workspaceUsers.filter(user => areIdsEqual(user.department_id, req.department_id))
    const cached = departmentCandidates[req.department_id || ''] || []
    const merged: any[] = []
    const seen = new Set<string>()
    for (const user of [...workspaceList, ...cached]) {
      if (!user?.id || seen.has(user.id)) continue
      seen.add(user.id)
      merged.push(user)
    }
    return merged
  }

  const getNameSuggestions = (req: RequestItem) => {
    if (!currentUser) return []
    const query = assignNameInputs[req.id]?.trim().toLowerCase() || ''
    if (!query) return []
    const departmentPool = getDepartmentUserPool(req)
    return departmentPool.filter(user => {
      return (
        user.full_name?.toLowerCase().includes(query) &&
        roleMatches(user.role, ROLE_ASSIGNABLE)
      )
    }).slice(0, 5)
  }

  const handleSelectSuggestion = async (requestId: string, userId: string, name: string) => {
    setAssignNameInputs(prev => ({ ...prev, [requestId]: name }))
    await assignToUser(requestId, userId)
  }

  // 3. Helper for Colors
  const statusPalette = useMemo(() => ({
    new: { label: 'NEW', color: '#e6f7ff', text: '#1890ff' },
    assigned: { label: 'ASSIGNED', color: '#e6f7ff', text: '#1890ff' },
    in_process: { label: 'IN PROCESS', color: '#fff7e6', text: '#faad14' },
    pending: { label: 'PENDING', color: '#fff1f0', text: '#ff4d4f' },
    done: { label: 'DONE', color: '#f6ffed', text: '#52c41a' }
  }), [])

  const canAssignRequest = Boolean(
    currentUser &&
    roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN','ADMIN','MANAGER'])
  )
  const isOwnerOrAssignee = (req: RequestItem) => Boolean(
    currentUser &&
    (req.created_by_id === currentUser.id || req.assigned_to_id === currentUser.id)
  )
  const canChangeStatusForRequest = (req: RequestItem) => {
    if (!currentUser) return false
    if (roleMatches(currentUser.role, ['VIEWER'])) return false
    if (roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN','ADMIN'])) return true
    if (roleMatches(currentUser.role, ['MANAGER'])) {
      return isOwnerOrAssignee(req) || areIdsEqual(req.department_id, currentUser.department_id)
    }
    return isOwnerOrAssignee(req)
  }
  const canDeleteRequest = (req: RequestItem) => canChangeStatusForRequest(req)
  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'critical': return '#ff4d4f';
      case 'high': return '#faad14';
      case 'medium': return '#1890ff';
      default: return '#52c41a';
    }
  }

  const getTemplateForRequest = (req: RequestItem) => {
    const templateId = req.meta_data?.template_id
    if (!templateId) return null
    const key = normalizeId(templateId)
    if (!key) return null
    return templateMap.get(key) || null
  }

  const formatDescription = (description?: string | null) => {
    if (!description) return null
    const normalized = description.replace(/\n+/g, ' • ').trim()
    if (normalized.length <= 180) return normalized
    return `${normalized.slice(0, 180)}...`
  }

  return (
    <div className="crm-page-shell" style={{ maxWidth: "1000px", margin: "0 auto", padding: isMobile ? "16px" : "40px", fontFamily: "sans-serif" }}>
      
      {/* Header */}
      <div className="crm-page-header" style={{ marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0 }}>All Requests</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ background: "none", border: "none", padding: 0, color: "gray", cursor: "pointer", marginTop: "5px" }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <div className="crm-header-actions" style={{ display: "flex", gap: "10px" }}>
          {roleMatches(currentUser?.role, ['SUPERADMIN','SYSTEM_ADMIN','ADMIN','MANAGER']) && (
            <button
              onClick={() => navigate('/requests/history')}
              style={{ background: "white", color: "black", height: "40px", border: "1px solid #ccc", width: isMobile ? '100%' : 'auto' }}
            >
              History
            </button>
          )}
          {canSubmitTemplates && (
            <button 
              onClick={() => setIsCreating(!isCreating)}
              style={{ background: "black", color: "white", height: "40px", width: isMobile ? '100%' : 'auto' }}
            >
              {isCreating ? "Cancel" : "+ New Request"}
            </button>
          )}
        </div>
      </div>

      {/* Create Form */}
      {isCreating && canSubmitTemplates && (
        <div style={{ padding: "20px", border: "1px solid #eee", borderRadius: "8px", marginBottom: "30px", background: "#f9f9f9" }}>
          <h3>New Request (Template)</h3>
          {templates.length === 0 ? (
            <div style={{ color: "gray" }}>No templates available yet.</div>
          ) : (
            <form onSubmit={handleSubmitTemplate} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "gray" }}>Template</label>
              <select
                value={selectedTemplate?.id || selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
                style={{ padding: "10px" }}
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>

              <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "12px", color: "gray" }}>
                  Each row creates a request.
                </div>
                <button
                  type="button"
                  onClick={addRow}
                  style={{ background: "#f0f1f6", border: "1px solid #ccd0db", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", width: isMobile ? '100%' : 'auto' }}
                >
                  + Add Row
                </button>
              </div>

              <div style={{
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                overflow: "auto",
                background: "#fff"
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: `60px repeat(${selectedFields.length}, minmax(160px, 1fr)) 90px`,
                  padding: "8px",
                  fontWeight: 700,
                  fontSize: "12px",
                  color: "gray",
                  background: "#f5f5f5",
                  borderBottom: "1px solid #e0e0e0"
                }}>
                  <div>#</div>
                  {selectedFields.map(field => (
                    <div key={field.key}>{field.label}{field.required ? ' *' : ''}</div>
                  ))}
                  <div>Action</div>
                </div>
                {rows.map((row, rowIndex) => (
                  <div key={`row-${rowIndex}`} style={{
                    display: "grid",
                    gridTemplateColumns: `60px repeat(${selectedFields.length}, minmax(160px, 1fr)) 90px`,
                    padding: "8px",
                    borderBottom: rowIndex === rows.length - 1 ? "none" : "1px solid #e0e0e0",
                    background: rowErrors[rowIndex] ? "#fff6e6" : "#fff",
                    alignItems: "center"
                  }}>
                    <div style={{ fontSize: "12px", color: "gray" }}>{rowIndex + 1}</div>
                    {selectedFields.map(field => (
                      <div key={`${rowIndex}-${field.key}`} style={{ paddingRight: "8px" }}>
                        {field.type === 'boolean' ? (
                          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                            <input
                              type="checkbox"
                              checked={Boolean(row[field.key])}
                              onChange={e => updateValue(rowIndex, field.key, e.target.checked)}
                            />
                            Yes / No
                          </label>
                        ) : (
                          <input
                            type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                            value={row[field.key] ?? ''}
                            onChange={e => updateValue(rowIndex, field.key, e.target.value)}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #e0e0e0" }}
                          />
                        )}
                      </div>
                    ))}
                    <div>
                      <button
                        type="button"
                        onClick={() => removeRow(rowIndex)}
                        disabled={rows.length === 1}
                        style={{
                          background: "transparent",
                          border: "1px solid #ddd",
                          padding: "6px 8px",
                          borderRadius: "6px",
                          cursor: rows.length === 1 ? "not-allowed" : "pointer"
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {Object.keys(rowErrors).length > 0 && (
                <div style={{ color: "#ff4d4f", fontSize: "12px" }}>
                  {Object.entries(rowErrors).map(([index, message]) => (
                    <div key={index}>Row {Number(index) + 1}: {message}</div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ background: submitting ? "#ccc" : "#1890ff", color: "white", padding: "10px", marginTop: "10px", border: "none", borderRadius: "6px", cursor: submitting ? "not-allowed" : "pointer", width: isMobile ? '100%' : 'auto' }}
              >
                {submitting ? "Submitting..." : "Submit Requests"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* The List */}
      {loading ? <p>Loading...</p> : (
        <div style={{ display: "grid", gap: "15px" }}>
          {requests.length === 0 && <p style={{color: "gray"}}>No requests found.</p>}
          
          {requests.map(req => {
            const suggestions = getNameSuggestions(req)
            const assignedName = getAssignedName(req)
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
                    {(() => {
                      const tmpl = getTemplateForRequest(req)
                      const showStatus = tmpl ? templateHasColumn(tmpl, 'status') : true
                      const showPriority = tmpl ? templateHasColumn(tmpl, 'priority') : true
                      const details = formatDescription(req.description)
                      return (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            <h3 style={{ margin: 0 }}>{req.title}</h3>
                            {showPriority && (
                              <span style={{
                                fontSize: "12px",
                                padding: "2px 8px",
                                borderRadius: "10px",
                                color: "white",
                                backgroundColor: getPriorityColor(req.priority)
                              }}>
                                {req.priority.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: "5px 0 0 0", color: "gray", fontSize: "14px" }}>
                            {showStatus && (
                              <>
                                Status: <strong>{req.status.replace("_", " ").toUpperCase()}</strong> • 
                              </>
                            )}
                            Dept: <strong>{departments.find(d => areIdsEqual(d.id, req.department_id))?.name || "Unknown"}</strong>
                          </p>
                          {details && (
                            <p style={{ margin: "6px 0 0 0", color: "#555", fontSize: "13px" }}>
                              {details}
                            </p>
                          )}
                        </>
                      )
                    })()}
                  {req.assigned_to_id && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "gray" }}>
                      Assigned to: {assignedName || 'Unknown'}
                    </p>
                  )}
                </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button style={{ border: "1px solid #ccc", background: "white" }} onClick={() => navigate(`/requests/${req.id}`)}>View Details</button>
                    {canDeleteRequest(req) && (
                      <button
                        onClick={() => handleDelete(req.id)}
                        style={{ border: "1px solid #f5222d", background: "#ff4d4f", color: "white" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                {canChangeStatusForRequest(req) && (
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select
                      value={req.status || 'new'}
                      onChange={(e) => handleStatusChange(req.id, e.target.value)}
                      style={{ padding: '6px', borderRadius: '6px' }}
                    >
                      {Object.keys(statusPalette).map(key => (
                        <option key={key} value={key}>{statusPalette[key as keyof typeof statusPalette].label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {canAssignRequest && !req.assigned_to_id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        value={assignNameInputs[req.id] || ''}
                        onChange={e => setAssignNameInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Assign by name"
                        style={{ padding: '5px 8px', borderRadius: '6px', flex: '1 1 220px' }}
                      />
                      <button
                        onClick={() => handleAssignByName(req.id, req)}
                        disabled={!assignNameInputs[req.id]}
                        style={{
                          padding: '6px 12px',
                          background: '#52c41a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: assignNameInputs[req.id] ? 'pointer' : 'not-allowed',
                          opacity: assignNameInputs[req.id] ? 1 : 0.6
                        }}
                      >
                        Assign
                      </button>
                    </div>

                    {suggestions.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '110%',
                        left: 0,
                        right: 0,
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        padding: '6px 0',
                        background: 'white',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
                        zIndex: 10
                      }}>
                        {suggestions.map(user => (
                          <div
                            key={user.id}
                            onClick={() => handleSelectSuggestion(req.id, user.id, user.full_name)}
                            style={{
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '13px'
                            }}
                          >
                            {user.full_name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {roleMatches(currentUser?.role, ['USER','VIEWER']) && !req.assigned_to_id && (
                    <button
                      onClick={() => assignToUser(req.id, currentUser.id)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #1890ff',
                        background: 'white',
                        color: '#1890ff',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      Assign to me
                    </button>
                  )}
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

export default RequestsPage
