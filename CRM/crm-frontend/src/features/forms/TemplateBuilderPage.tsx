import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate, useParams } from 'react-router-dom'
import theme from '../../shared/theme'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import type { FormField, FormTemplate } from './types'
import useIsMobile from '../../shared/useIsMobile'
import { isClientField, isCompanyField, isPriorityField, isStatusField } from '../../shared/useRegistryAutocomplete'

interface Department {
  id: string
  name: string
}

const MAX_COLUMNS = 20
const VISIBLE_ROWS = 20
const COLUMN_LETTERS = Array.from({ length: MAX_COLUMNS }, (_, i) => String.fromCharCode(65 + i))

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

const emptyField = (): FormField => ({
  key: '',
  label: '',
  type: 'text',
  required: false
})

const makeKeyFromLabel = (label: string) => {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const findDepartmentColumn = (columns: FormField[]) => {
  return columns.find(field => {
    const key = (field.key || '').toLowerCase()
    const label = (field.label || '').toLowerCase()
    return field.type === 'department_select' || key === 'department_id' || label === 'department'
  })
}

function TemplateBuilderPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [templateName, setTemplateName] = useState('')
  const [columns, setColumns] = useState<FormField[]>(Array.from({ length: 6 }, () => emptyField()))
  const [columnCount, setColumnCount] = useState(6)
  const [selectedColumn, setSelectedColumn] = useState(0)
  const [departments, setDepartments] = useState<Department[]>([])
  const [requestDepartmentId, setRequestDepartmentId] = useState('')
  const [requestPriority, setRequestPriority] = useState('medium')
  const [requestTitleTemplate, setRequestTitleTemplate] = useState('')
  const [requestDescriptionTemplate, setRequestDescriptionTemplate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMobile = useIsMobile()

  const token = localStorage.getItem('crm_token')
  const isEdit = Boolean(id)

  const canManageTemplates = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])
  }, [currentUser])

  const selectedField = useMemo(() => columns[selectedColumn] || emptyField(), [columns, selectedColumn])
  const hasStatusColumn = useMemo(() => columns.some(field => isStatusField(field)), [columns])
  const hasPriorityColumn = useMemo(() => columns.some(field => isPriorityField(field)), [columns])
  const hasCompanyColumn = useMemo(() => columns.some(field => isCompanyField(field)), [columns])
  const hasClientColumn = useMemo(() => columns.some(field => isClientField(field)), [columns])
  const departmentColumn = useMemo(() => findDepartmentColumn(columns), [columns])
  const hasDepartmentColumn = Boolean(departmentColumn)

  useEffect(() => {
    if (selectedColumn >= columnCount) {
      setSelectedColumn(Math.max(0, columnCount - 1))
    }
  }, [columnCount, selectedColumn])

  useEffect(() => {
    setColumns(prev => {
      const next = [...prev]
      while (next.length < columnCount) {
        next.push(emptyField())
      }
      return next.slice(0, columnCount)
    })
  }, [columnCount])

  const fetchCurrentUser = async () => {
    if (!token) return navigate('/')
    const res = await axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    const normalized = normalizeUser(res.data)
    setCurrentUser(normalized)
    if (!roleMatches(res.data.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])) {
      navigate('/forms')
    }
    return normalized
  }

  const fetchDepartments = async (user?: any) => {
    if (!token) return
    const res = await axios.get('/workflow/departments', {
      headers: { Authorization: `Bearer ${token}` },
      params: getWorkspaceParams(user || currentUser)
    })
    setDepartments(res.data || [])
    if (!requestDepartmentId && res.data?.length) {
      setRequestDepartmentId(res.data[0].id)
    }
  }

  const fetchTemplate = async (user?: any) => {
    if (!token || !id) return
    const res = await axios.get(`/forms/templates/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      params: getWorkspaceParams(user || currentUser)
    })
    const template: FormTemplate = res.data
    setTemplateName(template.name || '')
    const fields = template.schema_structure?.length ? template.schema_structure : [emptyField()]
    setColumnCount(fields.length)
    setColumns(fields)
    const settings = template.meta_data?.request_settings
    setRequestDepartmentId(settings?.department_id || '')
    setRequestPriority(settings?.priority || 'medium')
    setRequestTitleTemplate(settings?.title_template || '')
    setRequestDescriptionTemplate(settings?.description_template || '')
  }

  useEffect(() => {
    const run = async () => {
      try {
        const user = await fetchCurrentUser()
        await fetchDepartments(user)
        if (isEdit) {
          await fetchTemplate(user)
        }
      } catch (err: any) {
        console.error(err)
        setError(err?.response?.data?.detail || 'Failed to load template builder')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [id])

  const handleColumnSelect = (index: number) => {
    setColumnCount(index + 1)
    setSelectedColumn(index)
  }

  const updateColumn = (index: number, patch: Partial<FormField>) => {
    setColumns(prev => prev.map((field, i) => i === index ? { ...field, ...patch } : field))
  }

  const updateLabel = (index: number, label: string) => {
    setColumns(prev => prev.map((field, i) => {
      if (i !== index) return field
      const nextKey = field.key || makeKeyFromLabel(label)
      return { ...field, label, key: nextKey }
    }))
  }

  const ensureColumn = (
    key: string,
    label: string,
    options?: { type?: string; required?: boolean }
  ) => {
    const existingIndex = columns.findIndex(field => (field.key || '').toLowerCase() === key.toLowerCase())
    if (existingIndex >= 0) {
      setColumns(prev => prev.map((field, i) => {
        if (i !== existingIndex) return field
        return {
          ...field,
          label,
          type: options?.type || field.type,
          required: typeof options?.required === 'boolean' ? options.required : field.required,
        }
      }))
      return
    }
    if (columns.length >= MAX_COLUMNS) {
      alert(`Maximum ${MAX_COLUMNS} columns reached`)
      return
    }
    const next = [...columns, {
      key,
      label,
      type: options?.type || 'text',
      required: options?.required ?? false,
    }]
    setColumns(next)
    setColumnCount(next.length)
    setSelectedColumn(next.length - 1)
  }

  const removeColumnByKey = (key: string) => {
    const lower = key.toLowerCase()
    let idx = columns.findIndex(field => {
      const fieldKey = (field.key || '').toLowerCase()
      const fieldLabel = (field.label || '').toLowerCase()
      return fieldKey === lower || fieldLabel === lower
    })
    if (idx === -1 && lower === 'company') {
      idx = columns.findIndex(field => isCompanyField(field))
    }
    if (idx === -1 && lower === 'client') {
      idx = columns.findIndex(field => isClientField(field))
    }
    if (idx === -1 && lower === 'status') {
      idx = columns.findIndex(field => isStatusField(field))
    }
    if (idx === -1 && lower === 'priority') {
      idx = columns.findIndex(field => isPriorityField(field))
    }
    if (idx === -1) return
    if (!window.confirm(`Remove ${key} column?`)) return
    const next = columns.filter((_, index) => index !== idx)
    if (next.length === 0) {
      setColumns([emptyField()])
      setColumnCount(1)
      setSelectedColumn(0)
      return
    }
    setColumns(next)
    setColumnCount(next.length)
    setSelectedColumn(Math.min(selectedColumn, next.length - 1))
  }

  const handleSave = async () => {
    if (!token) return
    if (!templateName.trim()) {
      alert('Template name is required')
      return
    }
    const structure = columns
      .map(field => ({ ...field, key: field.key.trim(), label: field.label.trim() }))
      .filter(field => field.key && field.label)
    if (structure.length === 0) {
      alert('Define at least one column label')
      return
    }
    const departmentField = structure.find(field =>
      field.type === 'department_select' || field.key.toLowerCase() === 'department_id'
    )
    if (!departmentField && !requestDepartmentId) {
      alert('Select a default department or add Department column')
      return
    }
    const request_settings = {
      enabled: true,
      department_id: requestDepartmentId || null,
      department_field_key: departmentField ? departmentField.key : null,
      priority: requestPriority,
      title_template: requestTitleTemplate.trim() || null,
      description_template: requestDescriptionTemplate.trim() || null
    }
    setSaving(true)
    try {
      if (isEdit && id) {
        await axios.put(`/forms/templates/${id}`, { name: templateName.trim(), structure, request_settings }, {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser)
        })
      } else {
        await axios.post('/forms/template', { name: templateName.trim(), structure, request_settings }, {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser)
        })
      }
      navigate('/forms')
    } catch (err: any) {
      console.error(err)
      alert(err?.response?.data?.detail || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div style={{ padding: theme.spacing.lg }}>Loading...</div>
  }

  if (error) {
    return (
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ color: theme.colors.error }}>{error}</div>
      </div>
    )
  }

  return (
    <div className="crm-page-shell" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>{isEdit ? 'Edit Template' : 'Create Template'}</h2>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            Select the column area and define headers like a spreadsheet.
          </div>
        </div>
        <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', gap: theme.spacing.sm }}>
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
          <button
            onClick={handleSave}
            disabled={saving || !canManageTemplates}
            style={{
              background: saving ? theme.colors.gray.disabled : theme.colors.primary,
              color: '#fff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: theme.borderRadius.md,
              cursor: saving ? 'not-allowed' : 'pointer',
              width: isMobile ? '100%' : 'auto'
            }}
          >
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', padding: theme.spacing.lg, borderRadius: theme.borderRadius.lg, boxShadow: theme.shadows.sm }}>
        <label style={{ fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text }}>Template Name</label>
        <input
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          placeholder="e.g. Purchase Request"
          style={{
            marginTop: theme.spacing.xs,
            width: '100%',
            padding: '10px 12px',
            borderRadius: theme.borderRadius.md,
            border: `1px solid ${theme.colors.gray.border}`
          }}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(280px, 320px)', gap: theme.spacing.lg }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text }}>
            Select Columns
          </div>
          <div className="crm-inline-grid-scroll">
          <div style={{
            display: 'grid',
            gridTemplateColumns: `60px repeat(${MAX_COLUMNS}, minmax(34px, 1fr))`,
            border: `1px solid ${theme.colors.gray.border}`,
            borderRadius: theme.borderRadius.md,
            overflow: 'hidden',
            width: 'max-content',
            minWidth: '100%',
          }}>
            <div style={{ background: theme.colors.gray.light, borderRight: `1px solid ${theme.colors.gray.border}` }} />
            {COLUMN_LETTERS.map((letter, index) => {
              const active = index < columnCount
              const selected = index === selectedColumn
              return (
                <button
                  key={letter}
                  type="button"
                  onClick={() => handleColumnSelect(index)}
                  style={{
                    background: selected ? theme.colors.primary : active ? '#e6f7ff' : theme.colors.gray.light,
                    color: selected ? '#fff' : '#333',
                    border: 'none',
                    borderRight: index === MAX_COLUMNS - 1 ? 'none' : `1px solid ${theme.colors.gray.border}`,
                    padding: '6px 0',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {letter}
                </button>
              )
            })}
          </div>
          </div>

          <div className="crm-inline-grid-scroll" style={{
            border: `1px solid ${theme.colors.gray.border}`,
            borderRadius: theme.borderRadius.lg,
            overflow: 'auto',
            background: '#fff',
            minWidth: 0,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `60px repeat(${columnCount}, minmax(160px, 1fr))`,
              borderBottom: `1px solid ${theme.colors.gray.border}`,
              background: theme.colors.gray.light,
              fontSize: '12px',
              fontWeight: 700,
              width: 'max-content',
              minWidth: '100%',
            }}>
              <div style={{ padding: '8px', borderRight: `1px solid ${theme.colors.gray.border}` }} />
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <div
                  key={`header-${colIndex}`}
                  style={{
                    padding: '8px',
                    borderRight: colIndex === columnCount - 1 ? 'none' : `1px solid ${theme.colors.gray.border}`,
                    background: colIndex === selectedColumn ? '#e6f7ff' : theme.colors.gray.light
                  }}
                >
                  {COLUMN_LETTERS[colIndex]}
                </div>
              ))}
            </div>
            {Array.from({ length: VISIBLE_ROWS }).map((_, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `60px repeat(${columnCount}, minmax(160px, 1fr))`,
                  borderBottom: rowIndex === VISIBLE_ROWS - 1 ? 'none' : `1px solid ${theme.colors.gray.border}`,
                  width: 'max-content',
                  minWidth: '100%',
                }}
              >
                <div style={{
                  padding: '8px',
                  borderRight: `1px solid ${theme.colors.gray.border}`,
                  background: theme.colors.gray.light,
                  fontSize: '12px',
                  color: theme.colors.gray.text
                }}>
                  {rowIndex + 1}
                </div>
                {Array.from({ length: columnCount }).map((__, colIndex) => {
                  const isSelected = colIndex === selectedColumn
                  const isHeaderRow = rowIndex === 0
                  return (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      style={{
                        padding: '4px',
                        borderRight: colIndex === columnCount - 1 ? 'none' : `1px solid ${theme.colors.gray.border}`,
                        background: isSelected ? '#f0fbff' : '#fff'
                      }}
                    >
                      {isHeaderRow ? (
                        <input
                          value={columns[colIndex]?.label || ''}
                          onChange={e => updateLabel(colIndex, e.target.value)}
                          onFocus={() => setSelectedColumn(colIndex)}
                          placeholder="Column label"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: theme.borderRadius.sm,
                            border: `1px solid ${theme.colors.gray.border}`,
                            background: '#fff'
                          }}
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>
            20 rows are shown for preview. Employees can add unlimited rows when filling.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, minWidth: 0 }}>
          <div style={{
            background: '#fff',
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.lg
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: theme.spacing.sm }}>
              Column Settings ({COLUMN_LETTERS[selectedColumn]})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, marginBottom: theme.spacing.sm }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={hasStatusColumn}
                  onChange={e => {
                    if (e.target.checked) {
                      ensureColumn('status', 'Status', { type: 'status_select' })
                    } else {
                      removeColumnByKey('status')
                    }
                  }}
                />
                Include Status column
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={hasPriorityColumn}
                  onChange={e => {
                    if (e.target.checked) {
                      ensureColumn('priority', 'Priority', { type: 'priority_select' })
                    } else {
                      removeColumnByKey('priority')
                    }
                  }}
                />
                Include Priority column
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={hasDepartmentColumn}
                  onChange={e => {
                    if (e.target.checked) {
                      ensureColumn('department_id', 'Department', { type: 'department_select', required: true })
                    } else {
                      removeColumnByKey('department_id')
                    }
                  }}
                />
                Include Department column
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={hasCompanyColumn}
                  onChange={e => {
                    if (e.target.checked) {
                      ensureColumn('company', 'Company', { type: 'company_select' })
                    } else {
                      removeColumnByKey('company')
                    }
                  }}
                />
                Include Company column
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={hasClientColumn}
                  onChange={e => {
                    if (e.target.checked) {
                      ensureColumn('client', 'Client', { type: 'client_select' })
                    } else {
                      removeColumnByKey('client')
                    }
                  }}
                />
                Include Client column
              </label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Label</label>
                <input
                  value={selectedField.label}
                  onChange={e => updateLabel(selectedColumn, e.target.value)}
                  placeholder="Column label"
                  style={{
                    marginTop: theme.spacing.xs,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.gray.border}`
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Key</label>
                <input
                  value={selectedField.key}
                  onChange={e => updateColumn(selectedColumn, { key: e.target.value })}
                  placeholder="column_key"
                  style={{
                    marginTop: theme.spacing.xs,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.gray.border}`
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Type</label>
                <select
                  value={selectedField.type}
                  onChange={e => updateColumn(selectedColumn, { type: e.target.value })}
                  style={{
                    marginTop: theme.spacing.xs,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.gray.border}`
                  }}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes/No</option>
                  <option value="date">Date</option>
                  <option value="department_select">Department Select</option>
                  <option value="status_select">Status Select</option>
                  <option value="priority_select">Priority Select</option>
                  <option value="company_select">Company Select</option>
                  <option value="client_select">Client Select</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={selectedField.required || false}
                  onChange={e => updateColumn(selectedColumn, { required: e.target.checked })}
                />
                Required
              </label>
            </div>
          </div>

          <div style={{
            background: '#fff',
            borderRadius: theme.borderRadius.lg,
            boxShadow: theme.shadows.sm,
            padding: theme.spacing.lg
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: theme.spacing.sm }}>
              Request Settings
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Default Department</label>
                <select
                  value={requestDepartmentId}
                  onChange={e => setRequestDepartmentId(e.target.value)}
                  style={{
                    marginTop: theme.spacing.xs,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.gray.border}`
                  }}
                >
                  {departments.map(dep => (
                    <option key={dep.id} value={dep.id}>{dep.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Priority</label>
                <select
                  value={requestPriority}
                  onChange={e => setRequestPriority(e.target.value)}
                  style={{
                    marginTop: theme.spacing.xs,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.gray.border}`
                  }}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Request Title Template</label>
                <input
                  value={requestTitleTemplate}
                  onChange={e => setRequestTitleTemplate(e.target.value)}
                  placeholder="Use {field_key} placeholders"
                  style={{
                    marginTop: theme.spacing.xs,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.gray.border}`
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 600 }}>Request Description Template</label>
                <input
                  value={requestDescriptionTemplate}
                  onChange={e => setRequestDescriptionTemplate(e.target.value)}
                  placeholder="Optional description template"
                  style={{
                    marginTop: theme.spacing.xs,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    border: `1px solid ${theme.colors.gray.border}`
                  }}
                />
              </div>
              <div style={{ fontSize: '11px', color: theme.colors.gray.text }}>
                Placeholders like {`{amount}`} or {`{client_name}`} will be replaced with row values.
                If Department column is included, its selected value is used for routing.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TemplateBuilderPage
