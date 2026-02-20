import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from '../shared/theme'
import { normalizeRole, roleMatches } from '../shared/roleLabels'
import { getWorkspaceParams } from '../shared/workspace'
import type { RequestItem } from '../features/requests/types'
import useIsMobile from '../shared/useIsMobile'

const normalizeUserRole = (user: any) => ({
  ...user,
  role: normalizeRole(user.role)
})

type NotificationStats = {
  assigned: number
  pending: number
  newCount: number
}

function AppLayout() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationStats, setNotificationStats] = useState<NotificationStats>({
    assigned: 0,
    pending: 0,
    newCount: 0,
  })
  const location = useLocation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const loadNotificationStats = async (user: any) => {
    const token = localStorage.getItem('crm_token')
    if (!token || !user?.id) return
    setNotificationsLoading(true)
    try {
      const params = {
        ...(getWorkspaceParams(user) || {}),
        assignee_id: user.id,
      }
      const res = await axios.get('/workflow/requests', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })
      const assignedRequests: RequestItem[] = Array.isArray(res.data) ? res.data : []
      const ownAssigned = assignedRequests.filter(req => {
        return typeof req?.assigned_to_id === 'string' && req.assigned_to_id.toLowerCase() === String(user.id).toLowerCase()
      })
      setNotificationStats({
        assigned: ownAssigned.length,
        newCount: ownAssigned.filter(req => req.status === 'new').length,
        pending: ownAssigned.filter(req => req.status === 'pending').length,
      })
    } catch (err) {
      console.warn('Failed to load request notifications', err)
      setNotificationStats({ assigned: 0, newCount: 0, pending: 0 })
    } finally {
      setNotificationsLoading(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      const token = localStorage.getItem('crm_token')
      if (!token) {
        navigate('/')
        return
      }
      try {
        const res = await axios.get('/access/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const normalized = normalizeUserRole(res.data)
        setCurrentUser(normalized)
        await loadNotificationStats(normalized)
      } catch {
        localStorage.removeItem('crm_token')
        navigate('/')
      }
    })()
  }, [navigate])

  useEffect(() => {
    if (!currentUser) return
    loadNotificationStats(currentUser)
    const intervalId = window.setInterval(() => {
      loadNotificationStats(currentUser)
    }, 30000)
    return () => window.clearInterval(intervalId)
  }, [currentUser?.id, location.pathname])

  useEffect(() => {
    setSidebarOpen(!isMobile)
  }, [isMobile])

  useEffect(() => {
    if (!isMobile) return
    setSidebarOpen(false)
  }, [location.pathname, isMobile])

  const menuItems = useMemo(() => {
    if (!currentUser) return []
    const base = [
      { label: 'Dashboard', path: '/dashboard' },
      ...(roleMatches(currentUser.role, ['USER', 'VIEWER'])
        ? [{ label: 'Assigned Requests', path: '/requests/assigned' }]
        : [{ label: 'Requests', path: '/requests' }, { label: 'Assigned Requests', path: '/requests/assigned' }]
      ),
      { label: 'Departments', path: '/departments' },
      ...(roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN', 'MANAGER', 'USER'])
        ? [{ label: 'Registry', path: '/registry' }]
        : []
      ),
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

  const sidebarWidth = sidebarOpen ? 260 : 84
  const compactSidebar = !isMobile && !sidebarOpen
  const handleLogout = () => {
    localStorage.removeItem('crm_token')
    window.location.href = '/'
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {isMobile && sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 15,
            border: 'none',
            background: 'rgba(0,0,0,0.45)',
            padding: 0,
          }}
        />
      )}
      <div style={{
        width: sidebarWidth,
        backgroundColor: theme.colors.black,
        color: theme.colors.white,
        padding: theme.spacing.lg,
        transition: isMobile ? 'transform 0.25s ease' : 'width 0.3s ease',
        borderRight: `1px solid #333`,
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 20,
        transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        overflowY: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: compactSidebar ? 'center' : 'space-between', alignItems: 'center', marginBottom: theme.spacing.xl }}>
          <div style={{ fontWeight: 'bold' }}>{compactSidebar ? 'C' : 'CRM'}</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isMobile && (
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
            )}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #fff',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            )}
            <button
              onClick={handleLogout}
              style={{
                background: '#ff4d4f',
                color: '#fff',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              {compactSidebar ? '⏻' : 'Logout'}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
          {menuItems.map(item => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path)
                if (isMobile) {
                  setSidebarOpen(false)
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
                textAlign: compactSidebar ? 'center' : 'left',
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                borderRadius: theme.borderRadius.md,
                fontSize: '14px'
              }}
            >
              {compactSidebar ? item.label.charAt(0) : item.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{
        flex: 1,
        backgroundColor: theme.colors.gray.lighter,
        minWidth: 0,
      }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: theme.spacing.sm,
          padding: `10px ${isMobile ? theme.spacing.sm : sidebarOpen ? theme.spacing.lg : theme.spacing.sm}`,
          borderBottom: '1px solid #eee',
          minHeight: 72,
          backgroundColor: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 5
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: '#fff',
                  border: `1px solid ${theme.colors.gray.border}`,
                  borderRadius: theme.borderRadius.md,
                  padding: '6px 9px',
                  cursor: 'pointer',
                }}
              >
                ☰
              </button>
            )}
          <div>
            <strong style={{ fontSize: '16px' }}>{currentUser.full_name}</strong>
            <div style={{ fontSize: '12px', color: '#555' }}>{currentUser.role?.toUpperCase()}</div>
            <div style={{ fontSize: '11px', color: '#777' }}>
              Assigned: <strong>{notificationsLoading ? '...' : notificationStats.assigned}</strong>
              {' '}• New: <strong>{notificationsLoading ? '...' : notificationStats.newCount}</strong>
              {' '}• Pending: <strong>{notificationsLoading ? '...' : notificationStats.pending}</strong>
            </div>
          </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => navigate('/requests/assigned')}
              style={{
                background: '#fffbe6',
                border: '1px solid #ffe58f',
                borderRadius: '20px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              {isMobile ? 'Assigned' : 'Assigned Requests'}: {notificationsLoading ? '...' : notificationStats.assigned}
            </button>
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
              {isMobile ? 'Me' : 'Profile'}
            </button>
          </div>
        </header>
        <main style={{ padding: isMobile ? theme.spacing.sm : theme.spacing.lg, minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AppLayout
