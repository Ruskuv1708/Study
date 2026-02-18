import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from '../shared/theme'
import { normalizeRole } from '../shared/roleLabels'
import { getWorkspaceParams } from '../shared/workspace'

const normalizeUserRole = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

function Dashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/')
      return
    }

    axios.get('/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(async res => {
      const normalized = normalizeUserRole(res.data)
      setCurrentUser(normalized)
      const params = getWorkspaceParams(normalized)
      try {
        const reqRes = await axios.get('/workflow/requests', {
          headers: { Authorization: `Bearer ${token}` },
          params
        })
        setRequests(reqRes.data)
      } catch (err) {
        console.error('Failed to fetch requests:', err)
      } finally {
        setLoading(false)
      }
    })
    .catch(err => {
      console.error('Error fetching user:', err)
      localStorage.removeItem('crm_token')
      navigate('/')
    })
  }, [navigate])

  const getPriorityColor = (priority: string) => {
    return theme.colors.priority[priority as keyof typeof theme.colors.priority] || '#666'
  }

  const getStatusColor = (status: string) => {
    return theme.colors.status[status as keyof typeof theme.colors.status] || theme.colors.gray.light
  }

  const getStatusTextColor = (status: string) => {
    return theme.colors.statusText[status as keyof typeof theme.colors.statusText] || '#333'
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
  }

  if (loading) return <div style={{ padding: "50px", textAlign: "center" }}>Loading...</div>
  if (!currentUser) return <div style={{ padding: "50px", textAlign: "center" }}>No user data</div>

  return (
    <div style={{ padding: theme.spacing.lg, backgroundColor: theme.colors.gray.lighter, minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Welcome back, {currentUser.full_name}</h1>
          <p style={{ margin: '4px 0 0', color: theme.colors.gray.text }}>Role: {currentUser.role?.toUpperCase()}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/requests')}
            style={{
              background: '#1890ff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 18px',
              cursor: 'pointer'
            }}
          >
            View Requests
          </button>
          <button
            onClick={() => navigate('/departments')}
            style={{
              background: '#13c2c2',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 18px',
              cursor: 'pointer'
            }}
          >
            Departments
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '30px' }}>
        <div style={{ padding: '20px', borderRadius: '10px', background: 'white', boxShadow: theme.shadows.sm }}>
          <p style={{ margin: 0, fontSize: '12px', color: theme.colors.gray.textLight }}>Open requests</p>
          <h2 style={{ margin: '6px 0 0' }}>{requests.length}</h2>
        </div>
        <div style={{ padding: '20px', borderRadius: '10px', background: 'white', boxShadow: theme.shadows.sm }}>
          <p style={{ margin: 0, fontSize: '12px', color: theme.colors.gray.textLight }}>Status snapshot</p>
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            {['new', 'assigned', 'in_process', 'pending', 'done'].map(status => (
              <span key={status} style={{
                flex: 1,
                padding: '6px',
                borderRadius: '6px',
                fontSize: '12px',
                background: getStatusColor(status),
                color: getStatusTextColor(status),
                textAlign: 'center'
              }}>
                {status.replace('_', ' ').toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', padding: '20px', boxShadow: theme.shadows.md }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Recent Requests</h2>
          <button
            onClick={() => navigate('/requests')}
            style={{
              background: 'transparent',
              border: '1px solid #ccc',
              borderRadius: '6px',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
          >
            Full list
          </button>
        </div>
        {requests.length === 0 ? (
          <p style={{ color: theme.colors.gray.text }}>No requests yet.</p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {requests.slice(0, 5).map(req => (
              <div key={req.id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{req.title}</strong>
                  <p style={{ margin: '4px 0 0', color: theme.colors.gray.text }}>{req.description?.substring(0, 80) || 'No description'}</p>
                </div>
                <span style={{
                  background: getStatusColor(req.status),
                  color: getStatusTextColor(req.status),
                  padding: '6px 10px',
                  borderRadius: '999px',
                  fontSize: '12px'
                }}>
                  {req.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
