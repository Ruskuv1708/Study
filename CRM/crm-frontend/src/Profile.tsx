import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

function Profile() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [tenant, setTenant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: ''
  })
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/login')
      return
    }

    // Fetch current user info
    axios.get('http://127.0.0.1:8000/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setCurrentUser(res.data)
      setFormData({
        full_name: res.data.full_name,
        email: res.data.email
      })
      
      // If we have workspace_id, fetch workspace info
      if (res.data.workspace_id) {
        return axios.get(
          `http://127.0.0.1:8000/superadmin/workspaces/${res.data.workspace_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
      }
    })
    .then(res => {
      if (res && res.data) {
        setTenant(res.data)
      }
      setLoading(false)
    })
    .catch(err => {
      console.error('Error:', err)
      setLoading(false)
    })
  }, [navigate])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('crm_token')

    try {
      await axios.put(
        'http://127.0.0.1:8000/access/me',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      alert('✅ Profile updated successfully')
      setEditMode(false)
    } catch (err: any) {
      alert(err.response?.data?.detail || '❌ Failed to update profile')
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>
  if (!currentUser) return <div style={{ padding: '20px' }}>No user data</div>

  const getRoleColor = (role: string) => {
    const roleUpper = role?.toUpperCase() || ''
    switch (roleUpper) {
      case 'SUPERADMIN': return '#dc3545'
      case 'ADMIN': return '#28a745'
      case 'MANAGER': return '#007bff'
      case 'USER': return '#6c757d'
      case 'VIEWER': return '#999'
      default: return '#333'
    }
  }

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>👤 My Profile</h1>

      {/* User Information Card */}
      <div style={{
        padding: '20px',
        background: '#f9f9f9',
        border: '1px solid #ddd',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        {/* ✅ Role Badge */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Role</label>
          <div style={{
            display: 'inline-block',
            background: getRoleColor(currentUser?.role),
            color: 'white',
            padding: '6px 12px',
            borderRadius: '4px',
            fontWeight: 'bold',
            marginTop: '5px',
            fontSize: '14px'
          }}>
            {currentUser?.role?.toUpperCase() || 'N/A'}
          </div>
        </div>

        {/* ✅ Workspace/Tenant Information */}
        <div style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #ddd' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Workspace</label>
          <div style={{ marginTop: '5px', fontSize: '14px' }}>
            {tenant ? (
              <div>
                <strong>{tenant.name}</strong>
                <div style={{ color: '#666', fontSize: '12px', marginTop: '3px' }}>
                  ID: {currentUser?.workspace_id}
                </div>
                <div style={{
                  marginTop: '5px',
                  display: 'inline-block',
                  background: tenant.is_active ? '#d4edda' : '#f8d7da',
                  color: tenant.is_active ? '#155724' : '#721c24',
                  padding: '3px 8px',
                  borderRadius: '3px',
                  fontSize: '12px'
                }}>
                  {tenant.is_active ? '✅ Active' : '❌ Inactive'}
                </div>
              </div>
            ) : (
              <span style={{ color: '#666' }}>Loading workspace info...</span>
            )}
          </div>
        </div>

        {/* Full Name */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Full Name</label>
          <p style={{ margin: '5px 0', fontSize: '14px' }}>
            {!editMode ? (
              currentUser?.full_name
            ) : (
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            )}
          </p>
        </div>

        {/* Email */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Email</label>
          <p style={{ margin: '5px 0', fontSize: '14px' }}>
            {!editMode ? (
              currentUser?.email
            ) : (
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            )}
          </p>
        </div>

        {/* Status */}
        <div style={{ marginBottom: '15px' }}>
          <label style={{ fontSize: '12px', color: '#666' }}>Account Status</label>
          <div style={{
            marginTop: '5px',
            display: 'inline-block',
            background: currentUser?.is_active ? '#d4edda' : '#f8d7da',
            color: currentUser?.is_active ? '#155724' : '#721c24',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            {currentUser?.is_active ? '✅ Active' : '❌ Inactive'}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {!editMode ? (
          <button
            onClick={() => setEditMode(true)}
            style={{
              padding: '10px 20px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ✏️ Edit Profile
          </button>
        ) : (
          <>
            <button
              onClick={handleUpdateProfile}
              style={{
                padding: '10px 20px',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              💾 Save Changes
            </button>
            <button
              onClick={() => setEditMode(false)}
              style={{
                padding: '10px 20px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ❌ Cancel
            </button>
          </>
        )}

        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 20px',
            background: '#999',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginLeft: 'auto'
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  )
}

export default Profile
