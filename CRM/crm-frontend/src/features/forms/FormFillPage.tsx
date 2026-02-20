import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import theme from '../../shared/theme'
import type { FormTemplate, FormField } from './types'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import useIsMobile from '../../shared/useIsMobile'

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

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

function FormFillPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [template, setTemplate] = useState<FormTemplate | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [rows, setRows] = useState<Array<Record<string, any>>>([])
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const token = localStorage.getItem('crm_token')

  const fields = useMemo<FormField[]>(() => template?.schema_structure || [], [template])

  const fetchCurrentUser = async () => {
    if (!token) return navigate('/')
    const res = await axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const normalized = normalizeUser(res.data)
    setCurrentUser(normalized)
    if (!roleMatches(normalized.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])) {
      navigate('/requests')
    }
    return normalized
  }

  const fetchTemplate = async (user?: any) => {
    if (!token) return navigate('/')
    if (!id) return
    try {
      const res = await axios.get(`/forms/templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(user || currentUser)
      })
      setTemplate(res.data)
      const initialRow = makeEmptyRow(res.data.schema_structure || [])
      setRows([initialRow])
    } catch (err: any) {
      console.error(err)
      setError(err?.response?.data?.detail || 'Failed to load template')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const user = await fetchCurrentUser()
      await fetchTemplate(user)
    })()
  }, [id])

  const updateValue = (rowIndex: number, key: string, value: any) => {
    setRows(prev => prev.map((row, index) => index === rowIndex ? { ...row, [key]: value } : row))
  }

  const buildPayload = (row: Record<string, any>) => {
    const data: Record<string, any> = {}
    fields.forEach(field => {
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
    for (const field of fields) {
      if (!field.required) continue
      const value = row[field.key]
      if (value === '' || value === null || typeof value === 'undefined') {
        return `${field.label} is required`
      }
    }
    return null
  }

  const addRow = () => {
    setRows(prev => [...prev, makeEmptyRow(fields)])
  }

  const removeRow = (rowIndex: number) => {
    setRows(prev => prev.filter((_, index) => index !== rowIndex))
    setRowErrors({})
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !id) return
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
          template_id: id,
          data: payload
        }, {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser)
        })
      }
      alert('Forms submitted')
      navigate(`/forms/${id}/queue`)
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to submit form')
    } finally {
      setSubmitting(false)
    }
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
    <div className="crm-page-shell">
      <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
        <div>
          <h2 style={{ margin: 0 }}>{template.name}</h2>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            Fill rows like a spreadsheet. Each row creates a request.
          </div>
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.sm }}>
          <button
            onClick={() => navigate(`/forms/${id}/queue`)}
            style={{
              background: theme.colors.gray.light,
              border: `1px solid ${theme.colors.gray.border}`,
              padding: '8px 14px',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            Queue
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

      <form
        onSubmit={handleSubmit}
        style={{
          background: '#fff',
          padding: theme.spacing.lg,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md
        }}
      >
        <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>
            Required fields are marked with *
          </div>
          <button
            type="button"
            onClick={addRow}
            style={{
              background: theme.colors.gray.light,
              border: `1px solid ${theme.colors.gray.border}`,
              padding: '8px 12px',
              borderRadius: theme.borderRadius.md,
              cursor: 'pointer',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            + Add Row
          </button>
        </div>

        <div className="crm-inline-grid-scroll" style={{
          border: `1px solid ${theme.colors.gray.border}`,
          borderRadius: theme.borderRadius.lg,
          overflow: 'auto'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `60px repeat(${fields.length}, minmax(160px, 1fr)) 90px`,
            padding: theme.spacing.sm,
            fontWeight: 700,
            fontSize: '12px',
            color: theme.colors.gray.text,
            background: theme.colors.gray.light,
            borderBottom: `1px solid ${theme.colors.gray.border}`
          }}>
            <div>#</div>
            {fields.map(field => (
              <div key={field.key}>
                {field.label}{field.required ? ' *' : ''}
              </div>
            ))}
            <div>Action</div>
          </div>
          {rows.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              style={{
                display: 'grid',
                gridTemplateColumns: `60px repeat(${fields.length}, minmax(160px, 1fr)) 90px`,
                padding: theme.spacing.sm,
                borderBottom: rowIndex === rows.length - 1 ? 'none' : `1px solid ${theme.colors.gray.border}`,
                background: rowErrors[rowIndex] ? '#fff6e6' : '#fff',
                alignItems: 'center'
              }}
            >
              <div style={{ color: theme.colors.gray.text, fontSize: '12px' }}>{rowIndex + 1}</div>
              {fields.map(field => (
                <div key={`${rowIndex}-${field.key}`} style={{ paddingRight: theme.spacing.sm }}>
                  {field.type === 'boolean' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(row[field.key])}
                        onChange={e => updateValue(rowIndex, field.key, e.target.checked)}
                      />
                      <span style={{ fontSize: '12px', color: theme.colors.gray.text }}>Yes / No</span>
                    </label>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={row[field.key] ?? ''}
                      onChange={e => updateValue(rowIndex, field.key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: theme.borderRadius.sm,
                        border: `1px solid ${theme.colors.gray.border}`
                      }}
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
                    background: 'transparent',
                    border: '1px solid #ddd',
                    padding: '6px 8px',
                    borderRadius: theme.borderRadius.sm,
                    cursor: rows.length === 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {Object.keys(rowErrors).length > 0 && (
          <div style={{ color: theme.colors.error, fontSize: '12px' }}>
            {Object.entries(rowErrors).map(([index, message]) => (
              <div key={index}>Row {Number(index) + 1}: {message}</div>
            ))}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: submitting ? theme.colors.gray.disabled : theme.colors.primary,
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: theme.borderRadius.md,
            cursor: submitting ? 'not-allowed' : 'pointer',
            width: isMobile ? '100%' : 'auto'
          }}
        >
          {submitting ? 'Submitting...' : 'Submit Rows'}
        </button>
      </form>
    </div>
  )
}

export default FormFillPage
