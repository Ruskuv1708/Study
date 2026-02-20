import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import theme from '../shared/theme'
import { normalizeRole, roleMatches } from '../shared/roleLabels'
import { getWorkspaceParams } from '../shared/workspace'
import useIsMobile from '../shared/useIsMobile'

type ReportFile = {
  id: string
  filename: string
  content_type: string
  file_size: number
  created_at?: string | null
  entity_type?: string | null
}

type FolderKey = 'all' | 'requests' | 'users' | 'misc'
type TreeFolderKey = Exclude<FolderKey, 'all'>
type GenerationPeriod = 'all' | 'last_7_days' | 'last_30_days' | 'this_month' | 'custom'

type TreeNode = {
  id: string
  label: string
  type: 'folder' | 'file'
  children?: TreeNode[]
  fileId?: string
  folderKey?: TreeFolderKey
}

const FOLDERS: Array<{ key: FolderKey; label: string }> = [
  { key: 'all', label: 'All Reports' },
  { key: 'requests', label: 'Requests' },
  { key: 'users', label: 'Users' },
  { key: 'misc', label: 'Other' },
]
const TREE_FOLDERS: TreeFolderKey[] = ['requests', 'users', 'misc']
const TREE_FOLDER_LABELS: Record<TreeFolderKey, string> = {
  requests: 'Requests',
  users: 'Users',
  misc: 'Other',
}
const PERIOD_OPTIONS: Array<{ key: GenerationPeriod; label: string }> = [
  { key: 'all', label: 'All time' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'this_month', label: 'This month' },
  { key: 'custom', label: 'Custom range' },
]

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role),
})

const inferFolder = (file: ReportFile): FolderKey => {
  const name = (file.filename || '').toLowerCase()
  if (name.includes('request')) return 'requests'
  if (name.includes('user') || name.includes('employee')) return 'users'
  return 'misc'
}

const formatBytes = (value: number) => {
  if (!value || value < 1024) return `${value || 0} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

const makeTimestamp = () => {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${yyyy}${mm}${dd}_${hh}${min}`
}

const toDateInput = (value: Date) => {
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, '0')
  const dd = String(value.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const sanitizeFilePart = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '_')

const buildFileTree = (items: ReportFile[]): TreeNode[] => {
  const byFolder: Record<TreeFolderKey, ReportFile[]> = {
    requests: [],
    users: [],
    misc: [],
  }
  items.forEach(file => {
    byFolder[inferFolder(file) as TreeFolderKey].push(file)
  })

  return TREE_FOLDERS.map(folder => {
    const filesInFolder = byFolder[folder].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime()
      const bTime = new Date(b.created_at || 0).getTime()
      return bTime - aTime
    })
    const byMonth: Record<string, ReportFile[]> = {}
    filesInFolder.forEach(file => {
      const monthKey = file.created_at ? new Date(file.created_at).toISOString().slice(0, 7) : 'unknown'
      if (!byMonth[monthKey]) byMonth[monthKey] = []
      byMonth[monthKey].push(file)
    })

    const monthNodes: TreeNode[] = Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, monthFiles]) => ({
        id: `month:${folder}:${month}`,
        label: month === 'unknown' ? 'Unknown Date' : month,
        type: 'folder',
        folderKey: folder,
        children: monthFiles.map(file => ({
          id: `file:${file.id}`,
          label: file.filename,
          type: 'file',
          fileId: file.id,
          folderKey: folder,
        })),
      }))

    const folderNode: TreeNode = {
      id: `folder:${folder}`,
      label: `${TREE_FOLDER_LABELS[folder]} (${filesInFolder.length})`,
      type: 'folder',
      folderKey: folder,
      children: monthNodes,
    }
    return folderNode
  }).filter(node => (node.children?.length || 0) > 0)
}

