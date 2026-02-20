import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { type Department } from './types'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'
import useIsMobile from '../../shared/useIsMobile'

type DepartmentUser = {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
  department_id?: string | null
  rank_id?: string | null
}

type DepartmentRank = {
  id: string
  name: string
  order: number
}

const ROLE_ORDER = ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER']

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role),
})

const normalizeId = (value?: string | null): string | null => (value ? value.toLowerCase() : null)
const areIdsEqual = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false
  return normalizeId(a) === normalizeId(b)
}

const sortRanks = (items: DepartmentRank[]) => {
  return [...items].sort((a, b) => {
    const orderDiff = Number(a.order || 0) - Number(b.order || 0)
    if (orderDiff !== 0) return orderDiff
    return (a.name || '').localeCompare(b.name || '')
  })
}

const resolveVisibleDepartments = (allDepartments: Department[], user: any): Department[] => {
  if (!user) return []
  if (roleMatches(user.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN'])) {
    return allDepartments
  }
  return allDepartments.filter(dept => areIdsEqual(dept.id, user.department_id))
}

function DepartmentsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [departments, setDepartments] = useState<Department[]>([])
  const [departmentUsers, setDepartmentUsers] = useState<DepartmentUser[]>([])
  const [departmentRanks, setDepartmentRanks] = useState<DepartmentRank[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingDepartmentData, setLoadingDepartmentData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newRankName, setNewRankName] = useState('')
  const [creatingRank, setCreatingRank] = useState(false)
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)

  const canManageRanks = useMemo(() => {
    return roleMatches(currentUser?.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])
  }, [currentUser?.role])

  const visibleDepartments = useMemo(() => {
    return resolveVisibleDepartments(departments, currentUser)
  }, [departments, currentUser])

  const selectedDepartment = useMemo(() => {
    return visibleDepartments.find(dep => areIdsEqual(dep.id, selectedDepartmentId)) || null
  }, [visibleDepartments, selectedDepartmentId])

  const rankMap = useMemo(() => {
    const map = new Map<string, DepartmentRank>()
    departmentRanks.forEach(rank => map.set(rank.id, rank))
    return map
  }, [departmentRanks])

  const sortedDepartmentUsers = useMemo(() => {
    return [...departmentUsers].sort((a, b) => {
      const rankA = rankMap.get(a.rank_id || '')?.order ?? 99999
      const rankB = rankMap.get(b.rank_id || '')?.order ?? 99999
      if (rankA !== rankB) return rankA - rankB

      const roleA = ROLE_ORDER.indexOf((a.role || '').toUpperCase())
      const roleB = ROLE_ORDER.indexOf((b.role || '').toUpperCase())
      const safeRoleA = roleA === -1 ? ROLE_ORDER.length : roleA
      const safeRoleB = roleB === -1 ? ROLE_ORDER.length : roleB
      if (safeRoleA !== safeRoleB) return safeRoleA - safeRoleB

      return (a.full_name || '').localeCompare(b.full_name || '')
    })
  }, [departmentUsers, rankMap])

  const rankUsage = useMemo(() => {
    const counts = new Map<string, number>()
    sortedDepartmentUsers.forEach(user => {
      const key = user.rank_id || ''
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return counts
  }, [sortedDepartmentUsers])

  const canManageSelectedDepartment = useMemo(() => {
    if (!canManageRanks || !selectedDepartmentId) return false
    if ((currentUser?.role || '').toUpperCase() !== 'MANAGER') return true
    return areIdsEqual(currentUser?.department_id, selectedDepartmentId)
  }, [canManageRanks, currentUser?.department_id, currentUser?.role, selectedDepartmentId])

  const fetchDepartmentDetails = async (departmentId: string, user?: any) => {
    const token = localStorage.getItem('crm_token')
    if (!token || !departmentId) return
    setLoadingDepartmentData(true)
    setError(null)

    try {
      const params = getWorkspaceParams(user || currentUser) || undefined
      const [usersRes, ranksRes] = await Promise.all([
        axios.get(`/access/departments/${departmentId}/users`, {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }),
        axios.get(`/access/departments/${departmentId}/ranks`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      const users: DepartmentUser[] = Array.isArray(usersRes.data)
        ? usersRes.data.map((item: any) => ({
            ...item,
            role: normalizeRole(item.role),
            rank_id: item.rank_id ? String(item.rank_id) : null,
          }))
        : []

      const ranks: DepartmentRank[] = Array.isArray(ranksRes.data)
        ? ranksRes.data.map((rank: any) => ({
            id: String(rank.id),
            name: String(rank.name),
            order: Number(rank.order || 0),
          }))
        : []

      setDepartmentUsers(users)
      setDepartmentRanks(sortRanks(ranks))
    } catch (err: any) {
      console.error('Failed to fetch department data:', err)
      setDepartmentUsers([])
      setDepartmentRanks([])
      setError(err?.response?.data?.detail || 'Failed to load department details')
    } finally {
      setLoadingDepartmentData(false)
    }
  }

  const fetchData = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const currentUserRes = await axios.get('/access/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const normalizedUser = normalizeUser(currentUserRes.data)
      setCurrentUser(normalizedUser)

      const params = getWorkspaceParams(normalizedUser) || undefined
      const deptRes = await axios.get('/workflow/departments', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })
      const fetchedDepartments = Array.isArray(deptRes.data) ? deptRes.data : []
      setDepartments(fetchedDepartments)

      const visible = resolveVisibleDepartments(fetchedDepartments, normalizedUser)
      const nextDepartmentId =
        visible.find(dep => areIdsEqual(dep.id, normalizedUser.department_id))?.id ||
        visible[0]?.id ||
        ''
      setSelectedDepartmentId(nextDepartmentId)

      if (nextDepartmentId) {
        await fetchDepartmentDetails(nextDepartmentId, normalizedUser)
      } else {
        setDepartmentUsers([])
        setDepartmentRanks([])
      }
    } catch (err: any) {
      console.error('Failed to load departments page:', err)
      setError(err?.response?.data?.detail || 'Failed to load departments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!currentUser || !selectedDepartmentId) return
    fetchDepartmentDetails(selectedDepartmentId, currentUser)
  }, [selectedDepartmentId])

  const handleCreateRank = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedDepartmentId || !newRankName.trim()) return

    const token = localStorage.getItem('crm_token')
    if (!token) return

    setCreatingRank(true)
    setError(null)

    try {
      const res = await axios.post(
        `/access/departments/${selectedDepartmentId}/ranks`,
        { name: newRankName.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const created: DepartmentRank = {
        id: String(res.data.id),
        name: String(res.data.name),
        order: Number(res.data.order || 0),
      }
      setDepartmentRanks(prev => sortRanks([...prev, created]))
      setNewRankName('')
    } catch (err: any) {
      console.error('Failed to create rank:', err)
      setError(err?.response?.data?.detail || 'Failed to create rank')
    } finally {
      setCreatingRank(false)
    }
  }

  const handleAssignRank = async (userId: string, nextRankId: string) => {
    if (!selectedDepartmentId) return
    const token = localStorage.getItem('crm_token')
    if (!token) return

    setAssigningUserId(userId)
    setError(null)
    try {
      await axios.put(
        `/access/users/${userId}/rank`,
        {
          department_id: selectedDepartmentId,
          rank_id: nextRankId || null,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      )
      setDepartmentUsers(prev =>
        prev.map(user => (user.id === userId ? { ...user, rank_id: nextRankId || null } : user)),
      )
    } catch (err: any) {
      console.error('Failed to assign rank:', err)
      setError(err?.response?.data?.detail || 'Failed to assign rank')
    } finally {
      setAssigningUserId(null)
    }
  }

  return (
    <div className="crm-page-shell" style={{ padding: isMobile ? '16px' : '24px' }}>
      <div className="crm-page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Departments &amp; Rankings</h1>
          <button
            onClick={() => navigate('/dashboard')}
            style={{ background: 'none', border: 'none', padding: 0, color: 'gray', cursor: 'pointer', marginTop: '5px' }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {loading && <p>Loading...</p>}

      {!loading && error && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', border: '1px solid #ffa39e', borderRadius: '8px', background: '#fff1f0', color: '#cf1322' }}>
          {error}
        </div>
      )}

      {!loading && visibleDepartments.length === 0 && (
        <p style={{ color: 'gray' }}>
          {currentUser?.department_id ? 'Your department currently has no users.' : 'No matching department found.'}
        </p>
      )}

      {!loading && visibleDepartments.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(260px, 360px) minmax(0, 1fr)',
            gap: '12px',
            marginBottom: '12px',
          }}>
            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                Department
              </label>
              <select
                value={selectedDepartmentId}
                onChange={e => setSelectedDepartmentId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd' }}
              >
                {visibleDepartments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
              {selectedDepartment && (
                <div style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
                  {selectedDepartment.description || 'No description'}
                </div>
              )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>
                Rank Summary
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {departmentRanks.map(rank => (
                  <span key={rank.id} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '999px', background: '#f0f5ff', color: '#1d39c4' }}>
                    {rank.name}: {rankUsage.get(rank.id) || 0}
                  </span>
                ))}
                <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '999px', background: '#f5f5f5', color: '#555' }}>
                  Unassigned: {rankUsage.get('') || 0}
                </span>
              </div>
            </div>
          </div>

          {canManageSelectedDepartment && (
            <form
              onSubmit={handleCreateRank}
              className={isMobile ? 'crm-mobile-stack' : ''}
              style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '12px' }}
            >
              <input
                value={newRankName}
                onChange={e => setNewRankName(e.target.value)}
                placeholder="New rank name (e.g. Senior Specialist)"
                style={{ flex: 1, minWidth: 0, padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd' }}
              />
              <button
                type="submit"
                disabled={creatingRank || !newRankName.trim()}
                style={{
                  background: creatingRank ? '#8c8c8c' : '#1677ff',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 14px',
                  cursor: creatingRank ? 'not-allowed' : 'pointer',
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                {creatingRank ? 'Creating...' : 'Create Rank'}
              </button>
            </form>
          )}

          <section style={{ background: '#fff', border: '1px solid #eee', borderRadius: '10px', padding: '12px' }}>
            <header className={isMobile ? 'crm-mobile-stack' : ''} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
              <h2 style={{ margin: 0 }}>
                {selectedDepartment?.name || 'Department'} Users
              </h2>
              <span style={{ fontSize: '12px', color: '#999' }}>
                Users: {sortedDepartmentUsers.length}
              </span>
            </header>

            {loadingDepartmentData ? (
              <p style={{ color: '#888', marginTop: '10px' }}>Loading department users...</p>
            ) : sortedDepartmentUsers.length === 0 ? (
              <p style={{ color: '#888', marginTop: '10px' }}>No users assigned yet.</p>
            ) : (
              <div className="crm-table-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                  <thead>
                    <tr>
                      <th style={tableHeader}>#</th>
                      <th style={tableHeader}>Name</th>
                      <th style={tableHeader}>Role</th>
                      <th style={tableHeader}>Rank</th>
                      <th style={tableHeader}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDepartmentUsers.map((user, index) => {
                      const activeRank = user.rank_id ? rankMap.get(user.rank_id) : null
                      return (
                        <tr key={user.id} style={{ background: index % 2 ? '#fafafa' : 'white' }}>
                          <td style={tableCell}>{index + 1}</td>
                          <td style={tableCell}>
                            <div style={{ fontWeight: 600 }}>{user.full_name}</div>
                            <div style={{ fontSize: '12px', color: '#888' }}>{user.email}</div>
                          </td>
                          <td style={tableCell}>{(user.role || 'USER').toUpperCase()}</td>
                          <td style={tableCell}>
                            {canManageSelectedDepartment ? (
                              <select
                                value={user.rank_id || ''}
                                disabled={assigningUserId === user.id}
                                onChange={e => handleAssignRank(user.id, e.target.value)}
                                style={{ width: '100%', minWidth: '170px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #ddd' }}
                              >
                                <option value="">Unassigned</option>
                                {departmentRanks.map(rank => (
                                  <option key={rank.id} value={rank.id}>
                                    {rank.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              activeRank?.name || 'Unassigned'
                            )}
                          </td>
                          <td style={tableCell}>{user.is_active ? 'Active' : 'Inactive'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

const tableHeader = {
  borderBottom: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  fontWeight: 600,
} as React.CSSProperties

const tableCell = {
  borderBottom: '1px solid #f0f0f0',
  padding: '8px',
  verticalAlign: 'top',
} as React.CSSProperties

export default DepartmentsPage
