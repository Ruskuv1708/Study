// RequestDetailsPage.tsx

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { type RequestItem } from './types';
import { roleMatches } from '../../shared/roleLabels';
import { getWorkspaceParams } from '../../shared/workspace';
import type { FormTemplate, FormRecord } from '../forms/types';
import useIsMobile from '../../shared/useIsMobile';

interface Props {}

const normalizeId = (value?: string | null): string | null => value ? value.toLowerCase() : null
const areIdsEqual = (a?: string | null, b?: string | null) => {
  if (!a || !b) return false
  return normalizeId(a) === normalizeId(b)
}

function RequestDetailsPage(_props: Props) {
  const { id } = useParams(); // Здесь мы получили идентификатор запроса из маршрута
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [record, setRecord] = useState<FormRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [unassigning, setUnassigning] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [departmentUsers, setDepartmentUsers] = useState<any[]>([])
  const [assignedDisplayName, setAssignedDisplayName] = useState<string | null>(null)
  const isMobile = useIsMobile()

  // Функция для загрузки деталей конкретного запроса
  const loadRequestDetails = async (user?: any) => {
    const token = localStorage.getItem('crm_token');
    if (!token) return window.location.href = '/login';

    try {
      const res = await axios.get(`/workflow/requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(user),
      });
      setRequest(res.data);
    } catch (err) {
      console.error('Failed to load request details:', err);
      alert('Couldn’t load request details.');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentUser = async () => {
    const token = localStorage.getItem('crm_token');
    if (!token) return
    try {
      const res = await axios.get('/access/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      setCurrentUser(res.data)
      return res.data
    } catch (err) {
      console.error('Failed to load user', err)
    }
  }

  useEffect(() => {
    ;(async () => {
      const user = await loadCurrentUser()
      await loadRequestDetails(user)
    })()
  }, [])

  useEffect(() => {
    fetchDepartmentUsers(request?.department_id)
  }, [request?.department_id])

  useEffect(() => {
    if (!request) return
    if (request.assigned_to_id) {
      fetchAssignedName(request.assigned_to_id)
    } else {
      setAssignedDisplayName(null)
    }
  }, [request?.assigned_to_id])

  const fetchRecord = async () => {
    if (!id) return
    const token = localStorage.getItem('crm_token');
    if (!token) return
    try {
      const res = await axios.get(`/forms/records/by-request/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser)
      })
      setRecord(res.data)
    } catch (err) {
      console.warn('Unable to load record data', err)
    }
  }

  const fetchTemplate = async (templateId?: string | null) => {
    if (!templateId) return
    const token = localStorage.getItem('crm_token');
    if (!token) return
    try {
      const res = await axios.get(`/forms/templates/${templateId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser)
      })
      setTemplate(res.data)
    } catch (err) {
      console.warn('Unable to load template', err)
    }
  }

  useEffect(() => {
    if (!request?.id) return
    fetchRecord()
  }, [request?.id])

  useEffect(() => {
    const templateId = request?.meta_data?.template_id as string | undefined
    if (!templateId) return
    fetchTemplate(templateId)
  }, [request?.meta_data?.template_id])

  const canUnassign = Boolean(
    request?.assigned_to_id &&
    currentUser &&
    (roleMatches(currentUser.role, ['SUPERADMIN','SYSTEM_ADMIN','ADMIN']) ||
      (roleMatches(currentUser.role, ['MANAGER']) && areIdsEqual(currentUser.department_id, request.department_id)))
  )

  const isOwnerOrAssignee = Boolean(
    currentUser &&
    request &&
    (areIdsEqual(request.created_by_id, currentUser.id) || areIdsEqual(request.assigned_to_id, currentUser.id))
  )

  const canChangeStatus = Boolean(
    currentUser &&
    request &&
    !roleMatches(currentUser.role, ['VIEWER']) &&
    (
      roleMatches(currentUser.role, ['SUPERADMIN', 'SYSTEM_ADMIN', 'ADMIN']) ||
      (roleMatches(currentUser.role, ['MANAGER']) &&
        (isOwnerOrAssignee || areIdsEqual(request.department_id, currentUser.department_id))) ||
      (!roleMatches(currentUser.role, ['MANAGER']) && isOwnerOrAssignee)
    )
  )

  const fetchDepartmentUsers = async (departmentId?: string) => {
    if (!departmentId) {
      setDepartmentUsers([])
      return
    }
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      const res = await axios.get(`/access/departments/${departmentId}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setDepartmentUsers(res.data)
    } catch (err) {
      console.error('Failed to load department users', err)
    }
  }

  const fetchAssignedName = async (userId?: string | null) => {
    if (!userId) {
      setAssignedDisplayName(null)
      return
    }
    const token = localStorage.getItem('crm_token')
    if (!token) return
    try {
      const res = await axios.get(`/access/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setAssignedDisplayName(res.data.full_name || null)
    } catch (err) {
      console.warn('Unable to load assigned user name', err)
      setAssignedDisplayName(null)
    }
  }

  const handleUnassign = async () => {
    if (!request) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    if (!window.confirm('Remove the assignee from this request?')) return
    setUnassigning(true)
    try {
      const res = await axios.post(`/workflow/requests/${request.id}/unassign`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        params: getWorkspaceParams(currentUser)
      })
      setRequest(res.data)
    } catch (err) {
      console.error('Failed to unassign', err)
      alert('Unable to remove assignee')
    } finally {
      setUnassigning(false)
    }
  }

  const handleStatusChange = async (nextStatus: RequestItem['status']) => {
    if (!request || !currentUser) return
    if (nextStatus === request.status) return
    const token = localStorage.getItem('crm_token')
    if (!token) return
    setStatusUpdating(true)
    try {
      await axios.put(
        `/workflow/requests/${request.id}/status`,
        { status: nextStatus },
        {
          headers: { Authorization: `Bearer ${token}` },
          params: getWorkspaceParams(currentUser)
        }
      )
      setRequest(prev => (prev ? { ...prev, status: nextStatus } : prev))
    } catch (err: any) {
      console.error('Failed to update request status', err)
      alert(err?.response?.data?.detail || 'Failed to update status')
    } finally {
      setStatusUpdating(false)
    }
  }

  if (loading) return <div>Loading...</div>;

  if (!request) return <div>Request not found!</div>;

  const assignedName = assignedDisplayName || request.assignee?.full_name || departmentUsers.find(u => u.id === request.assigned_to_id)?.full_name || 'Unknown'
  const showStatus = template ? template.schema_structure?.some(f => ['status'].includes(f.key?.toLowerCase() || '') || ['status'].includes(f.label?.toLowerCase() || '')) : true
  const showPriority = template ? template.schema_structure?.some(f => ['priority'].includes(f.key?.toLowerCase() || '') || ['priority'].includes(f.label?.toLowerCase() || '')) : true
  const fields = template?.schema_structure || []

  return (
    <div className="crm-page-shell" style={{ maxWidth: '800px', margin: 'auto', padding: isMobile ? '16px' : '40px', fontFamily: 'Arial, sans-serif' }}>
      <Link to='/requests'>
        <button style={{ background: 'none', border: 'none', padding: 0, color: 'blue', cursor: 'pointer', marginBottom: '10px' }}>
          ← Back to Requests
        </button>
      </Link>
      <h1 style={{ marginBottom: '20px' }}>{request.title}</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ fontSize: '14px', color: 'gray' }}>
          {showStatus && (<><b>Status:</b> {request.status}<br/></>)}
          {showPriority && (<><b>Priority:</b> {request.priority}<br/></>)}
          <b>Department:</b> {request.department_id || 'N/A'}
        </p>
        {canChangeStatus && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#555' }}>Status</label>
            <select
              value={request.status}
              onChange={e => handleStatusChange(e.target.value as RequestItem['status'])}
              disabled={statusUpdating}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #d9d9d9',
                background: '#fff',
                cursor: statusUpdating ? 'not-allowed' : 'pointer',
              }}
            >
              <option value="new">NEW</option>
              <option value="assigned">ASSIGNED</option>
              <option value="in_process">IN PROCESS</option>
              <option value="pending">PENDING</option>
              <option value="done">DONE</option>
            </select>
          </div>
        )}
          {request.assigned_to_id && (
            <div style={{ fontSize: '12px', color: '#333' }}>
              <strong>Assigned to:</strong> {assignedName}
            {canUnassign && (
              <button
                onClick={handleUnassign}
                disabled={unassigning}
                style={{
                  marginLeft: '10px',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid #f5222d',
                  background: unassigning ? '#ffa39e' : 'white',
                  cursor: unassigning ? 'not-allowed' : 'pointer'
                }}
              >
                {unassigning ? 'Unassigning…' : 'Unassign'}
              </button>
            )}
          </div>
        )}
      </div>

      <hr style={{ margin: '20px 0' }} />

      {record && fields.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ marginBottom: '6px' }}>Submitted Data</h3>
          <div style={{
            border: '1px solid #eee',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {fields.map(field => (
              <div key={field.key} style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '180px 1fr',
                padding: '10px 12px',
                borderBottom: '1px solid #f0f0f0',
                background: '#fff'
              }}>
                <div style={{ fontWeight: 600, color: '#555' }}>{field.label}</div>
                <div>{String(record.entry_data?.[field.key] ?? '')}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '16px', lineHeight: '1.5em' }}>
          {request.description || 'No Description Provided.'}
        </pre>
      )}
    </div>
  );
}

export default RequestDetailsPage;
