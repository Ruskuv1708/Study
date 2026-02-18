import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ROLE_DISPLAY_NAMES, roleMatches } from '../shared/roleLabels'

interface User {
  id: string
  full_name: string
  email: string
  role: 'SUPERADMIN' | 'SYSTEM_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER'
  is_active: boolean
  workspace_id: string | null
  department_id: string | null
}

interface Workspace {
  id: string
  name: string
  is_active: boolean
}

interface Department {
  id: string
  name: string
  description?: string | null
}

function AdminPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(() => {
    try {
      return localStorage.getItem('crm_workspace_id') || ''
    } catch {
      return ''
    }
  })
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'USER',
    workspace_id: '',
    department_id: ''
  })

  const [newDept, setNewDept] = useState({ name: '', description: '' })
  const [editDeptId, setEditDeptId] = useState<string | null>(null)
  const [editDeptName, setEditDeptName] = useState('')
  const [editDeptDescription, setEditDeptDescription] = useState('')

  const getRoleOptions = (role: string) => {
    if (roleMatches(role, ['SUPERADMIN', 'SYSTEM_ADMIN'])) {
      return ['VIEWER', 'USER', 'MANAGER', 'ADMIN', 'SYSTEM_ADMIN']
    }
    if (roleMatches(role, ['ADMIN'])) {
      return ['VIEWER', 'USER', 'MANAGER']
    }
    if (roleMatches(role, ['MANAGER'])) {
      return ['VIEWER', 'USER']
    }
    return ['VIEWER', 'USER']
  }

  const getRoleOptionsForCreation = (role: string) => getRoleOptions(role)
  const getRoleOptionsForEdit = (role: string) => getRoleOptions(role)
  const resolveRoleOptions = (targetRole: string) => {
    const editorRole = currentUser?.role || 'ADMIN'
    const baseOptions = getRoleOptionsForEdit(editorRole)
    const normalizedTarget = targetRole.toUpperCase()
    return baseOptions.includes(normalizedTarget) ? baseOptions : [...baseOptions, normalizedTarget]
  }

  const normalizeUserRole = (role?: string) => (role || '').toUpperCase()
  const normalizeUser = (user: any) => ({
    ...user,
    role: normalizeUserRole(user.role)
  })

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/')
      return
    }

    // Get current user
    axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      const normalized = normalizeUser(res.data)
      setCurrentUser(normalized)
      
      // Check if admin
      if (!roleMatches(normalized.role, ['ADMIN', 'SUPERADMIN', 'SYSTEM_ADMIN'])) {
        navigate('/dashboard')
        return
      }

      // Set default workspace to current user's workspace
      setSelectedWorkspace(res.data.workspace_id)
     
      // Load workspaces
      if (roleMatches(normalized.role, ['SUPERADMIN','SYSTEM_ADMIN'])) {
        return axios.get('/superadmin/workspaces', {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
      if (res.data.workspace_id) {
        return axios.get(`/superadmin/workspaces/${res.data.workspace_id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    })
    .then(res => {
      if (res && res.data) {
        setWorkspaces(Array.isArray(res.data) ? res.data : [res.data])
      }
    })
    .then(() => {
      // Load users for current tenant
      return axios.get('/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
    })
    .then(res => {
      if (!res?.data) return
      setUsers(res.data.map((user: any) => normalizeUser(user)))
      setLoading(false)
    })
    .catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [navigate])

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) return

    const params = roleMatches(currentUser?.role, ['SUPERADMIN','SYSTEM_ADMIN']) && selectedWorkspace
      ? { workspace_id: selectedWorkspace }
      : undefined

    axios.get('/workflow/departments', {
      headers: { Authorization: `Bearer ${token}` },
      params
    })
    .then(res => setDepartments(res.data))
    .catch(err => console.error(err))
  }, [currentUser?.role, selectedWorkspace])

  useEffect(() => {
    if (!currentUser) return
    if (roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN'])) {
      setNewUser(prev => ({ ...prev, workspace_id: selectedWorkspace || '' }))
    } else {
      setNewUser(prev => ({ ...prev, workspace_id: currentUser.workspace_id || '' }))
    }
  }, [currentUser, selectedWorkspace])

  useEffect(() => {
    if (roleMatches(currentUser?.role, ['SUPERADMIN','SYSTEM_ADMIN']) && !selectedWorkspace && workspaces.length > 0) {
      setSelectedWorkspace(workspaces[0].id)
    }
  }, [currentUser?.role, selectedWorkspace, workspaces])

  useEffect(() => {
    if (!roleMatches(currentUser?.role, ['SUPERADMIN','SYSTEM_ADMIN'])) return
    if (!selectedWorkspace) return
    try {
      localStorage.setItem('crm_workspace_id', selectedWorkspace)
    } catch {
      // ignore storage errors
    }
  }, [currentUser?.role, selectedWorkspace])

  const getWorkspaceParams = () => {
    if (roleMatches(currentUser?.role, ['SUPERADMIN','SYSTEM_ADMIN']) && selectedWorkspace) {
      return { workspace_id: selectedWorkspace }
    }
    return undefined
  }

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('crm_token')
    if (!token) return
    if (roleMatches(currentUser?.role, ['SUPERADMIN','SYSTEM_ADMIN']) && !selectedWorkspace) {
      alert('Please select a workspace before creating a department')
      return
    }
    try {
      await axios.post('/workflow/departments', newDept, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams()
      })
      setNewDept({ name: '', description: '' })
      const res = await axios.get('/workflow/departments', {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams()
      })
      setDepartments(res.data)
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to create department')
    }
  }

  const handleUpdateDepartment = async (deptId: string) => {
    const token = localStorage.getItem('crm_token')
    try {
      await axios.put(
        `/workflow/departments/${deptId}`,
        { name: editDeptName, description: editDeptDescription },
        {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams()
        }
      )
      setEditDeptId(null)
      const res = await axios.get('/workflow/departments', {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams()
      })
      setDepartments(res.data)
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to update department')
    }
  }

  const handleUpdateUserDepartment = async (userId: string, departmentId: string | null) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      await axios.put(
        `/access/users/${userId}`,
        { department_id: departmentId || null },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const res = await axios.get('/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data.map((user: any) => normalizeUser(user)))
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to update department')
    }
  }

  const handleDeleteDepartment = async (deptId: string) => {
    const token = localStorage.getItem('crm_token')
    if (!confirm('Delete this department?')) return
    try {
      await axios.delete(`/workflow/departments/${deptId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams()
      })
      setDepartments(prev => prev.filter(d => d.id !== deptId))
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to delete department')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('crm_token')
    
    if (!roleMatches(newUser.role, ['SUPERADMIN','SYSTEM_ADMIN']) && !newUser.workspace_id) {
      alert('❌ Please select a workspace (tenant)')
      return
    }
    if (roleMatches(newUser.role, ['MANAGER','USER']) && !newUser.department_id) {
      alert('❌ Please select a department for manager/user')
      return
    }

    try {
      // Create user with workspace_id
      await axios.post(
        '/access/users',
        {
          full_name: newUser.full_name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          workspace_id: newUser.workspace_id,
          department_id: newUser.department_id || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Refresh users list
      const res = await axios.get('/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data.map((user: any) => normalizeUser(user)))
      
      setNewUser({
        full_name: '',
        email: '',
        password: '',
        role: 'USER',
        workspace_id: selectedWorkspace,
        department_id: ''
      })
      setShowCreateForm(false)
      alert('✅ User created successfully')
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to create user')
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string, departmentId?: string) => {
    const token = localStorage.getItem('crm_token')
    
    if (userId === currentUser?.id) {
      alert('❌ You cannot change your own role. Ask another admin to do this.')
      return
    }
    
    if (roleMatches(newRole, ['MANAGER','USER']) && !departmentId) {
      alert('❌ Please set a department before assigning manager/user role')
      return
    }

    try {
      await axios.put(
        `/access/users/${userId}/role`,
        { new_role: newRole, department_id: departmentId || null },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      const res = await axios.get('/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data.map((user: any) => normalizeUser(user)))
      alert('✅ User role updated')
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to update role')
    }
  }

  const handleToggleUserStatus = async (userId: string) => {
    const token = localStorage.getItem('crm_token')
    
    const user = users.find(u => u.id === userId)
    if (!user) return

    try {
      const newStatus = !user.is_active
      
      await axios.put(
        `/access/users/${userId}`,
        { is_active: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      const res = await axios.get('/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data.map((user: any) => normalizeUser(user)))
    } catch (err) {
      alert('❌ Failed to update user status')
    }
  }

  if (!currentUser || loading) return <div>Loading...</div>

  // ✅ Filter users by selected tenant for non-superadmin
  const filteredUsers = roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN'])
    ? users.filter(u => u.workspace_id === selectedWorkspace)
    : users

  const creationRoleOptions = getRoleOptionsForCreation(currentUser.role)

  return (
    <div style={{ padding: '20px' }}>

  {/* Back button */}
  <button
    onClick={() => navigate('/dashboard')}
    style={{
      marginBottom: '15px',
      background: 'transparent',
      border: '1px solid #ccc',
      padding: '6px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: '13px'
    }}
  >
    ← Back to Dashboard
  </button>

  <h1>User Management</h1>

      
      {/* ✅ Tenant Selector for Superadmin */}
      {roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN']) && workspaces.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <label>
            <strong>Select Workspace:</strong>
            <select
              value={selectedWorkspace}
              onChange={(e) => setSelectedWorkspace(e.target.value)}
              style={{
                marginLeft: '10px',
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            >
              {workspaces.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} {!t.is_active && '(Inactive)'}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          ➕ {showCreateForm ? 'Cancel' : 'Create New User'}
        </button>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateUser} style={{
          padding: '20px',
          background: '#f9f9f9',
          border: '1px solid #ddd',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          <div style={{ marginBottom: '15px' }}>
            <label>Full Name:</label>
            <input
              type="text"
              value={newUser.full_name}
              onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Email:</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Password:</label>
            <input
              type="password"
              value={newUser.password}
              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Role:</label>
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({...newUser, role: e.target.value, department_id: ''})}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              {creationRoleOptions.map(option => (
                <option key={option} value={option}>
                  {ROLE_DISPLAY_NAMES[option] ?? option}
                </option>
              ))}
            </select>
          </div>

          {/* Workspace Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label>Workspace:</label>
            <select
              value={newUser.workspace_id}
              onChange={(e) => setNewUser({...newUser, workspace_id: e.target.value})}
              required={!roleMatches(newUser.role, ['SUPERADMIN','SYSTEM_ADMIN'])}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value="">-- Select Workspace --</option>
              {(roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN']) ? workspaces : workspaces.filter(w => w.id === currentUser.workspace_id)).map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {roleMatches(newUser.role, ['MANAGER','USER']) && (
            <div style={{ marginBottom: '15px' }}>
              <label>Department:</label>
              <select
                value={newUser.department_id}
                onChange={(e) => setNewUser({...newUser, department_id: e.target.value})}
                required
                style={{ width: '100%', padding: '8px', marginTop: '5px' }}
              >
                <option value="">-- Select Department --</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create User
          </button>
        </form>
      )}

      {/* Users List */}
      <h2>Users ({filteredUsers.length})</h2>
      {filteredUsers.length === 0 ? (
        <p>No users in this workspace</p>
      ) : (
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '20px'
        }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Name</th>
              <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Email</th>
              <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Role</th>
              <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Department</th>
              <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'left' }}>Status</th>
              <th style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.5 }}>
                <td style={{ border: '1px solid #ddd', padding: '10px' }}>{user.full_name}</td>
                <td style={{ border: '1px solid #ddd', padding: '10px' }}>{user.email}</td>
                <td style={{ border: '1px solid #ddd', padding: '10px' }}>
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value, user.department_id || undefined)}
                    disabled={user.id === currentUser?.id}
                    style={{
                      opacity: user.id === currentUser?.id ? 0.5 : 1,
                      cursor: user.id === currentUser?.id ? 'not-allowed' : 'pointer',
                      padding: '4px'
                    }}
                  >
                    {resolveRoleOptions(user.role).map(option => (
                      <option key={option} value={option}>
                        {ROLE_DISPLAY_NAMES[option] ?? option}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ border: '1px solid #ddd', padding: '10px' }}>
                  {roleMatches(user.role, ['MANAGER','USER']) ? (
                    <select
                      value={user.department_id || ''}
                      onChange={(e) => handleUpdateUserDepartment(user.id, e.target.value || null)}
                      style={{ padding: '6px', width: '100%' }}
                    >
                      <option value="">-- Unassigned --</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>—</span>
                  )}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '10px' }}>
                  {user.is_active ? '✅ Active' : '❌ Inactive'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '10px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleToggleUserStatus(user.id)}
                    style={{
                      padding: '6px 12px',
                      background: user.is_active ? '#dc3545' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    {user.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Departments Management */}
      <h2 style={{ marginTop: '40px' }}>Departments ({departments.length})</h2>
      <form onSubmit={handleCreateDepartment} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <input
          placeholder="Department name"
          value={newDept.name}
          onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
          required
          style={{ padding: '8px', flex: 1 }}
        />
        <input
          placeholder="Description (optional)"
          value={newDept.description}
          onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
          style={{ padding: '8px', flex: 2 }}
        />
        <button type="submit" style={{ padding: '8px 14px' }}>Add</button>
      </form>

      {departments.length === 0 ? (
        <p>No departments found</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Name</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Description</th>
              <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map(d => (
              <tr key={d.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {editDeptId === d.id ? (
                    <input
                      value={editDeptName}
                      onChange={(e) => setEditDeptName(e.target.value)}
                      style={{ width: '100%', padding: '6px' }}
                    />
                  ) : (
                    d.name
                  )}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {editDeptId === d.id ? (
                    <input
                      value={editDeptDescription}
                      onChange={(e) => setEditDeptDescription(e.target.value)}
                      style={{ width: '100%', padding: '6px' }}
                    />
                  ) : (
                    d.description || '—'
                  )}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                  {editDeptId === d.id ? (
                    <>
                      <button
                        onClick={() => handleUpdateDepartment(d.id)}
                        style={{ marginRight: '8px' }}
                      >
                        Save
                      </button>
                      <button onClick={() => setEditDeptId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditDeptId(d.id)
                          setEditDeptName(d.name)
                          setEditDeptDescription(d.description || '')
                        }}
                        style={{ marginRight: '8px' }}
                      >
                        Edit
                      </button>
                      <button onClick={() => handleDeleteDepartment(d.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default AdminPanel
