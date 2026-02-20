import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

import theme from '../shared/theme'
import { normalizeRole, roleMatches } from '../shared/roleLabels'
import { getWorkspaceParams } from '../shared/workspace'
import useIsMobile from '../shared/useIsMobile'

type CompanyItem = {
  id: string
  name: string
  registration_number?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  client_count: number
  created_at?: string | null
}

type ClientItem = {
  id: string
  first_name: string
  last_name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  company_id?: string | null
  company_name?: string | null
  status?: string
  status_company_id?: string | null
  status_company_name?: string | null
  status_label?: string | null
  created_at?: string | null
}

type ClientObjectItem = {
  id: string
  name: string
  client_id?: string | null
  client_name?: string | null
  company_id?: string | null
  company_name?: string | null
  assignment_type?: string
  assignment_name?: string | null
  attributes: Record<string, string>
  created_at?: string | null
}

type ObjectAttributeInput = {
  key: string
  value: string
}

type ObjectAssignmentTarget = 'none' | 'client' | 'company'

type ObjectFormState = {
  name: string
  assignment_target: ObjectAssignmentTarget
  client_id: string
  company_id: string
  attributes: ObjectAttributeInput[]
}

const CLIENT_STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'active', label: 'Active' },
  { value: 'reactivated', label: 'Reactivated' },
  { value: 'deactivated', label: 'Deactivated' },
  { value: 'changed_from', label: 'Changed from company' },
  { value: 'changed_to', label: 'Changed to company' },
]

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role),
})

const buildEmptyObjectForm = (): ObjectFormState => ({
  name: '',
  assignment_target: 'none',
  client_id: '',
  company_id: '',
  attributes: [{ key: '', value: '' }],
})

const getClientDisplayName = (client: ClientItem) => `${client.first_name} ${client.last_name}`.trim()

const getObjectAssignmentTarget = (clientObject: ClientObjectItem): ObjectAssignmentTarget => {
  if (clientObject.client_id) return 'client'
  if (clientObject.company_id) return 'company'
  return 'none'
}

function CompanyClientRegistrationPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [clients, setClients] = useState<ClientItem[]>([])
  const [clientObjects, setClientObjects] = useState<ClientObjectItem[]>([])

  const [companyForm, setCompanyForm] = useState({
    name: '',
    registration_number: '',
    email: '',
    phone: '',
    address: '',
  })
  const [clientForm, setClientForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company_id: '',
    notes: '',
    status: 'new',
    status_company_id: '',
  })
  const [objectForm, setObjectForm] = useState<ObjectFormState>(buildEmptyObjectForm)

  const [loading, setLoading] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [savingObject, setSavingObject] = useState(false)
  const [assigningObjectId, setAssigningObjectId] = useState<string | null>(null)
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)
  const [deletingObjectId, setDeletingObjectId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canCreate = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])
  }, [currentUser])

  const canDelete = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN'])
  }, [currentUser])

  const canManageObjects = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])
  }, [currentUser])

  const requiresStatusCompany = useMemo(() => {
    return clientForm.status === 'changed_from' || clientForm.status === 'changed_to'
  }, [clientForm.status])

  const statusCompanyLabel = useMemo(() => {
    if (clientForm.status === 'changed_from') return 'Changed from company'
    if (clientForm.status === 'changed_to') return 'Changed to company'
    return 'Status company'
  }, [clientForm.status])

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

  const fetchRegistryData = async (user: any) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    const params = getWorkspaceParams(user)
    const [companyRes, clientRes, objectRes] = await Promise.all([
      axios.get('/registry/companies', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
      axios.get('/registry/clients', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
      axios.get('/registry/objects', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
    ])
    setCompanies(Array.isArray(companyRes.data) ? companyRes.data : [])
    setClients(Array.isArray(clientRes.data) ? clientRes.data : [])
    setClientObjects(Array.isArray(objectRes.data) ? objectRes.data : [])
  }

  useEffect(() => {
    ;(async () => {
      try {
        const user = await fetchCurrentUser()
        if (!user) return
        await fetchRegistryData(user)
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Failed to load registration data')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const handleCreateCompany = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setSavingCompany(true)
    setError(null)
    try {
      await axios.post('/registry/companies', companyForm, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser),
      })
      setCompanyForm({
        name: '',
        registration_number: '',
        email: '',
        phone: '',
        address: '',
      })
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to register company')
    } finally {
      setSavingCompany(false)
    }
  }

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setSavingClient(true)
    setError(null)
    try {
      await axios.post(
        '/registry/clients',
        {
          ...clientForm,
          company_id: clientForm.company_id || null,
          status: clientForm.status || 'new',
          status_company_id: requiresStatusCompany ? clientForm.status_company_id || null : null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser),
        },
      )
      setClientForm({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company_id: '',
        notes: '',
        status: 'new',
        status_company_id: '',
      })
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to register client')
    } finally {
      setSavingClient(false)
    }
  }

  const formatClientStatus = (client: ClientItem) => {
    if (client.status_label) return client.status_label
    const status = (client.status || 'new').toLowerCase()
    if (status === 'changed_from') {
      return client.status_company_name ? `Changed from ${client.status_company_name}` : 'Changed from company'
    }
    if (status === 'changed_to') {
      return client.status_company_name ? `Changed to ${client.status_company_name}` : 'Changed to company'
    }
    const plainLabel = CLIENT_STATUS_OPTIONS.find(option => option.value === status)?.label
    return plainLabel || 'New'
  }

  const buildObjectAttributes = () => {
    const next: Record<string, string> = {}
    objectForm.attributes.forEach(item => {
      const key = item.key.trim()
      if (!key) return
      next[key] = item.value.trim()
    })
    return next
  }

  const formatObjectAttributes = (attributes: Record<string, string>) => {
    const entries = Object.entries(attributes || {})
    if (entries.length === 0) return '—'
    return entries.map(([key, value]) => `${key}: ${value || '—'}`).join(' | ')
  }

  const handleObjectAttributeChange = (index: number, field: 'key' | 'value', value: string) => {
    setObjectForm(prev => {
      const nextAttributes = [...prev.attributes]
      if (!nextAttributes[index]) return prev
      nextAttributes[index] = { ...nextAttributes[index], [field]: value }
      return { ...prev, attributes: nextAttributes }
    })
  }

  const handleAddObjectAttribute = () => {
    setObjectForm(prev => ({
      ...prev,
      attributes: [...prev.attributes, { key: '', value: '' }],
    }))
  }

  const handleRemoveObjectAttribute = (index: number) => {
    setObjectForm(prev => {
      if (prev.attributes.length <= 1) {
        return { ...prev, attributes: [{ key: '', value: '' }] }
      }
      return {
        ...prev,
        attributes: prev.attributes.filter((_, itemIndex) => itemIndex !== index),
      }
    })
  }

  const handleCreateObject = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!currentUser) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setSavingObject(true)
    setError(null)
    try {
      await axios.post(
        '/registry/objects',
        {
          name: objectForm.name.trim(),
          client_id: objectForm.assignment_target === 'client' ? objectForm.client_id || null : null,
          company_id: objectForm.assignment_target === 'company' ? objectForm.company_id || null : null,
          attributes: buildObjectAttributes(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser),
        },
      )
      setObjectForm(buildEmptyObjectForm())
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to create object')
    } finally {
      setSavingObject(false)
    }
  }

  const handleAssignObject = async (
    objectId: string,
    assignment: { client_id?: string | null; company_id?: string | null },
  ) => {
    if (!currentUser) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setAssigningObjectId(objectId)
    setError(null)
    try {
      await axios.put(
        `/registry/objects/${objectId}`,
        {
          client_id: assignment.client_id || null,
          company_id: assignment.company_id || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser),
        },
      )
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to update object assignment')
    } finally {
      setAssigningObjectId(null)
    }
  }

  const handleDeleteObject = async (objectId: string) => {
    if (!currentUser) return
    if (!window.confirm('Delete this object?')) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setDeletingObjectId(objectId)
    setError(null)
    try {
      await axios.delete(`/registry/objects/${objectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser),
      })
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete object')
    } finally {
      setDeletingObjectId(null)
    }
  }

  const handleDeleteCompany = async (companyId: string) => {
    if (!currentUser) return
    if (!window.confirm('Delete this company?')) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setDeletingCompanyId(companyId)
    setError(null)
    try {
      await axios.delete(`/registry/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser),
      })
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete company')
    } finally {
      setDeletingCompanyId(null)
    }
  }

  const handleDeleteClient = async (clientId: string) => {
    if (!currentUser) return
    if (!window.confirm('Delete this client?')) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setDeletingClientId(clientId)
    setError(null)
    try {
      await axios.delete(`/registry/clients/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser),
      })
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to delete client')
    } finally {
      setDeletingClientId(null)
    }
  }

  if (loading) {
    return <div style={{ padding: theme.spacing.lg }}>Loading registration page...</div>
  }

  return (
    <div className="crm-page-shell" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      <div className="crm-page-header">
        <div>
          <h2 style={{ margin: 0 }}>Company & Client Registration</h2>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            Register companies and clients for your current workspace.
          </div>
        </div>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            border: `1px solid ${theme.colors.gray.border}`,
            background: '#fff',
            borderRadius: theme.borderRadius.md,
            padding: '8px 12px',
            cursor: 'pointer',
            width: isMobile ? '100%' : 'auto',
          }}
        >
          Back to Dashboard
        </button>
      </div>

      {error && (
        <div
          style={{
            border: '1px solid #ffa39e',
            background: '#fff1f0',
            color: '#cf1322',
            borderRadius: theme.borderRadius.md,
            padding: theme.spacing.md,
          }}
        >
          {error}
        </div>
      )}

      {canCreate && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
            gap: theme.spacing.lg,
          }}
        >
          <form
            onSubmit={handleCreateCompany}
            style={{
              background: '#fff',
              borderRadius: theme.borderRadius.lg,
              boxShadow: theme.shadows.sm,
              padding: theme.spacing.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
              minWidth: 0,
            }}
          >
            <h3 style={{ margin: 0 }}>Register Company</h3>
            <input
              required
              placeholder="Company name"
              value={companyForm.name}
              onChange={event => setCompanyForm(prev => ({ ...prev, name: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <input
              placeholder="Registration number"
              value={companyForm.registration_number}
              onChange={event => setCompanyForm(prev => ({ ...prev, registration_number: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <input
              type="email"
              placeholder="Company email"
              value={companyForm.email}
              onChange={event => setCompanyForm(prev => ({ ...prev, email: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <input
              placeholder="Phone"
              value={companyForm.phone}
              onChange={event => setCompanyForm(prev => ({ ...prev, phone: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <textarea
              placeholder="Address"
              value={companyForm.address}
              onChange={event => setCompanyForm(prev => ({ ...prev, address: event.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '8px', resize: 'vertical' }}
            />
            <button
              type="submit"
              disabled={savingCompany}
              style={{
                border: 'none',
                background: theme.colors.primary,
                color: '#fff',
                borderRadius: theme.borderRadius.md,
                padding: '10px 14px',
                cursor: savingCompany ? 'not-allowed' : 'pointer',
              }}
            >
              {savingCompany ? 'Registering...' : 'Register Company'}
            </button>
          </form>

          <form
            onSubmit={handleCreateClient}
            style={{
              background: '#fff',
              borderRadius: theme.borderRadius.lg,
              boxShadow: theme.shadows.sm,
              padding: theme.spacing.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
              minWidth: 0,
            }}
          >
            <h3 style={{ margin: 0 }}>Register Client</h3>
            <input
              required
              placeholder="First name"
              value={clientForm.first_name}
              onChange={event => setClientForm(prev => ({ ...prev, first_name: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <input
              required
              placeholder="Last name"
              value={clientForm.last_name}
              onChange={event => setClientForm(prev => ({ ...prev, last_name: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <select
              value={clientForm.company_id}
              onChange={event => setClientForm(prev => ({ ...prev, company_id: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            >
              <option value="">No linked company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <select
              value={clientForm.status}
              onChange={event => {
                const nextStatus = event.target.value
                setClientForm(prev => ({
                  ...prev,
                  status: nextStatus,
                  status_company_id:
                    nextStatus === 'changed_from' || nextStatus === 'changed_to'
                      ? prev.status_company_id
                      : '',
                }))
              }}
              style={{ width: '100%', padding: '8px' }}
            >
              {CLIENT_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {requiresStatusCompany && (
              <select
                required
                value={clientForm.status_company_id}
                onChange={event => setClientForm(prev => ({ ...prev, status_company_id: event.target.value }))}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="">{statusCompanyLabel}</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            )}
            <input
              type="email"
              placeholder="Client email"
              value={clientForm.email}
              onChange={event => setClientForm(prev => ({ ...prev, email: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <input
              placeholder="Phone"
              value={clientForm.phone}
              onChange={event => setClientForm(prev => ({ ...prev, phone: event.target.value }))}
              style={{ width: '100%', padding: '8px' }}
            />
            <textarea
              placeholder="Notes"
              value={clientForm.notes}
              onChange={event => setClientForm(prev => ({ ...prev, notes: event.target.value }))}
              rows={3}
              style={{ width: '100%', padding: '8px', resize: 'vertical' }}
            />
            <button
              type="submit"
              disabled={savingClient}
              style={{
                border: 'none',
                background: theme.colors.primaryDark,
                color: '#fff',
                borderRadius: theme.borderRadius.md,
                padding: '10px 14px',
                cursor: savingClient ? 'not-allowed' : 'pointer',
              }}
            >
              {savingClient ? 'Registering...' : 'Register Client'}
            </button>
          </form>
        </div>
      )}

      <div
        style={{
          background: '#fff',
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md,
          minWidth: 0,
        }}
      >
        <div className="crm-page-header">
          <div>
            <h3 style={{ margin: 0 }}>Client Objects ({clientObjects.length})</h3>
            <div style={{ color: theme.colors.gray.text, fontSize: '12px' }}>
              Create custom objects with attributes and assign them to a client or company.
            </div>
          </div>
        </div>

        {canManageObjects && (
          <form
            onSubmit={handleCreateObject}
            style={{
              border: `1px solid ${theme.colors.gray.border}`,
              borderRadius: theme.borderRadius.md,
              padding: theme.spacing.md,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr',
                gap: theme.spacing.sm,
              }}
            >
              <input
                required
                placeholder="Object name"
                value={objectForm.name}
                onChange={event => setObjectForm(prev => ({ ...prev, name: event.target.value }))}
                style={{ width: '100%', padding: '8px' }}
              />
              <select
                value={objectForm.assignment_target}
                onChange={event => {
                  const nextTarget = event.target.value as ObjectAssignmentTarget
                  setObjectForm(prev => ({
                    ...prev,
                    assignment_target: nextTarget,
                    client_id: nextTarget === 'client' ? prev.client_id : '',
                    company_id: nextTarget === 'company' ? prev.company_id : '',
                  }))
                }}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="none">Unassigned</option>
                <option value="client">Assign to client</option>
                <option value="company">Assign to company</option>
              </select>
              {objectForm.assignment_target === 'client' ? (
                <select
                  required
                  value={objectForm.client_id}
                  onChange={event => setObjectForm(prev => ({ ...prev, client_id: event.target.value, company_id: '' }))}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">Choose client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {getClientDisplayName(client)}
                    </option>
                  ))}
                </select>
              ) : objectForm.assignment_target === 'company' ? (
                <select
                  required
                  value={objectForm.company_id}
                  onChange={event => setObjectForm(prev => ({ ...prev, company_id: event.target.value, client_id: '' }))}
                  style={{ width: '100%', padding: '8px' }}
                >
                  <option value="">Choose company</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div
                  style={{
                    border: `1px solid ${theme.colors.gray.border}`,
                    borderRadius: theme.borderRadius.sm,
                    padding: '8px',
                    color: theme.colors.gray.text,
                    fontSize: '13px',
                  }}
                >
                  No assignment
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: theme.spacing.xs,
              }}
            >
              <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>Custom attributes</div>
              {objectForm.attributes.map((attribute, index) => (
                <div
                  key={`attribute-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr auto',
                    gap: theme.spacing.xs,
                  }}
                >
                  <input
                    placeholder="Attribute key"
                    value={attribute.key}
                    onChange={event => handleObjectAttributeChange(index, 'key', event.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  />
                  <input
                    placeholder="Attribute value"
                    value={attribute.value}
                    onChange={event => handleObjectAttributeChange(index, 'value', event.target.value)}
                    style={{ width: '100%', padding: '8px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveObjectAttribute(index)}
                    style={{
                      border: `1px solid ${theme.colors.gray.border}`,
                      background: '#fff',
                      borderRadius: theme.borderRadius.sm,
                      padding: '8px 10px',
                    }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleAddObjectAttribute}
                style={{
                  border: `1px solid ${theme.colors.gray.border}`,
                  background: '#fff',
                  borderRadius: theme.borderRadius.sm,
                  padding: '8px 10px',
                }}
              >
                Add attribute
              </button>
              <button
                type="submit"
                disabled={savingObject}
                style={{
                  border: 'none',
                  background: theme.colors.primary,
                  color: '#fff',
                  borderRadius: theme.borderRadius.sm,
                  padding: '8px 12px',
                  cursor: savingObject ? 'not-allowed' : 'pointer',
                }}
              >
                {savingObject ? 'Saving...' : 'Create object'}
              </button>
            </div>
          </form>
        )}

        {clientObjects.length === 0 ? (
          <div style={{ color: theme.colors.gray.text }}>No objects created yet.</div>
        ) : (
          <div className="crm-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={tableHeader}>Name</th>
                  <th style={tableHeader}>Assignment</th>
                  <th style={tableHeader}>Attributes</th>
                  <th style={tableHeader}>Created</th>
                  {canDelete && <th style={tableHeader}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {clientObjects.map(clientObject => (
                  <tr key={clientObject.id}>
                    <td style={tableCell}>{clientObject.name}</td>
                    <td style={tableCell}>
                      {canManageObjects ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: theme.spacing.xs }}>
                          <select
                            value={getObjectAssignmentTarget(clientObject)}
                            onChange={event => {
                              const nextTarget = event.target.value as ObjectAssignmentTarget
                              if (nextTarget === 'none') {
                                handleAssignObject(clientObject.id, { client_id: null, company_id: null })
                                return
                              }
                              if (nextTarget === 'client') {
                                handleAssignObject(clientObject.id, {
                                  client_id: clientObject.client_id || null,
                                  company_id: null,
                                })
                                return
                              }
                              handleAssignObject(clientObject.id, {
                                client_id: null,
                                company_id: clientObject.company_id || null,
                              })
                            }}
                            disabled={assigningObjectId === clientObject.id}
                            style={{ width: '100%', padding: '6px' }}
                          >
                            <option value="none">Unassigned</option>
                            <option value="client">Client</option>
                            <option value="company">Company</option>
                          </select>

                          {getObjectAssignmentTarget(clientObject) === 'client' ? (
                            <select
                              value={clientObject.client_id || ''}
                              onChange={event =>
                                handleAssignObject(clientObject.id, {
                                  client_id: event.target.value || null,
                                  company_id: null,
                                })
                              }
                              disabled={assigningObjectId === clientObject.id}
                              style={{ width: '100%', padding: '6px' }}
                            >
                              <option value="">Choose client</option>
                              {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                  {getClientDisplayName(client)}
                                </option>
                              ))}
                            </select>
                          ) : getObjectAssignmentTarget(clientObject) === 'company' ? (
                            <select
                              value={clientObject.company_id || ''}
                              onChange={event =>
                                handleAssignObject(clientObject.id, {
                                  client_id: null,
                                  company_id: event.target.value || null,
                                })
                              }
                              disabled={assigningObjectId === clientObject.id}
                              style={{ width: '100%', padding: '6px' }}
                            >
                              <option value="">Choose company</option>
                              {companies.map(company => (
                                <option key={company.id} value={company.id}>
                                  {company.name}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      ) : (
                        clientObject.assignment_name || clientObject.client_name || clientObject.company_name || 'Unassigned'
                      )}
                    </td>
                    <td style={tableCell}>{formatObjectAttributes(clientObject.attributes)}</td>
                    <td style={tableCell}>
                      {clientObject.created_at ? new Date(clientObject.created_at).toLocaleString() : '—'}
                    </td>
                    {canDelete && (
                      <td style={tableCell}>
                        <button
                          onClick={() => handleDeleteObject(clientObject.id)}
                          disabled={deletingObjectId === clientObject.id}
                          style={{
                            border: '1px solid #ffa39e',
                            background: '#fff1f0',
                            color: '#cf1322',
                            borderRadius: theme.borderRadius.sm,
                            padding: '6px 10px',
                            cursor: deletingObjectId === clientObject.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {deletingObjectId === clientObject.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
          gap: theme.spacing.lg,
        }}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.md,
            minWidth: 0,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Companies ({companies.length})</h3>
          {companies.length === 0 ? (
            <div style={{ color: theme.colors.gray.text }}>No companies registered yet.</div>
          ) : (
            <div className="crm-table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeader}>Name</th>
                    <th style={tableHeader}>Registration</th>
                    <th style={tableHeader}>Contact</th>
                    <th style={tableHeader}>Clients</th>
                    {canDelete && <th style={tableHeader}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {companies.map(company => (
                    <tr key={company.id}>
                      <td style={tableCell}>{company.name}</td>
                      <td style={tableCell}>{company.registration_number || '—'}</td>
                      <td style={tableCell}>{company.email || company.phone || '—'}</td>
                      <td style={tableCell}>{company.client_count}</td>
                      {canDelete && (
                        <td style={tableCell}>
                          <button
                            onClick={() => handleDeleteCompany(company.id)}
                            disabled={deletingCompanyId === company.id}
                            style={{
                              border: '1px solid #ffa39e',
                              background: '#fff1f0',
                              color: '#cf1322',
                              borderRadius: theme.borderRadius.sm,
                              padding: '6px 10px',
                              cursor: deletingCompanyId === company.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {deletingCompanyId === company.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.md,
            minWidth: 0,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Clients ({clients.length})</h3>
          {clients.length === 0 ? (
            <div style={{ color: theme.colors.gray.text }}>No clients registered yet.</div>
          ) : (
            <div className="crm-table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={tableHeader}>Name</th>
                    <th style={tableHeader}>Company</th>
                    <th style={tableHeader}>Status</th>
                    <th style={tableHeader}>Contact</th>
                    <th style={tableHeader}>Notes</th>
                    {canDelete && <th style={tableHeader}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {clients.map(client => (
                    <tr key={client.id}>
                      <td style={tableCell}>{client.first_name} {client.last_name}</td>
                      <td style={tableCell}>{client.company_name || '—'}</td>
                      <td style={tableCell}>{formatClientStatus(client)}</td>
                      <td style={tableCell}>{client.email || client.phone || '—'}</td>
                      <td style={tableCell}>{client.notes || '—'}</td>
                      {canDelete && (
                        <td style={tableCell}>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            disabled={deletingClientId === client.id}
                            style={{
                              border: '1px solid #ffa39e',
                              background: '#fff1f0',
                              color: '#cf1322',
                              borderRadius: theme.borderRadius.sm,
                              padding: '6px 10px',
                              cursor: deletingClientId === client.id ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {deletingClientId === client.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const tableHeader: CSSProperties = {
  borderBottom: '1px solid #ddd',
  textAlign: 'left',
  padding: '8px',
  fontSize: '12px',
}

const tableCell: CSSProperties = {
  borderBottom: '1px solid #f0f0f0',
  padding: '8px',
  fontSize: '13px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
}

export default CompanyClientRegistrationPage
