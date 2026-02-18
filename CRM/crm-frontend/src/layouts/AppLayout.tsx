import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from '../shared/theme'
import { normalizeRole, roleMatches } from '../shared/roleLabels'

const normalizeUserRole = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

function AppLayout() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
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
    .then(res => setCurrentUser(normalizeUserRole(res.data)))
    .catch(() => {
      localStorage.removeItem('crm_token')
      navigate('/')
    })
  }, [navigate])

  const menuItems = useMemo(() => {
    if (!currentUser) return []
    const base = [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Requests', path: '/requests' },
      { label: 'Departments', path: '/departments' },
      { label: 'Files', path: '/files' },
      { label: 'Reports', path: '/reports' },
    ]
    if (roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER'])) {
      base.push({ label: 'Forms', path: '/forms' })
    }
    if (roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN'])) {
      base.push({ label: 'Admin', path: '/admin' })
    }
    if (roleMatches(currentUser.role, ['SUPERADMIN'])) {
      base.push({ label: 'Superadmin', path: '/superadmin' })
    }
    return base
  }, [currentUser])

  if (!currentUser) {
    return <div style={{ padding: '60px', textAlign: 'center' }}>Loading...</div>
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <div style={{
        width: sidebarOpen ? 260 : 80,
        backgroundColor: theme.colors.black,
        color: theme.colors.white,
        padding: theme.spacing.lg,
        transition: 'width 0.3s',
        borderRight: `1px solid #333`
      }}>
        <div style={{ display: 'flex', justifyContent: sidebarOpen ? 'space-between' : 'center', alignItems: 'center', marginBottom: theme.spacing.xl }}>
          <div style={{ fontWeight: 'bold' }}>{sidebarOpen ? 'CRM' : 'C'}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSidebarOpen(prev => !prev)}
              style={{
                background: 'transparent',
                border: '1px solid #fff',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {sidebarOpen ? '←' : '→'}
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('crm_token')
                window.location.href = '/'
              }}
              style={{
                background: '#ff4d4f',
                color: '#fff',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {sidebarOpen ? 'Logout' : '⏻'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                textAlign: sidebarOpen ? 'left' : 'center',
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                borderRadius: theme.borderRadius.md,
                fontSize: '14px'
              }}
            >
              {sidebarOpen ? item.label : item.label.charAt(0)}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, backgroundColor: theme.colors.gray.lighter }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `0 ${sidebarOpen ? theme.spacing.lg : theme.spacing.sm}`,
          borderBottom: '1px solid #eee',
          height: 72,
          backgroundColor: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 5
        }}>
          <div>
            <strong style={{ fontSize: '16px' }}>{currentUser.full_name}</strong>
            <div style={{ fontSize: '12px', color: '#555' }}>{currentUser.role?.toUpperCase()}</div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            style={{
              background: '#f0f1f6',
              border: '1px solid #ccd0db',
              borderRadius: '20px',
              padding: '6px 14px',
              cursor: 'pointer'
            }}
          >
            Profile
          </button>
        </header>
        <main style={{ padding: theme.spacing.lg }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
