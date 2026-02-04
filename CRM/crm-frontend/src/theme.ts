export const theme = {
  colors: {
    // Primary Colors
    primary: '#1890ff',
    primaryDark: '#0050b3',
    
    // Neutrals
    white: '#ffffff',
    black: '#1f1f1f',
    gray: {
      light: '#f5f5f5',
      lighter: '#f9f9f9',
      border: '#e0e0e0',
      text: '#666',
      textLight: '#999',
      disabled: '#ccc',
    },
    
    // Status Colors
    status: {
      new: '#e6f7ff',
      assigned: '#e6f7ff',
      in_progress: '#fff7e6',
      pending_approval: '#fff1f0',
      resolved: '#f6ffed',
      closed: '#f6ffed',
    },
    statusText: {
      new: '#1890ff',
      assigned: '#1890ff',
      in_progress: '#faad14',
      pending_approval: '#ff4d4f',
      resolved: '#52c41a',
      closed: '#52c41a',
    },
    
    // Priority Colors
    priority: {
      critical: '#ff4d4f',
      high: '#faad14',
      medium: '#1890ff',
      low: '#52c41a',
    },
    
    // Semantic
    success: '#52c41a',
    warning: '#faad14',
    error: '#ff4d4f',
    info: '#1890ff',
    
    // Role Colors
    roles: {
      superadmin: '#ff4d4f',
      admin: '#faad14',
      manager: '#1890ff',
      user: '#52c41a',
      viewer: '#999',
    },
  },
  
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '30px',
  },
  
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    full: '50%',
  },
  
  shadows: {
    sm: '0 2px 4px rgba(0,0,0,0.05)',
    md: '0 4px 12px rgba(0,0,0,0.1)',
    lg: '0 4px 12px rgba(0,0,0,0.15)',
  },
}

export default theme