import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import theme from './theme'

function Dashboard() {
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token) {
      navigate('/login')
      return
    }

    axios.get('http://127.0.0.1:8000/access/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      console.log('Current user:', res.data)  // ✅ DEBUG
      setCurrentUser(res.data)
      setLoading(false)
    })
    .catch(err => {
      console.error('Error fetching user:', err)
      localStorage.removeItem('crm_token')
      navigate('/login')
    })

    axios.get('http://127.0.0.1:8000/workflow/requests', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => setRequests(res.data))
    .catch(err => console.error('Failed to fetch requests:', err))
  }, [navigate])

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Requests', path: '/requests' },
    { label: 'Files', path: '/files' },
    { label: 'Reports', path: '/reports' },
    ...(currentUser?.role === 'superadmin' || currentUser?.role === 'admin' ? [{ label: 'Admin', path: '/admin' },
    ...(currentUser?.role === 'superadmin' ? [{ label: 'Superadmin', path: '/superadmin' }] : [])
    ] : [])
  ]

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
    <div style={{ display: "flex", height: "100vh", backgroundColor: theme.colors.gray.light }}>
      
      {/* --- SIDEBAR --- */}
      <div style={{
        width: sidebarOpen ? "280px" : "80px",
        backgroundColor: theme.colors.black,
        color: theme.colors.white,
        padding: theme.spacing.lg,
        transition: "width 0.3s",
        overflowY: "auto",
        borderRight: `1px solid #333`
      }}>
        
        {/* Logo/Brand */}
        <div style={{ 
          fontSize: "20px", 
          fontWeight: "bold", 
          marginBottom: theme.spacing.xxl,
          textAlign: sidebarOpen ? "left" : "center",
          color: theme.colors.white
        }}>
          {sidebarOpen ? "CRM" : "C"}
        </div>

        {/* Menu Items */}
        <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: "transparent",
                border: "none",
                color: theme.colors.white,
                padding: `${theme.spacing.md} ${theme.spacing.lg}`,
                textAlign: sidebarOpen ? "left" : "center",
                cursor: "pointer",
                borderRadius: theme.borderRadius.lg,
                fontSize: "14px",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: sidebarOpen ? "flex-start" : "center"
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#333"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              title={item.label}
            >
              <span>{sidebarOpen ? item.label : item.label.charAt(0)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* --- MAIN CONTENT --- */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* Top Header */}
        <div style={{
          background: theme.colors.white,
          padding: `${theme.spacing.lg} ${theme.spacing.xxl}`,
          borderBottom: `1px solid ${theme.colors.gray.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: "transparent",
                border: `1px solid ${theme.colors.gray.disabled}`,
                padding: theme.spacing.md,
                borderRadius: theme.borderRadius.md,
                cursor: "pointer",
                fontSize: "16px"
              }}
            >
              ☰
            </button>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#333" }}>
            Welcome, {currentUser.full_name}
          </h1>
          
          {/* Top Right - Notifications & Profile */}
          <div style={{ display: "flex", alignItems: "center", gap: theme.spacing.xl }}>
            {/* Notifications */}
            <button
              onClick={() => navigate('/notifications')}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: theme.spacing.md,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = "0.7"}
              onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
              title="Notifications"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </button>

            {/* User Avatar & Menu */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  background: theme.colors.primary,
                  color: theme.colors.white,
                  border: "none",
                  width: "40px",
                  height: "40px",
                  borderRadius: theme.borderRadius.full,
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.primaryDark}
                onMouseLeave={(e) => e.currentTarget.style.background = theme.colors.primary}
              >
                {getInitials(currentUser.full_name)}
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div style={{
                  position: "absolute",
                  top: "50px",
                  right: "0",
                  background: theme.colors.white,
                  border: `1px solid ${theme.colors.gray.border}`,
                  borderRadius: theme.borderRadius.lg,
                  boxShadow: theme.shadows.lg,
                  minWidth: "200px",
                  zIndex: 1000
                }}>
                  <div style={{ padding: theme.spacing.md, borderBottom: `1px solid ${theme.colors.gray.light}` }}>
                    <p style={{ margin: "0 0 5px 0", fontSize: "14px", fontWeight: "bold", color: "#333" }}>
                      {currentUser.full_name}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: theme.colors.gray.textLight }}>
                      {currentUser.email}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => {
                      navigate('/profile')
                      setShowUserMenu(false)
                    }}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: theme.spacing.md,
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "#333",
                      transition: "background 0.2s",
                      borderBottom: `1px solid ${theme.colors.gray.light}`
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = theme.colors.gray.lighter}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Profile
                  </button>

                  <button
                    onClick={() => {
                      localStorage.removeItem('crm_token')
                      navigate('/login')
                      setShowUserMenu(false)
                    }}
                    style={{
                      width: "100%",
                      background: "transparent",
                      border: "none",
                      padding: theme.spacing.md,
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: theme.colors.error,
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#fff1f0"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Feed Content */}
        <div style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: theme.spacing.xxl
        }}>
          <h2 style={{ color: "#333", marginTop: 0 }}>Live Feed - Recent Requests</h2>
          
          {requests.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: theme.spacing.xxl,
              color: theme.colors.gray.textLight
            }}>
              No requests yet. Get started by creating one!
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.lg }}>
              {requests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => navigate(`/requests/${request.id}`)}
                  style={{
                    background: theme.colors.white,
                    padding: theme.spacing.lg,
                    borderRadius: theme.borderRadius.lg,
                    border: `1px solid ${theme.colors.gray.border}`,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    boxShadow: theme.shadows.sm
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = theme.shadows.md
                    e.currentTarget.style.transform = "translateX(5px)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = theme.shadows.sm
                    e.currentTarget.style.transform = "translateX(0)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: "0 0 5px 0", color: "#333" }}>
                        {request.title}
                      </h3>
                      <p style={{ margin: "0 0 8px 0", color: theme.colors.gray.text, fontSize: "14px" }}>
                        {request.description || "No description"}
                      </p>
                      <div style={{ display: "flex", gap: theme.spacing.lg, fontSize: "12px", color: theme.colors.gray.textLight }}>
                        <span>{request.assignee?.full_name || "Unassigned"}</span>
                        <span>{new Date(request.created_at).toLocaleDateString()}</span>
                        <span>{request.department?.name || "Unknown"}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: theme.spacing.md }}>
                      <div style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        background: getStatusColor(request.status),
                        color: getStatusTextColor(request.status),
                        textAlign: "center"
                      }}>
                        {request.status?.replace(/_/g, " ").toUpperCase()}
                      </div>
                      <div style={{
                        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        background: `${getPriorityColor(request.priority)}20`,
                        color: getPriorityColor(request.priority),
                        textAlign: "center"
                      }}>
                        {request.priority?.toUpperCase()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard