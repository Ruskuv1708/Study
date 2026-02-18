import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import theme from '../../shared/theme'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import type { FormTemplate } from './types'

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

function TemplatesPage() {
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<FormTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const token = localStorage.getItem('crm_token')

  const canManageTemplates = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])
  }, [currentUser])

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

  const fetchTemplates = async (user?: any) => {
    if (!token) return
    try {
      const res = await axios.get('/forms/templates', {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(user || currentUser)
      })
      setTemplates(res.data)
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.detail || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const user = await fetchCurrentUser()
      await fetchTemplates(user)
    })()
  }, [])

  const handleDelete = async (templateId: string) => {
    if (!token) return
    if (!window.confirm('Delete this template?')) return
    try {
      await axios.delete(`/forms/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      fetchTemplates()
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to delete template')
    }
  }

  const handleExport = async (templateId: string, templateName: string) => {
    if (!token) return
    try {
      const res = await axios.get('/forms/records/excel', {
        params: { template_id: templateId },
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` }
      })
      const url = window.URL.createObjectURL(res.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `${templateName || 'template'}_records.xlsx`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to export records')
    }
  }

  if (loading) {
    return <div style={{ padding: theme.spacing.lg }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Form Templates</h2>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            Managers/Admins create templates. Employees fill them.
          </div>
        </div>
        {canManageTemplates && (
          <button
            onClick={() => navigate('/forms/new')}
            style={{
              background: theme.colors.primary,
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer'
            }}
          >
            New Template
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: theme.colors.error, background: '#fff', padding: theme.spacing.md, borderRadius: theme.borderRadius.md }}>
          {error}
        </div>
      )}

      <div style={{
        background: '#fff',
        borderRadius: theme.borderRadius.lg,
        boxShadow: theme.shadows.sm,
        overflow: 'hidden'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 280px',
          padding: theme.spacing.md,
          fontWeight: 700,
          fontSize: '13px',
          borderBottom: `1px solid ${theme.colors.gray.border}`
        }}>
          <div>Name</div>
          <div>Fields</div>
          <div>Type</div>
          <div>Actions</div>
        </div>
        {templates.length === 0 ? (
          <div style={{ padding: theme.spacing.lg, color: theme.colors.gray.text }}>
            No templates yet.
          </div>
        ) : templates.map(template => (
          <div
            key={template.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 280px',
              padding: theme.spacing.md,
              borderBottom: `1px solid ${theme.colors.gray.border}`,
              alignItems: 'center'
            }}
          >
            <div style={{ fontWeight: 600 }}>{template.name}</div>
            <div>{template.schema_structure?.length || 0}</div>
            <div>Template</div>
            <div style={{ display: 'flex', gap: theme.spacing.sm }}>
              <button
                onClick={() => navigate(`/forms/${template.id}/records`)}
                style={{
                  background: theme.colors.gray.light,
                  border: `1px solid ${theme.colors.gray.border}`,
                  padding: '6px 10px',
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer'
                }}
              >
                Records
              </button>
              {canManageTemplates && template.meta_data?.request_settings?.enabled && (
                <button
                  onClick={() => navigate(`/forms/${template.id}/queue`)}
                  style={{
                    background: theme.colors.gray.light,
                    border: `1px solid ${theme.colors.gray.border}`,
                    padding: '6px 10px',
                    borderRadius: theme.borderRadius.sm,
                    cursor: 'pointer'
                  }}
                >
                  Queue
                </button>
              )}
              {canManageTemplates && (
                <button
                  onClick={() => navigate(`/forms/${template.id}/edit`)}
                  style={{
                    background: theme.colors.gray.light,
                    border: `1px solid ${theme.colors.gray.border}`,
                    padding: '6px 10px',
                    borderRadius: theme.borderRadius.sm,
                    cursor: 'pointer'
                  }}
                >
                  Edit
                </button>
              )}
              {canManageTemplates && (
                <button
                  onClick={() => handleExport(template.id, template.name)}
                  style={{
                    background: theme.colors.gray.light,
                    border: `1px solid ${theme.colors.gray.border}`,
                    padding: '6px 10px',
                    borderRadius: theme.borderRadius.sm,
                    cursor: 'pointer'
                  }}
                >
                  Export
                </button>
              )}
              {canManageTemplates && (
                <button
                  onClick={() => handleDelete(template.id)}
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
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default TemplatesPage
