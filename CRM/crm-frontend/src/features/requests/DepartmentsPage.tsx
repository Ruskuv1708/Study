import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { type Department } from './types'
import { normalizeRole, roleMatches } from '../../shared/roleLabels'
import { getWorkspaceParams } from '../../shared/workspace'

const ROLE_ORDER = ['SUPERADMIN','SYSTEM_ADMIN','ADMIN','MANAGER','USER','VIEWER']

const normalizeUser = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

function DepartmentsPage() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [workspaceUsers, setWorkspaceUsers] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [department, setDepartment] = useState<Department | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token) return navigate('/')
    let dataDeps: Department[] = []
    let usersList: any[] = []
    try {
      const currentUserRes = await axios.get('/access/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const normalizedUser = normalizeUser(currentUserRes.data)
      setCurrentUser(normalizedUser)
      const params = getWorkspaceParams(normalizedUser) || (normalizedUser.workspace_id ? { workspace_id: normalizedUser.workspace_id } : undefined)

      const deptRes = await axios.get('/workflow/departments', {
        headers: { Authorization: `Bearer ${token}` },
        params
      })
      dataDeps = deptRes.data
      setDepartments(dataDeps)

      if (normalizedUser.department_id) {
        const fallback = dataDeps.find((d: Department) => (d.id || '').toLowerCase() === normalizedUser.department_id.toLowerCase())
        setDepartment(fallback || null)
      } else {
        setDepartment(null)
      }

      try {
        const usersRes = await axios.get('/access/users', {
          headers: { Authorization: `Bearer ${token}` },
          params
        })
        usersList = usersRes.data.map(normalizeUser)
        setWorkspaceUsers(usersList)
      } catch (innerErr: any) {
        console.warn('Unable to fetch all users', innerErr)
        if (normalizedUser.department_id) {
          try {
            const fallbackRes = await axios.get(`/access/departments/${normalizedUser.department_id}/users`, {
              headers: { Authorization: `Bearer ${token}` }
            })
            usersList = fallbackRes.data.map(normalizeUser)
            setWorkspaceUsers(usersList)
          } catch (fallbackErr) {
            console.warn('Unable to fetch department users fallback', fallbackErr)
            setWorkspaceUsers([])
          }
        } else {
          setWorkspaceUsers([])
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const normalizeId = (value?: string | null): string | null => value ? value.toLowerCase() : null
  const areIdsEqual = (a?: string | null, b?: string | null) => {
    if (!a || !b) return false
    return normalizeId(a) === normalizeId(b)
  }

  const rankUsersForDepartment = (deptId: string) => {
    const filtered = workspaceUsers.filter(user => areIdsEqual(user.department_id, deptId))
    const sorted = filtered.sort((a, b) => {
      const rankA = ROLE_ORDER.indexOf((a.role || '').toUpperCase())
      const rankB = ROLE_ORDER.indexOf((b.role || '').toUpperCase())
      if (rankA !== rankB) return rankA - rankB
      return (a.full_name || '').localeCompare(b.full_name || '')
    })
    return sorted
  }

  const getVisibleDepartments = () => {
    if (!currentUser) return []
    if (roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN'])) {
      return departments
    }
    const myDept = currentUser.department_id
    return departments.filter(dept => areIdsEqual(dept.id, myDept))
  }

  const visibleDepartments = getVisibleDepartments()
  const effectiveDepartments = visibleDepartments.length > 0
    ? visibleDepartments
    : department ? [department] : []

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Departments &amp; Rankings</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ background: "none", border: "none", padding: 0, color: "gray", cursor: "pointer", marginTop: "5px" }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {loading && <p>Loading...</p>}
      {!loading && effectiveDepartments.length === 0 && (
        <p style={{ color: "gray" }}>
          {currentUser?.department_id
            ? "Your department currently has no users."
            : "No matching department found."}
        </p>
      )}

      {!loading && effectiveDepartments.map(dept => {
        const deptUsers = rankUsersForDepartment(dept.id)
        return (
          <section key={dept.id} style={{ marginBottom: "30px" }}>
            <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0" }}>{dept.name}</h2>
                <p style={{ margin: 0, color: "gray" }}>{dept.description || "No description"}</p>
              </div>
              <span style={{ fontSize: "12px", color: "#999" }}>Users: {deptUsers.length}</span>
            </header>

            {deptUsers.length === 0 ? (
              <p style={{ color: "#888", marginTop: "10px" }}>No users assigned yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10px" }}>
                <thead>
                  <tr>
                    <th style={tableHeader}>Rank</th>
                    <th style={tableHeader}>Name</th>
                    <th style={tableHeader}>Role</th>
                    <th style={tableHeader}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deptUsers.map((user, index) => (
                    <tr key={user.id} style={{ background: index % 2 ? '#fafafa' : 'white' }}>
                      <td style={tableCell}>{index + 1}</td>
                      <td style={tableCell}>{user.full_name}</td>
                      <td style={tableCell}>{(user.role || 'USER').toUpperCase()}</td>
                      <td style={tableCell}>{user.is_active ? 'Active' : 'Inactive'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
    </div>
  )
}

const tableHeader = {
  borderBottom: "1px solid #ddd", padding: "8px", textAlign: "left", fontWeight: 600
} as React.CSSProperties

const tableCell = {
  borderBottom: "1px solid #f0f0f0", padding: "8px"
} as React.CSSProperties

export default DepartmentsPage
