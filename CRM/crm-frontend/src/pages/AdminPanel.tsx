import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface User {
  id: string
  full_name: string
  email: string
  role: 'superadmin' | 'admin' | 'manager' | 'user' | 'viewer'
  is_active: boolean
  tenant_id: string
}

interface Tenant {
  id: string
  name: string
  is_active: boolean
}

function AdminPanel() {
  const [users, setUsers] = useState<User[]>([])
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedTenant, setSelectedTenant] = useState<string>('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'user',
    tenant_id: ''  // ✅ Added tenant selection
  })

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/')
      return
    }

    // Get current user
    axios.get('http://127.0.0.1:8000/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setCurrentUser(res.data)
      
      // Check if admin
      if (res.data.role !== 'admin' && res.data.role !== 'superadmin') {
        navigate('/dashboard')
        return
      }

      // Set default tenant to current user's tenant
      setSelectedTenant(res.data.tenant_id)
      
      // Load tenants if superadmin
      if (res.data.role === 'superadmin') {
        return axios.get('http://127.0.0.1:8000/superadmin/workspaces', {
          headers: { Authorization: `Bearer ${token}` }
        })
      }
    })
    .then(res => {
      if (res && res.data) {
        setTenants(res.data)
      }
    })
    .then(() => {
      // Load users for current tenant
      return axios.get('http://127.0.0.1:8000/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
    })
    .then(res => {
      setUsers(res.data)
      setLoading(false)
    })
    .catch(err => {
      console.error(err)
      setLoading(false)
    })
  }, [navigate])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('crm_token')
    
    if (!newUser.tenant_id) {
      alert('❌ Please select a workspace (tenant)')
      return
    }

    try {
      // Create user with tenant_id
      await axios.post(
        'http://127.0.0.1:8000/access/users',
        {
          full_name: newUser.full_name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
          tenant_id: newUser.tenant_id  // ✅ Include tenant_id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      // Refresh users list
      const res = await axios.get('http://127.0.0.1:8000/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
      
      setNewUser({
        full_name: '',
        email: '',
        password: '',
        role: 'user',
        tenant_id: selectedTenant
      })
      setShowCreateForm(false)
      alert('✅ User created successfully')
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to create user')
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    const token = localStorage.getItem('crm_token')
    
    if (userId === currentUser?.id) {
      alert('❌ You cannot change your own role. Ask another admin to do this.')
      return
    }
    
    try {
      await axios.put(
        `http://127.0.0.1:8000/access/users/${userId}/role`,
        { role: newRole.toUpperCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      const res = await axios.get('http://127.0.0.1:8000/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
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
        `http://127.0.0.1:8000/access/users/${userId}`,
        { is_active: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      
      const res = await axios.get('http://127.0.0.1:8000/access/users', {
        headers: { Authorization: `Bearer ${token}` }
      })
      setUsers(res.data)
    } catch (err) {
      alert('❌ Failed to update user status')
    }
  }

  if (!currentUser || loading) return <div>Loading...</div>

  // ✅ Filter users by selected tenant for non-superadmin
  const filteredUsers = currentUser.role === 'superadmin'
    ? users.filter(u => u.tenant_id === selectedTenant)
    : users

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
      {currentUser.role === 'superadmin' && tenants.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '4px' }}>
          <label>
            <strong>Select Workspace:</strong>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              style={{
                marginLeft: '10px',
                padding: '6px 12px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            >
              {tenants.map(t => (
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
              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* ✅ Tenant Selection */}
          <div style={{ marginBottom: '15px' }}>
            <label>Workspace (Tenant):</label>
            <select
              value={newUser.tenant_id}
              onChange={(e) => setNewUser({...newUser, tenant_id: e.target.value})}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value="">-- Select Workspace --</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

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
                    onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                    disabled={user.id === currentUser?.id}
                    style={{
                      opacity: user.id === currentUser?.id ? 0.5 : 1,
                      cursor: user.id === currentUser?.id ? 'not-allowed' : 'pointer',
                      padding: '4px'
                    }}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="user">User</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
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
    </div>
  )
}

export default AdminPanel