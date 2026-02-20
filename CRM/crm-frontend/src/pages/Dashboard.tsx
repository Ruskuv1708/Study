import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from '../shared/theme'
import { normalizeRole, roleMatches } from '../shared/roleLabels'
import { getWorkspaceParams } from '../shared/workspace'
import type { FormField, FormTemplate } from '../features/forms/types'

const normalizeUserRole = (user: any) => ({
  ...user,
  role: normalizeRole(user.role),
})

const makeEmptyPayload = (fields: FormField[]) => {
  const next: Record<string, any> = {}
  fields.forEach(field => {
    if (field.type === 'boolean') {
      next[field.key] = false
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
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [quickPayload, setQuickPayload] = useState<Record<string, any>>({})
  const [quickSubmitting, setQuickSubmitting] = useState(false)
  const [quickMessage, setQuickMessage] = useState<string | null>(null)
  const [quickError, setQuickError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const canQuickCreate = useMemo(() => {
    return roleMatches(currentUser?.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])
  }, [currentUser?.role])

  const selectedTemplate = useMemo(() => {
    if (!templates.length) return null
    if (!selectedTemplateId) return templates[0]
    return templates.find(t => t.id === selectedTemplateId) || templates[0]
  }, [templates, selectedTemplateId])

  const quickFields = useMemo<FormField[]>(() => selectedTemplate?.schema_structure || [], [selectedTemplate])

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
        const [reqRes, templateRes] = await Promise.all([
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
        ])
        setRequests(reqRes.data)
        const loadedTemplates: FormTemplate[] = Array.isArray(templateRes.data) ? templateRes.data : []
        setTemplates(loadedTemplates)
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
    setQuickPayload(makeEmptyPayload(selectedTemplate.schema_structure || []))
    setQuickMessage(null)
    setQuickError(null)
  }, [selectedTemplate?.id])

  const getStatusColor = (status: string) => {
    return theme.colors.status[status as keyof typeof theme.colors.status] || theme.colors.gray.light
  }

  const getStatusTextColor = (status: string) => {
    return theme.colors.statusText[status as keyof typeof theme.colors.statusText] || '#333'
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
      setQuickPayload(makeEmptyPayload(quickFields))
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
    <div style={{ padding: theme.spacing.lg, backgroundColor: theme.colors.gray.lighter, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Welcome back, {currentUser.full_name}</h1>
          <p style={{ margin: '4px 0 0', color: theme.colors.gray.text }}>Role: {currentUser.role?.toUpperCase()}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/requests')}
            style={{
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 18px',
              cursor: 'pointer',
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
              padding: '10px 18px',
              cursor: 'pointer',
            }}
          >
            Departments
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        <div style={{ padding: '20px', borderRadius: '10px', background: 'white', boxShadow: theme.shadows.sm }}>
          <p style={{ margin: 0, fontSize: '12px', color: theme.colors.gray.textLight }}>Open requests</p>
          <h2 style={{ margin: '6px 0 0' }}>{requests.length}</h2>
        </div>
        <div style={{ padding: '20px', borderRadius: '10px', background: 'white', boxShadow: theme.shadows.sm }}>
          <p style={{ margin: 0, fontSize: '12px', color: theme.colors.gray.textLight }}>Status snapshot</p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            {['new', 'assigned', 'in_process', 'pending', 'done'].map(status => (
              <span key={status} style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                fontSize: '12px',
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

      <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: theme.shadows.md, marginBottom: '20px' }}>
        <div style={{ marginBottom: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Quick Request Box</h2>
          <button
            onClick={() => navigate('/forms')}
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
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
          <form onSubmit={submitQuickRequest} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text }}>Template</label>
              <select
                value={selectedTemplate?.id || ''}
                onChange={e => setSelectedTemplateId(e.target.value)}
                style={{ width: '100%', marginTop: '6px', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                {templates.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
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
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={quickPayload[field.key] ?? ''}
                      onChange={e => updateQuickValue(field, e.target.value)}
                      style={{ width: '100%', marginTop: '6px', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}
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
                  padding: '10px 16px',
                  cursor: quickSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {quickSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: theme.shadows.md }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Recent Requests</h2>
          <button
            onClick={() => navigate('/requests')}
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer',
            }}
          >
            Full list
          </button>
        </div>
        {requests.length === 0 ? (
          <p style={{ color: theme.colors.gray.text }}>No requests yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {requests.slice(0, 5).map(req => (
              <div key={req.id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{req.title}</strong>
                  <p style={{ margin: '4px 0 0', color: theme.colors.gray.text }}>{req.description?.substring(0, 80) || 'No description'}</p>
                </div>
                <span style={{
                  background: getStatusColor(req.status),
                  color: getStatusTextColor(req.status),
                  padding: '6px 10px',
                  borderRadius: '999px',
                  fontSize: '12px',
                }}>
                  {req.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
