import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from '../shared/theme'

// Define the shape of the form data
interface WorkspaceFormData {
  workspace_name: string;      
  subdomain_prefix: string; 
  admin_email: string;
  admin_password: string;
  admin_full_name: string;     
}

function WorkspaceManagementPanel() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // --- NEW STATE FOR CREATION ---
  const [showModal, setShowModal] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [formData, setFormData] = useState<WorkspaceFormData>({
    workspace_name: '',
    subdomain_prefix: '',
    admin_email: '',
    admin_password: '',
    admin_full_name: ''
  })
  
  const navigate = useNavigate()

  // 1. Fetch Data Function (Reusable)
  const fetchWorkspaces = (token: string) => {
    axios.get('/superadmin/workspaces', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setWorkspaces(res.data || [])
      setLoading(false)
    })
    .catch(err => console.error(err))
  }

  const handleSuspend = async (workspaceId: string) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    if (!confirm('Suspend this workspace?')) return
    await axios.post(`/superadmin/workspaces/${workspaceId}/suspend`, null, {
      headers: { Authorization: `Bearer ${token}` }
    })
    fetchWorkspaces(token)
  }

  const handleActivate = async (workspaceId: string) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    await axios.put(`/superadmin/workspaces/${workspaceId}/activate`, null, {
      headers: { Authorization: `Bearer ${token}` }
    })
    fetchWorkspaces(token)
  }

  const handleRename = async (workspaceId: string, currentName: string) => {
    const token = localStorage.getItem('crm_token')
    if (!token) return
    const newName = prompt('New workspace name:', currentName)
    if (!newName || newName.trim() === currentName) return
    await axios.put(`/superadmin/workspaces/${workspaceId}`, {
      workspace_name: newName.trim()
    }, {
      headers: { Authorization: `Bearer ${token}` }
    })
    fetchWorkspaces(token)
  }

  // 2. Initial Load Effect
  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) { navigate('/'); return }

    axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setCurrentUser(res.data)
      // Strict Check
      const role = res.data.role?.toUpperCase() || ''
      if (role !== 'SUPERADMIN') {
        setError('Access Denied: Superadmin privileges required')
        setTimeout(() => navigate('/dashboard'), 2000)
        return
      }
      fetchWorkspaces(token)
    })
    .catch(err => {
      console.error(err)
      setError('Failed to authenticate')
      setLoading(false)
    })
  }, [navigate])

  // 3. Handle Create Submission
  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreating(true)
    const token = localStorage.getItem('crm_token')

    try {
      // We send all data to the Superadmin "Composite" endpoint
      await axios.post('/superadmin/workspaces', formData, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Success!
      alert(`✅ Workspace "${formData.workspace_name}" created successfully!`)
      setShowModal(false)
      // Reset Form
      setFormData({ workspace_name: '', subdomain_prefix: '', admin_email: '', admin_password: '', admin_full_name: '' })
      // Refresh List
      if (token) fetchWorkspaces(token)

    } catch (err: any) {
      console.error(err)
      alert(err.response?.data?.detail || "Failed to create workspace. Check if subdomain or email exists.")
    } finally {
      setIsCreating(false)
    }
  }

  // --- RENDER HELPERS ---
  if (error) return <div style={{ padding: '50px', textAlign: 'center', color: theme.colors.error }}>🚫 {error}</div>
  if (!currentUser || loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading Superadmin Panel...</div>

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px', fontFamily: 'sans-serif', position: 'relative' }}>
      
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '40px', paddingBottom: '20px', borderBottom: `2px solid ${theme.colors.error}`
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
          background: 'transparent',
          border: `1px solid ${theme.colors.gray.border}`,
          padding: '8px 14px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '14px',
          color: theme.colors.gray.textLight,
          boxShadow: theme.shadows.sm
        }}
        >
          ← Back to Dashboard
        </button>

        <div>
          <h1 style={{ margin: 0, color: theme.colors.error }}>🔐 Superadmin Control Center</h1>
          <p style={{ color: theme.colors.gray.textLight }}>System-wide workspace management</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{currentUser.full_name}</p>
          <span style={{ fontSize: '12px', background: theme.colors.error, color: 'white', padding: '2px 6px', borderRadius: '4px' }}>SUPERADMIN</span>
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button
          onClick={() => setShowModal(true)}
          style={{
            background: theme.colors.error, color: 'white', border: 'none',
            padding: '12px 24px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '16px', fontWeight: 'bold', boxShadow: theme.shadows.md
          }}
        >
          + New Workspace
        </button>
      </div>

      {/* Workspaces List Table */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: theme.shadows.md, border: `1px solid ${theme.colors.gray.border}` }}>
        <div style={{ background: '#333', color: 'white', padding: '15px 20px', fontWeight: 'bold' }}>
          📊 Active Workspaces ({workspaces.length})
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: theme.colors.gray.light, borderBottom: '2px solid #ddd' }}>
              <th style={{ padding: '15px', textAlign: 'left' }}>Company</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Subdomain</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Admin Contact</th>
              <th style={{ padding: '15px', textAlign: 'left' }}>Status</th>
              <th style={{ padding: '15px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map(ws => (
              <tr key={ws.id} style={{ borderBottom: `1px solid ${theme.colors.gray.border}` }}>
                <td style={{ padding: '15px', fontWeight: 'bold' }}>{ws.name}</td>
                <td style={{ padding: '15px' }}><code style={{ background: '#eee', padding: '4px' }}>{ws.subdomain_prefix}</code></td>
                <td style={{ padding: '15px' }}>{ws.admin_email}</td>
                <td style={{ padding: '15px' }}>
                  <span style={{ color: ws.is_active ? theme.colors.success : theme.colors.error, fontWeight: 'bold' }}>
                    {ws.is_active ? '● Active' : '● Suspended'}
                  </span>
                </td>
                <td style={{ padding: '15px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleRename(ws.id, ws.name)}
                    style={{ marginRight: '8px' }}
                  >
                    Rename
                  </button>
                  {ws.is_active ? (
                    <button onClick={() => handleSuspend(ws.id)}>Suspend</button>
                  ) : (
                    <button onClick={() => handleActivate(ws.id)}>Activate</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* --- CREATE WORKSPACE MODAL --- */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '10px',
            width: '500px', boxShadow: theme.shadows.lg, position: 'relative'
          }}>
            <h2 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '15px' }}>🚀 Launch New Workspace</h2>
            
            <form onSubmit={handleCreateWorkspace} style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' }}>
              
              {/* Company Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Company Name</label>
                  <input required placeholder="e.g. Tesla Inc." 
                    value={formData.workspace_name} onChange={e => setFormData({...formData, workspace_name: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Subdomain</label>
                  <input required placeholder="e.g. tesla" 
                    value={formData.subdomain_prefix} onChange={e => setFormData({...formData, subdomain_prefix: e.target.value.toLowerCase()})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Admin Info */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '5px' }}>
                <label style={{ fontSize: '12px', color: 'gray', marginBottom: '10px', display: 'block' }}>INITIAL ADMIN USER</label>
                
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Full Name</label>
                  <input required placeholder="e.g. Elon Musk" 
                    value={formData.admin_full_name} onChange={e => setFormData({...formData, admin_full_name: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Email Address</label>
                  <input required type="email" placeholder="admin@tesla.com" 
                    value={formData.admin_email} onChange={e => setFormData({...formData, admin_email: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Password</label>
                  <input required type="password" placeholder="Min 8 chars" 
                    value={formData.admin_password} onChange={e => setFormData({...formData, admin_password: e.target.value})}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isCreating}
                  style={{ flex: 1, padding: '10px', background: theme.colors.error, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', opacity: isCreating ? 0.7 : 1 }}>
                  {isCreating ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkspaceManagementPanel
