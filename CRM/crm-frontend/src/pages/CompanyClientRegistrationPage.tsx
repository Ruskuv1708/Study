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
  created_at?: string | null
}

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role),
})

function CompanyClientRegistrationPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [currentUser, setCurrentUser] = useState<any>(null)
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [clients, setClients] = useState<ClientItem[]>([])

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
  })

  const [loading, setLoading] = useState(true)
  const [savingCompany, setSavingCompany] = useState(false)
  const [savingClient, setSavingClient] = useState(false)
  const [deletingCompanyId, setDeletingCompanyId] = useState<string | null>(null)
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canCreate = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])
  }, [currentUser])

  const canDelete = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN'])
  }, [currentUser])

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
    const [companyRes, clientRes] = await Promise.all([
      axios.get('/registry/companies', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
      axios.get('/registry/clients', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      }),
    ])
    setCompanies(Array.isArray(companyRes.data) ? companyRes.data : [])
    setClients(Array.isArray(clientRes.data) ? clientRes.data : [])
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
      })
      await fetchRegistryData(currentUser)
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to register client')
    } finally {
      setSavingClient(false)
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
