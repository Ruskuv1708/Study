import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './Login'
import Dashboard from './Dashboard'
import Profile from './Profile'
import RequestsPage from './modules/requests/RequestsPage'
import DepartmentsPage from './modules/requests/DepartmentsPage'
import AdminPanel from './pages/AdminPanel'              // ✅ Updated path
import SuperadminPanel from './pages/SuperadminPanel'    // ✅ Updated path
import RequestDetailsPage from './modules/requests/RequestDeteailsPage' // ✅ Added import for RequestDetailsPage


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/requests" element={<RequestsPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/superadmin" element={<SuperadminPanel />} />
        <Route path="/requests/:id" element={<RequestDetailsPage />} /> {/* ✅ Added route for RequestDetailsPage */}
      </Routes>
    </BrowserRouter>
  )
}

export default App