import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from '../shared/theme'
import { normalizeRole, roleMatches } from '../shared/roleLabels'
import { getWorkspaceParams } from '../shared/workspace'
import type { FormField, FormTemplate } from '../features/forms/types'
import useIsMobile from '../shared/useIsMobile'
import useRegistryAutocomplete, {
  isClientField,
  isCompanyField,
  isDepartmentField,
  isPriorityField,
  isStatusField,
  REQUEST_PRIORITY_OPTIONS,
  REQUEST_STATUS_OPTIONS,
} from '../shared/useRegistryAutocomplete'

const normalizeUserRole = (user: any) => ({
  ...user,
  role: normalizeRole(user.role),
})

const makeEmptyPayload = (fields: FormField[], defaultDepartmentId: string = '') => {
  const next: Record<string, any> = {}
  fields.forEach(field => {
    if (field.type === 'boolean') {
      next[field.key] = false
    } else if (isStatusField(field)) {
      next[field.key] = REQUEST_STATUS_OPTIONS[0].value
    } else if (isPriorityField(field)) {
      next[field.key] = 'medium'
    } else if (isDepartmentField(field)) {
      next[field.key] = defaultDepartmentId
    } else {
      next[field.key] = ''
    }
  })
  return next
}

function Dashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [quickPayload, setQuickPayload] = useState<Record<string, any>>({})
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const [quickMessage, setQuickMessage] = useState<string | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { companyNames, clientNames } = useRegistryAutocomplete(currentUser)

  const canQuickCreate = useMemo(() => {
    return roleMatches(currentUser?.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])
  }, [currentUser?.role])

  const selectedTemplate = useMemo(() => {
    if (!templates.length) return null
    if (!selectedTemplateId) return templates[0]
    return templates.find(t => t.id === selectedTemplateId) || templates[0]
  }, [templates, selectedTemplateId])

  const quickFields = useMemo<FormField[]>(() => selectedTemplate?.schema_structure || [], [selectedTemplate])
  const departmentNameMap = useMemo(() => {
    const map = new Map<string, string>()
    departments.forEach(dep => {
      if (!dep?.id || !dep?.name) return
      map.set(String(dep.id).toLowerCase(), String(dep.name))
    })
    return map
  }, [departments])
  const recentRequests = useMemo(() => {
    return [...requests]
      .sort((a, b) => {
        const aTime = new Date(a?.created_at || a?.updated_at || 0).getTime()
        const bTime = new Date(b?.created_at || b?.updated_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, 20)
  }, [requests])

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/')
      return
    }

    axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then(async res => {
      const normalized = normalizeUserRole(res.data)
      setCurrentUser(normalized)
      const params = getWorkspaceParams(normalized)
      const canLoadTemplates = roleMatches(normalized.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])

      try {
        const [reqRes, templateRes, departmentRes] = await Promise.all([
          axios.get('/workflow/requests', {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }),
          canLoadTemplates
            ? axios.get('/forms/templates', {
                headers: { Authorization: `Bearer ${token}` },
                params,
              })
            : Promise.resolve({ data: [] }),
          canLoadTemplates
            ? axios.get('/workflow/departments', {
                headers: { Authorization: `Bearer ${token}` },
                params,
              })
            : Promise.resolve({ data: [] }),
        ])
        setRequests(reqRes.data)
        const loadedTemplates: FormTemplate[] = Array.isArray(templateRes.data) ? templateRes.data : []
        setTemplates(loadedTemplates)
        setDepartments(Array.isArray(departmentRes.data) ? departmentRes.data : [])
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    })
    .catch(err => {
      console.error('Error fetching user:', err)
      localStorage.removeItem('crm_token')
      navigate('/')
    })
  }, [navigate])

  useEffect(() => {
    if (!selectedTemplate) {
      setQuickPayload({})
      return
    }
    setSelectedTemplateId(selectedTemplate.id)
    setQuickPayload(makeEmptyPayload(selectedTemplate.schema_structure || [], departments[0]?.id || ''))
    setQuickMessage(null)
    setQuickError(null)
  }, [selectedTemplate?.id, departments[0]?.id])

  const getStatusColor = (status: string) => {
    return theme.colors.status[status as keyof typeof theme.colors.status] || theme.colors.gray.light
  }

  const getStatusTextColor = (status: string) => {
    return theme.colors.statusText[status as keyof typeof theme.colors.statusText] || '#333'
  }

  const getDepartmentName = (departmentId?: string | null) => {
    if (!departmentId) return '—'
    return departmentNameMap.get(String(departmentId).toLowerCase()) || '—'
  }

  const updateQuickValue = (field: FormField, value: any) => {
    setQuickPayload(prev => ({ ...prev, [field.key]: value }))
  }

  const validateQuickPayload = () => {
    for (const field of quickFields) {
      if (!field.required) continue
      const value = quickPayload[field.key]
      if (value === '' || value === null || typeof value === 'undefined') {
        return `${field.label} is required`
      }
    }
    return null
  }

  const buildSubmitData = () => {
    const data: Record<string, any> = {}
    quickFields.forEach(field => {
      const value = quickPayload[field.key]
      if (field.type === 'number') {
        if (value === '' || value === null || Number.isNaN(value)) {
          return
        }
        data[field.key] = Number(value)
        return
      }
      if (field.type === 'boolean') {
        data[field.key] = Boolean(value)
        return
      }
      if (isDepartmentField(field) && (value === '' || value === null || typeof value === 'undefined')) {
        if (departments[0]?.id) {
          data[field.key] = departments[0].id
        }
        return
      }
      if (value === '' && !field.required) {
        return
      }
      data[field.key] = value
    })
    return data
  }

  const refreshRequests = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token || !currentUser) return
    const params = getWorkspaceParams(currentUser)
    const reqRes = await axios.get('/workflow/requests', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    })
    setRequests(reqRes.data)
  }

  const submitQuickRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate || !currentUser) return

    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/')
      return
    }

    const validationError = validateQuickPayload()
    if (validationError) {
      setQuickError(validationError)
      setQuickMessage(null)
      return
    }

    setQuickSubmitting(true)
    setQuickError(null)
    setQuickMessage(null)

    try {
      await axios.post('/forms/submit', {
        template_id: selectedTemplate.id,
        data: buildSubmitData(),
      }, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser),
      })

      setQuickMessage('Request submitted successfully')
      setQuickPayload(makeEmptyPayload(quickFields, departments[0]?.id || ''))
      await refreshRequests()
    } catch (err: any) {
      console.error('Failed to submit request:', err)
      const detail = err?.response?.data?.detail
      setQuickError(typeof detail === 'string' ? detail : 'Failed to submit request')
    } finally {
      setQuickSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>
  if (!currentUser) return <div style={{ padding: '50px', textAlign: 'center' }}>No user data</div>

  return (
    <div className="crm-page-shell" style={{ padding: theme.spacing.md, backgroundColor: theme.colors.gray.lighter, minHeight: '100vh' }}>
      <div className="crm-page-header" style={{ marginBottom: theme.spacing.md }}>
        <div>
          <h1 style={{ margin: 0, fontSize: isMobile ? '24px' : '30px', lineHeight: 1.1 }}>Welcome back, {currentUser.full_name}</h1>
          <p style={{ margin: '2px 0 0', color: theme.colors.gray.text, fontSize: '12px' }}>Role: {currentUser.role?.toUpperCase()}</p>
        </div>
        <div className="crm-header-actions" style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/requests')}
            style={{
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            View Requests
          </button>
          <button
            onClick={() => navigate('/departments')}
            style={{
              background: '#13c2c2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Departments
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '12px' }}>
        <div style={{ padding: '14px', borderRadius: '10px', background: 'white', boxShadow: theme.shadows.sm }}>
          <p style={{ margin: 0, fontSize: '12px', color: theme.colors.gray.textLight }}>Open requests</p>
          <h2 style={{ margin: '4px 0 0', lineHeight: 1 }}>{requests.length}</h2>
        </div>
        <div style={{ padding: '14px', borderRadius: '10px', background: 'white', boxShadow: theme.shadows.sm }}>
          <p style={{ margin: 0, fontSize: '12px', color: theme.colors.gray.textLight }}>Status snapshot</p>
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['new', 'assigned', 'in_process', 'pending', 'done'].map(status => (
              <span key={status} style={{
                flex: isMobile ? '0 0 auto' : 1,
                padding: '5px',
                borderRadius: '6px',
                fontSize: '11px',
                background: getStatusColor(status),
                color: getStatusTextColor(status),
                textAlign: 'center',
              }}>
                {status.replace('_', ' ').toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', padding: '14px', boxShadow: theme.shadows.md, marginBottom: '12px' }}>
        <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Quick Request</h2>
          <button
            onClick={() => navigate('/forms')}
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Manage Templates
          </button>
        </div>

        {!canQuickCreate ? (
          <p style={{ color: theme.colors.gray.text }}>Your role cannot create requests from templates.</p>
        ) : templates.length === 0 ? (
          <p style={{ color: theme.colors.gray.text }}>No templates available. Create one in Forms first.</p>
        ) : (
          <form onSubmit={submitQuickRequest} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text }}>Template</label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={e => setSelectedTemplateId(e.target.value)}
                style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                {templates.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>

            {companyNames.length > 0 && (
              <datalist id="dashboard-registry-company-options">
                {companyNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
            {clientNames.length > 0 && (
              <datalist id="dashboard-registry-client-options">
                {clientNames.map(name => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              {quickFields.map(field => (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text }}>
                    {field.label}{field.required ? ' *' : ''}
                  </label>
                  {field.type === 'boolean' ? (
                    <label style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(quickPayload[field.key])}
                        onChange={e => updateQuickValue(field, e.target.checked)}
                      />
                      <span style={{ fontSize: '13px', color: theme.colors.gray.text }}>Yes / No</span>
                    </label>
                  ) : isStatusField(field) ? (
                    <select
                      value={quickPayload[field.key] || REQUEST_STATUS_OPTIONS[0].value}
                      onChange={e => updateQuickValue(field, e.target.value)}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      {REQUEST_STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : isPriorityField(field) ? (
                    <select
                      value={quickPayload[field.key] || 'medium'}
                      onChange={e => updateQuickValue(field, e.target.value)}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      {REQUEST_PRIORITY_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  ) : isDepartmentField(field) ? (
                    <select
                      value={quickPayload[field.key] || (departments[0]?.id || '')}
                      onChange={e => updateQuickValue(field, e.target.value)}
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd' }}
                    >
                      {departments.length === 0 && <option value="">No departments</option>}
                      {departments.map(dep => (
                        <option key={dep.id} value={dep.id}>{dep.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={quickPayload[field.key] ?? ''}
                      onChange={e => updateQuickValue(field, e.target.value)}
                      list={
                        isCompanyField(field)
                          ? 'dashboard-registry-company-options'
                          : isClientField(field)
                            ? 'dashboard-registry-client-options'
                            : undefined
                      }
                      style={{ width: '100%', marginTop: '4px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd' }}
                    />
                  )}
                </div>
              ))}
            </div>

            {quickError && (
              <div style={{ color: '#cf1322', fontSize: '13px' }}>{quickError}</div>
            )}
            {quickMessage && (
              <div style={{ color: '#237804', fontSize: '13px' }}>{quickMessage}</div>
            )}

            <div>
              <button
                type="submit"
                disabled={quickSubmitting}
                style={{
                  background: quickSubmitting ? '#9cc4ff' : '#1890ff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  cursor: quickSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {quickSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '10px', padding: '14px', boxShadow: theme.shadows.md }}>
        <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '24px' }}>Recent Requests ({recentRequests.length})</h2>
          <button
            onClick={() => navigate('/requests')}
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '6px 10px',
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Full list
          </button>
        </div>
        {recentRequests.length === 0 ? (
          <p style={{ color: theme.colors.gray.text, margin: 0 }}>No requests yet.</p>
        ) : (
          <div className="crm-inline-grid-scroll" style={{ border: '1px solid #eee', borderRadius: '8px', overflow: 'auto' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.8fr) 130px 150px 180px',
              padding: '8px 10px',
              fontSize: '11px',
              fontWeight: 700,
              color: theme.colors.gray.text,
              borderBottom: '1px solid #eee',
              background: '#fafafa',
            }}>
              <div>Request</div>
              {!isMobile && <div>Status</div>}
              {!isMobile && <div>Department</div>}
              {!isMobile && <div>Created</div>}
            </div>
            <div style={{ maxHeight: isMobile ? 'none' : '420px', overflow: 'auto' }}>
              {recentRequests.map(req => (
                <button
                  key={req.id}
                  onClick={() => navigate(`/requests/${req.id}`)}
                  style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1.8fr) 130px 150px 180px',
                    padding: '8px 10px',
                    border: 'none',
                    borderBottom: '1px solid #f0f0f0',
                    background: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    alignItems: 'center',
                    gap: isMobile ? '4px' : '8px',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.title || 'Untitled request'}
                    </div>
                    <div style={{ color: theme.colors.gray.text, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {req.description || 'No description'}
                    </div>
                    {isMobile && (
                      <div style={{ color: theme.colors.gray.text, fontSize: '11px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {req.status?.replace('_', ' ').toUpperCase()} • {getDepartmentName(req.department_id)} • {req.created_at ? new Date(req.created_at).toLocaleString() : '—'}
                      </div>
                    )}
                  </div>
                  {!isMobile && (
                    <div>
                      <span style={{
                        display: 'inline-block',
                        background: getStatusColor(req.status),
                        color: getStatusTextColor(req.status),
                        padding: '4px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        lineHeight: 1,
                      }}>
                        {req.status?.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  )}
                  {!isMobile && (
                    <div style={{ color: theme.colors.gray.text, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getDepartmentName(req.department_id)}
                    </div>
                  )}
                  {!isMobile && (
                    <div style={{ color: theme.colors.gray.text, fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {req.created_at ? new Date(req.created_at).toLocaleString() : '—'}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
