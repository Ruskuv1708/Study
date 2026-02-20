import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Profile from '../pages/Profile'
import RequestsPage from '../features/requests/RequestsPage'
import AssignedRequestsPage from '../features/requests/AssignedRequestsPage'
import DepartmentsPage from '../features/requests/DepartmentsPage'
import RequestsHistoryPage from '../features/requests/RequestsHistoryPage'
import TemplatesPage from '../features/forms/TemplatesPage'
import FormFillPage from '../features/forms/FormFillPage'
import FormRecordsPage from '../features/forms/FormRecordsPage'
import FormQueuePage from '../features/forms/FormQueuePage'
import TemplateBuilderPage from '../features/forms/TemplateBuilderPage'
import AdminPanel from '../pages/AdminPanel'
import WorkspaceManagementPanel from '../pages/WorkspaceManagementPanel'
import RequestDetailsPage from '../features/requests/RequestDetailsPage'
import AppLayout from '../layouts/AppLayout'
import FilesPage from '../pages/FilesPage'
import ReportsPage from '../pages/ReportsPage'
import CompanyClientRegistrationPage from '../pages/CompanyClientRegistrationPage'


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/requests/assigned" element={<AssignedRequestsPage />} />
          <Route path="/requests/my" element={<Navigate to="/requests/assigned" replace />} />
          <Route path="/requests/history" element={<RequestsHistoryPage />} />
          <Route path="/requests/:id" element={<RequestDetailsPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/registry" element={<CompanyClientRegistrationPage />} />
          <Route path="/forms" element={<TemplatesPage />} />
          <Route path="/forms/new" element={<TemplateBuilderPage />} />
          <Route path="/forms/:id/edit" element={<TemplateBuilderPage />} />
          <Route path="/forms/:id/fill" element={<FormFillPage />} />
          <Route path="/forms/:id/records" element={<FormRecordsPage />} />
          <Route path="/forms/:id/queue" element={<FormQueuePage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/superadmin" element={<WorkspaceManagementPanel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