function ReportsPage() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [files, setFiles] = useState<ReportFile[]>([])
  const [selectedFolder, setSelectedFolder] = useState<FolderKey>('all')
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [expandedTreeNodes, setExpandedTreeNodes] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [generatingType, setGeneratingType] = useState<'requests' | 'users' | null>(null)
  const [generationPeriod, setGenerationPeriod] = useState<GenerationPeriod>('last_30_days')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState(toDateInput(new Date()))
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  const readToken = () => localStorage.getItem('crm_token')
  const handleUnauthorized = () => {
    localStorage.removeItem('crm_token')
    window.location.href = '/'
  }

  const canAccessReports = useMemo(() => {
    if (!currentUser) return false
    return roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN'])
  }, [currentUser])

  const fetchCurrentUser = async () => {
    const token = readToken()
    if (!token) {
      setError('Please login to continue')
      setLoading(false)
      return null
    }
    try {
      const res = await axios.get('/access/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const normalized = normalizeUser(res.data)
      setCurrentUser(normalized)
      return normalized
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleUnauthorized()
        return null
      }
      setError('Failed to load user profile')
      setLoading(false)
      return null
    }
  }

  const fetchReportFiles = async (user?: any) => {
    const token = readToken()
    if (!token) return
    try {
      const res = await axios.get('/files', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          entity_type: 'report',
          ...(getWorkspaceParams(user || currentUser) || {}),
        },
      })
      setFiles(Array.isArray(res.data) ? res.data : [])
      if (!selectedFileId && res.data?.length) {
        setSelectedFileId(res.data[0].id)
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleUnauthorized()
        return
      }
      const detail = err?.response?.data?.detail
      setError(detail || 'Failed to load stored reports')
    }
  }

  useEffect(() => {
    ;(async () => {
      const user = await fetchCurrentUser()
      if (!user) return
      if (!roleMatches(user.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN'])) {
        setError('Reports library is available for superadmin/system admin/admin roles.')
        setLoading(false)
        return
      }
      await fetchReportFiles(user)
      setLoading(false)
    })()
  }, [])

  const folderCounts = useMemo(() => {
    const counts: Record<FolderKey, number> = { all: files.length, requests: 0, users: 0, misc: 0 }
    files.forEach(file => {
      counts[inferFolder(file)] += 1
    })
    return counts
  }, [files])

  const filteredFiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    return files
      .filter(file => selectedFolder === 'all' || inferFolder(file) === selectedFolder)
      .filter(file => !query || file.filename.toLowerCase().includes(query))
      .sort((a, b) => {
        const aDate = new Date(a.created_at || 0).getTime()
        const bDate = new Date(b.created_at || 0).getTime()
        return bDate - aDate
      })
  }, [files, search, selectedFolder])

  const treeFiles = useMemo(() => {
    const query = search.trim().toLowerCase()
    return files.filter(file => !query || file.filename.toLowerCase().includes(query))
  }, [files, search])

  const treeNodes = useMemo(() => buildFileTree(treeFiles), [treeFiles])

  const selectedFile = useMemo(
    () => filteredFiles.find(file => file.id === selectedFileId) || null,
    [filteredFiles, selectedFileId],
  )

  useEffect(() => {
    if (!filteredFiles.length) {
      setSelectedFileId(null)
      return
    }
    if (!selectedFileId || !filteredFiles.some(file => file.id === selectedFileId)) {
      setSelectedFileId(filteredFiles[0].id)
    }
  }, [filteredFiles, selectedFileId])

  useEffect(() => {
    if (!treeNodes.length) return
    setExpandedTreeNodes(prev => {
      const next = new Set(prev)
      treeNodes.forEach(node => next.add(node.id))
      return Array.from(next)
    })
  }, [treeNodes])

  const resolvePeriodParams = () => {
    const today = new Date()
    const end = toDateInput(today)

    if (generationPeriod === 'all') {
      return { params: {}, label: 'all_time' }
    }
    if (generationPeriod === 'last_7_days') {
      const start = new Date(today)
      start.setDate(start.getDate() - 6)
      return { params: { date_from: toDateInput(start), date_to: end }, label: 'last_7_days' }
    }
    if (generationPeriod === 'last_30_days') {
      const start = new Date(today)
      start.setDate(start.getDate() - 29)
      return { params: { date_from: toDateInput(start), date_to: end }, label: 'last_30_days' }
    }
    if (generationPeriod === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      return { params: { date_from: toDateInput(start), date_to: end }, label: 'this_month' }
    }
    if (!customFrom || !customTo) {
      return { error: 'Select both start and end dates for custom period' }
    }
    if (customFrom > customTo) {
      return { error: 'Custom start date must be before or equal to end date' }
    }
    return {
      params: { date_from: customFrom, date_to: customTo },
      label: `custom_${customFrom}_to_${customTo}`,
    }
  }

  const uploadReportFile = async (file: File, user?: any) => {
    const token = readToken()
    if (!token) return
    const formData = new FormData()
    formData.append('file', file)
    formData.append('entity_type', 'report')
    await axios.post('/files/upload', formData, {
      headers: { Authorization: `Bearer ${token}` },
      params: getWorkspaceParams(user || currentUser),
    })
  }

  const handleManualUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0) return
    if (!currentUser || !readToken()) return

    setUploading(true)
    setError(null)
    try {
      for (const file of Array.from(selectedFiles)) {
        await uploadReportFile(file, currentUser)
      }
      await fetchReportFiles(currentUser)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleUnauthorized()
        return
      }
      setError(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      if (uploadInputRef.current) {
        uploadInputRef.current.value = ''
      }
    }
  }

  const handleGenerateAndStore = async (type: 'requests' | 'users') => {
    const token = readToken()
    if (!currentUser || !token) return
    const period = resolvePeriodParams()
    if ('error' in period) {
      setError(period.error || 'Invalid period')
      return
    }
    setGeneratingType(type)
    setError(null)
    try {
      const endpoint = type === 'requests' ? '/reports/requests/excel' : '/reports/users/excel'
      const response = await axios.get(endpoint, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
        params: {
          ...(getWorkspaceParams(currentUser) || {}),
          ...period.params,
        },
      })
      const filename = `${type}_report_${sanitizeFilePart(period.label)}_${makeTimestamp()}.xlsx`
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const file = new File([blob], filename, { type: blob.type })
      await uploadReportFile(file, currentUser)
      await fetchReportFiles(currentUser)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleUnauthorized()
        return
      }
      setError(err?.response?.data?.detail || 'Report generation failed')
    } finally {
      setGeneratingType(null)
    }
  }

  const handleDownload = async (file: ReportFile) => {
    const token = readToken()
    if (!token || !currentUser) return
    setDownloadingId(file.id)
    try {
      const response = await axios.get(`/files/download/${file.id}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser),
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = file.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleUnauthorized()
        return
      }
      setError(err?.response?.data?.detail || 'Download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (file: ReportFile) => {
    const token = readToken()
    if (!token || !currentUser) return
    if (!window.confirm(`Delete "${file.filename}"?`)) return
    setDeletingId(file.id)
    try {
      await axios.delete(`/files/${file.id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser),
      })
      await fetchReportFiles(currentUser)
    } catch (err: any) {
      if (err?.response?.status === 401) {
        handleUnauthorized()
        return
      }
      setError(err?.response?.data?.detail || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  const toggleTreeNode = (nodeId: string) => {
    setExpandedTreeNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return Array.from(next)
    })
  }

  const renderTree = (nodes: TreeNode[], depth = 0): ReactNode[] => {
    return nodes.flatMap(node => {
      const isExpanded = expandedTreeNodes.includes(node.id)
      const isFolder = node.type === 'folder'
      const row = (
        <button
          key={node.id}
          onClick={() => {
            if (isFolder) {
              toggleTreeNode(node.id)
              if (node.folderKey) {
                setSelectedFolder(node.folderKey)
              }
              return
            }
            if (node.fileId) {
              setSelectedFileId(node.fileId)
            }
            if (node.folderKey) {
              setSelectedFolder(node.folderKey)
            }
          }}
          style={{
            marginLeft: `${depth * 12}px`,
            width: `calc(100% - ${depth * 12}px)`,
            border: 'none',
            background: node.fileId && selectedFileId === node.fileId ? '#e6f7ff' : 'transparent',
            borderRadius: theme.borderRadius.sm,
            padding: '6px 8px',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {isFolder ? (isExpanded ? '▾' : '▸') : '•'}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.label}
          </span>
        </button>
      )

      if (!isFolder || !node.children || !isExpanded) {
        return [row]
      }
      return [row, ...renderTree(node.children, depth + 1)]
    })
  }

  if (loading) {
    return <div style={{ padding: theme.spacing.lg }}>Loading report library...</div>
  }

  if (!canAccessReports) {
    return (
      <div style={{ padding: theme.spacing.lg }}>
        <h2 style={{ marginTop: 0 }}>Reports</h2>
        <div style={{ color: theme.colors.error }}>
          {error || 'Access denied'}
        </div>
      </div>
    )
  }

  return (
    <div className="crm-page-shell" style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
      <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
        <div>
          <h2 style={{ margin: 0 }}>Reports Library</h2>
          <div style={{ color: theme.colors.gray.text, fontSize: '13px' }}>
            Generate, upload, browse, download, and delete stored report files.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, alignItems: isMobile ? 'stretch' : 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: theme.colors.gray.text }}>Generation period:</span>
            <select
              value={generationPeriod}
              onChange={e => setGenerationPeriod(e.target.value as GenerationPeriod)}
              style={{
                border: `1px solid ${theme.colors.gray.border}`,
                borderRadius: theme.borderRadius.sm,
                padding: '6px 8px',
                minWidth: isMobile ? '100%' : '150px',
              }}
            >
              {PERIOD_OPTIONS.map(option => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
            {generationPeriod === 'custom' && (
              <>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={{
                    border: `1px solid ${theme.colors.gray.border}`,
                    borderRadius: theme.borderRadius.sm,
                    padding: '6px 8px',
                  }}
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={{
                    border: `1px solid ${theme.colors.gray.border}`,
                    borderRadius: theme.borderRadius.sm,
                    padding: '6px 8px',
                  }}
                />
              </>
            )}
          </div>
          <div className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', gap: theme.spacing.sm }}>
            <button
              onClick={() => handleGenerateAndStore('requests')}
              disabled={generatingType !== null}
              style={{
                background: theme.colors.primary,
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: theme.borderRadius.md,
                cursor: generatingType ? 'not-allowed' : 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {generatingType === 'requests' ? 'Generating...' : 'Generate Requests'}
            </button>
            <button
              onClick={() => handleGenerateAndStore('users')}
              disabled={generatingType !== null}
              style={{
                background: '#2f855a',
                color: '#fff',
                border: 'none',
                padding: '8px 12px',
                borderRadius: theme.borderRadius.md,
                cursor: generatingType ? 'not-allowed' : 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {generatingType === 'users' ? 'Generating...' : 'Generate Users'}
            </button>
            <button
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              style={{
                background: theme.colors.gray.light,
                border: `1px solid ${theme.colors.gray.border}`,
                padding: '8px 12px',
                borderRadius: theme.borderRadius.md,
                cursor: uploading ? 'not-allowed' : 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleManualUpload}
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: theme.spacing.md,
          borderRadius: theme.borderRadius.md,
          background: '#fff1f0',
          border: '1px solid #ffa39e',
          color: '#cf1322',
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '220px 1fr 300px',
        gap: theme.spacing.md,
        minHeight: isMobile ? 'auto' : '460px',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
          overflow: 'hidden',
          minHeight: isMobile ? '260px' : 'auto',
        }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text, marginBottom: '6px' }}>
              Folders
            </div>
            {FOLDERS.map(folder => (
              <button
                key={folder.key}
                onClick={() => setSelectedFolder(folder.key)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: theme.borderRadius.sm,
                  border: selectedFolder === folder.key ? `1px solid ${theme.colors.primary}` : '1px solid transparent',
                  background: selectedFolder === folder.key ? '#e6f7ff' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span>{folder.label}</span>
                <span style={{ color: theme.colors.gray.text, fontSize: '12px' }}>
                  {folderCounts[folder.key]}
                </span>
              </button>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${theme.colors.gray.border}`, paddingTop: theme.spacing.sm, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text, marginBottom: '6px' }}>
              File Tree
            </div>
            <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {treeNodes.length === 0 ? (
                <div style={{ color: theme.colors.gray.text, fontSize: '12px' }}>No tree nodes</div>
              ) : (
                renderTree(treeNodes)
              )}
            </div>
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: isMobile ? '300px' : 'auto',
        }}>
          <div style={{ padding: theme.spacing.md, borderBottom: `1px solid ${theme.colors.gray.border}` }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: theme.borderRadius.sm,
                border: `1px solid ${theme.colors.gray.border}`,
              }}
            />
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 120px 180px',
            padding: theme.spacing.md,
            borderBottom: `1px solid ${theme.colors.gray.border}`,
            fontSize: '12px',
            fontWeight: 700,
            color: theme.colors.gray.text,
          }}>
            <div>Name</div>
            {!isMobile && <div>Size</div>}
            {!isMobile && <div>Stored</div>}
          </div>

          <div style={{ overflow: 'auto' }}>
            {filteredFiles.length === 0 ? (
              <div style={{ padding: theme.spacing.lg, color: theme.colors.gray.text }}>
                No files found in this folder.
              </div>
            ) : filteredFiles.map(file => (
              <button
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
                style={{
                  width: '100%',
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 120px 180px',
                  padding: theme.spacing.md,
                  border: 'none',
                  borderBottom: `1px solid ${theme.colors.gray.border}`,
                  background: file.id === selectedFileId ? '#f0fbff' : '#fff',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {file.filename}
                  {isMobile && (
                    <div style={{ color: theme.colors.gray.text, fontSize: '12px', marginTop: '4px' }}>
                      {formatBytes(file.file_size)} • {file.created_at ? new Date(file.created_at).toLocaleString() : '—'}
                    </div>
                  )}
                </div>
                {!isMobile && <div style={{ color: theme.colors.gray.text }}>{formatBytes(file.file_size)}</div>}
                {!isMobile && (
                  <div style={{ color: theme.colors.gray.text }}>
                    {file.created_at ? new Date(file.created_at).toLocaleString() : '—'}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.sm,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md,
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: theme.colors.gray.text }}>
            File Details
          </div>
          {!selectedFile ? (
            <div style={{ color: theme.colors.gray.text }}>Select a file to see details.</div>
          ) : (
            <>
              <div>
                <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>Name</div>
                <div style={{ fontWeight: 600 }}>{selectedFile.filename}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>Content Type</div>
                <div>{selectedFile.content_type || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>Size</div>
                <div>{formatBytes(selectedFile.file_size)}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: theme.colors.gray.text }}>Stored At</div>
                <div>{selectedFile.created_at ? new Date(selectedFile.created_at).toLocaleString() : '—'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginTop: 'auto' }}>
                <button
                  onClick={() => handleDownload(selectedFile)}
                  disabled={downloadingId === selectedFile.id}
                  style={{
                    background: theme.colors.primary,
                    color: '#fff',
                    border: 'none',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    cursor: downloadingId ? 'not-allowed' : 'pointer',
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  {downloadingId === selectedFile.id ? 'Downloading...' : 'Download'}
                </button>
                <button
                  onClick={() => handleDelete(selectedFile)}
                  disabled={deletingId === selectedFile.id}
                  style={{
                    background: '#fff1f0',
                    color: '#cf1322',
                    border: '1px solid #ffa39e',
                    padding: '8px 10px',
                    borderRadius: theme.borderRadius.sm,
                    cursor: deletingId ? 'not-allowed' : 'pointer',
                    width: isMobile ? '100%' : 'auto',
                  }}
                >
                  {deletingId === selectedFile.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReportsPage
