import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import theme from '../../shared/theme'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import type { FormTemplate, FormRecord } from './types'
import useIsMobile from '../../shared/useIsMobile'
import { isDepartmentField } from '../../shared/useRegistryAutocomplete'

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

interface Department {
  id: string
  name: string
}

const normalizeId = (value?: string | null): string | null => value ? value.toLowerCase() : null
const areIdsEqual = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false
  return normalizeId(a) === normalizeId(b)
}

function FormRecordsPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [records, setRecords] = useState<FormRecord[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const isMobile = useIsMobile()

  const token = localStorage.getItem('crm_token')

  const canExport = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])
  }, [currentUser])

  const canDelete = canExport

  const fetchCurrentUser = async () => {
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
      return normalized
    } catch (err) {
      console.error(err)
      navigate('/')
    }
  }

  const fetchTemplate = async (user?: any) => {
    if (!token || !id) return
    const res = await axios.get(`/forms/templates/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: getWorkspaceParams(user || currentUser)
    })
    setTemplate(res.data)
  }

  const fetchRecords = async (user?: any) => {
    if (!token || !id) return
    const res = await axios.get('/forms/records', {
      headers: { Authorization: `Bearer ${token}` },
      params: { template_id: id, ...(getWorkspaceParams(user || currentUser) || {}) }
    })
    setRecords(res.data)
  }

  const fetchDepartments = async (user?: any) => {
    if (!token) return
    const res = await axios.get('/workflow/departments', {
      headers: { Authorization: `Bearer ${token}` },
      params: getWorkspaceParams(user || currentUser)
    })
    setDepartments(res.data || [])
  }

  const handleDelete = async (recordId: string) => {
    if (!token) return
    if (!window.confirm('Delete this submission? This will also delete its request.')) return
    try {
      await axios.delete(`/forms/records/${recordId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser)
      })
      fetchRecords()
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to delete submission')
    }
  }

  const handleExport = async () => {
    if (!token || !id || !template) return
    try {
      const res = await axios.get('/forms/records/excel', {
        params: { template_id: id, ...(getWorkspaceParams(currentUser) || {}) },
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      })
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${template.name || 'template'}_records.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to export records')
    }
  }

  useEffect(() => {
    const run = async () => {
      try {
        const user = await fetchCurrentUser()
        await fetchTemplate(user)
        await fetchDepartments(user)
        await fetchRecords(user)
      } catch (err: any) {
        console.error(err)
        setError(err?.response?.data?.detail || 'Failed to load records')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [id])

  const columns = useMemo(() => {
    if (!template) return []
    return template.schema_structure || []
  }, [template])

  const getDepartmentName = (departmentId?: string | null) => {
    if (!departmentId) return ''
    const match = departments.find(dep => areIdsEqual(dep.id, departmentId))
    return match?.name || departmentId
  }

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
          <h2 style={{ margin: 0 }}>{template.name} - Records</h2>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            {canExport ? 'All submissions for this template.' : 'Your submissions for this template.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          {canExport && (
            <button
              onClick={handleExport}
              style={{
                background: theme.colors.gray.light,
                border: `1px solid ${theme.colors.gray.border}`,
                padding: '8px 14px',
                borderRadius: theme.borderRadius.md,
                cursor: 'pointer',
                width: isMobile ? '100%' : 'auto'
              }}
            >
              Export
            </button>
          )}
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

      <div className="crm-inline-grid-scroll" style={{
        background: '#fff',
        borderRadius: theme.borderRadius.lg,
        boxShadow: theme.shadows.sm,
        overflow: 'auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `160px repeat(${columns.length}, minmax(140px, 1fr)) ${canDelete ? '120px' : ''}`,
          padding: theme.spacing.md,
          fontWeight: 700,
          fontSize: '13px',
          borderBottom: `1px solid ${theme.colors.gray.border}`
        }}>
          <div>Submitted</div>
          {columns.map(col => (
            <div key={col.key}>{col.label}</div>
          ))}
          {canDelete && <div>Actions</div>}
        </div>
        {records.length === 0 ? (
          <div style={{ padding: theme.spacing.lg, color: theme.colors.gray.text }}>
            No submissions yet.
          </div>
        ) : records.map(record => (
          <div
            key={record.id}
            style={{
              display: 'grid',
              gridTemplateColumns: `160px repeat(${columns.length}, minmax(140px, 1fr)) ${canDelete ? '120px' : ''}`,
              padding: theme.spacing.md,
              borderBottom: `1px solid ${theme.colors.gray.border}`,
              alignItems: 'center'
            }}
          >
            <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>
              {record.created_at ? new Date(record.created_at).toLocaleString() : '—'}
            </div>
            {columns.map(col => (
              <div key={`${record.id}-${col.key}`} style={{ fontSize: '13px' }}>
                {isDepartmentField(col)
                  ? getDepartmentName(String(record.entry_data?.[col.key] ?? ''))
                  : String(record.entry_data?.[col.key] ?? '')}
              </div>
            ))}
            {canDelete && (
              <div>
                <button
                  onClick={() => handleDelete(record.id)}
                  style={{
                    background: '#ffecec',
                    border: '1px solid #ffb3b3',
                    color: theme.colors.error,
                    padding: '6px 10px',
                    borderRadius: theme.borderRadius.sm,
                    cursor: 'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default FormRecordsPage
