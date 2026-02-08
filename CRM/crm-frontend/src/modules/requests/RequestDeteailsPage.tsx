// RequestDetailsPage.tsx

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { type RequestItem } from './types';

interface Props {}

function RequestDetailsPage(_props: Props) {
  const { id } = useParams(); // Здесь мы получили идентификатор запроса из маршрута
  const [request, setRequest] = useState<RequestItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Функция для загрузки деталей конкретного запроса
  const loadRequestDetails = async () => {
    const token = localStorage.getItem('crm_token');
    if (!token) return window.location.href = '/login';

    try {
      const res = await axios.get(`http://127.0.0.1:8000/workflow/requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequest(res.data);
    } catch (err) {
      console.error('Failed to load request details:', err);
      alert('Couldn’t load request details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequestDetails();
  }, []); // пустой массив зависимостей означает один раз вызвать эффект при монтировании компонента

  if (loading) return <div>Loading...</div>;

  if (!request) return <div>Request not found!</div>;

  return (
    <div style={{ maxWidth: '800px', margin: 'auto', padding: '40px', fontFamily: 'Arial, sans-serif' }}>
      <Link to='/requests'>
        <button style={{ float: 'right', background: 'none', border: 'none', padding: 0, color: 'blue', cursor: 'pointer' }}>
          ← Back to Requests
        </button>
      </Link>
      <h1 style={{ marginBottom: '20px' }}>{request.title}</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <p style={{ fontSize: '14px', color: 'gray' }}>
          <b>Status:</b> {request.status}<br/>
          <b>Priority:</b> {request.priority}<br/>
          <b>Department:</b> {request.department_id || 'N/A'}
        </p>
      </div>

      <hr style={{ margin: '20px 0' }} />

      <pre style={{ whiteSpace: 'pre-wrap', fontSize: '16px', lineHeight: '1.5em' }}>
        {request.description || 'No Description Provided.'}
      </pre>
    </div>
  );
}

export default RequestDetailsPage;
