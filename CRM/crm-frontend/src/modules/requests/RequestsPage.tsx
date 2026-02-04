import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { type RequestItem, type RequestCreatePayload, type Department } from './types'

function RequestsPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([]) // <--- Store Depts
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [isCreating, setIsCreating] = useState(false)
  const [newReq, setNewReq] = useState<RequestCreatePayload>({ 
    title: "", 
    description: "", 
    priority: "medium",
    department_id: "" // <--- Mandatory
  })

  // 1. Fetch Data (Requests AND Departments)
  const fetchData = async () => {
    const token = localStorage.getItem('crm_token')
    if (!token) return navigate('/')

    try {
      // Parallel Fetch
      const [reqRes, deptRes] = await Promise.all([
        axios.get('http://127.0.0.1:8000/workflow/requests', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('http://127.0.0.1:8000/workflow/departments', { headers: { Authorization: `Bearer ${token}` } })
      ])

      setRequests(reqRes.data)
      setDepartments(deptRes.data)
      
      // Auto-select first department if available
      if (deptRes.data.length > 0) {
        setNewReq(prev => ({...prev, department_id: deptRes.data[0].id}))
      }
      
      setLoading(false)
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // 2. Handle Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('crm_token')
    
    if (!newReq.department_id) {
      alert("Please create a Department first!")
      return
    }

    try {
      await axios.post('http://127.0.0.1:8000/workflow/requests', newReq, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setIsCreating(false)
      setNewReq({ title: "", description: "", priority: "medium", department_id: departments[0]?.id || "" })
      fetchData() // Refresh list
    } catch (err) {
      alert("Failed to create request")
    }
  }

  // 3. Helper for Colors
  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'critical': return '#ff4d4f';
      case 'high': return '#faad14';
      case 'medium': return '#1890ff';
      default: return '#52c41a';
    }
  }

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px", fontFamily: "sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0 }}>All Requests</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ background: "none", border: "none", padding: 0, color: "gray", cursor: "pointer", marginTop: "5px" }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            onClick={() => navigate('/departments')}
            style={{ background: "white", border: "1px solid #ccc", height: "40px" }}
          >
            Manage Departments
          </button>
          <button 
            onClick={() => setIsCreating(!isCreating)}
            style={{ background: "black", color: "white", height: "40px" }}
          >
            {isCreating ? "Cancel" : "+ New Request"}
          </button>
        </div>
      </div>

      {/* Create Form */}
      {isCreating && (
        <div style={{ padding: "20px", border: "1px solid #eee", borderRadius: "8px", marginBottom: "30px", background: "#f9f9f9" }}>
          <h3>New Request</h3>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            
            {/* Department Selector */}
            <label style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "gray" }}>Department</label>
            <select 
              value={newReq.department_id}
              onChange={e => setNewReq({...newReq, department_id: e.target.value})}
              style={{ padding: "10px" }}
              required
            >
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <label style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "gray" }}>Details</label>
            <input 
              placeholder="Title" 
              value={newReq.title}
              onChange={e => setNewReq({...newReq, title: e.target.value})}
              required
              style={{ padding: "10px" }}
            />
            <textarea 
              placeholder="Description..." 
              value={newReq.description}
              onChange={e => setNewReq({...newReq, description: e.target.value})}
              style={{ padding: "10px", minHeight: "80px" }}
            />
            
            <label style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "gray" }}>Priority</label>
            <select 
              value={newReq.priority}
              onChange={e => setNewReq({...newReq, priority: e.target.value})}
              style={{ padding: "10px" }}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            
            <button type="submit" style={{ background: "#1890ff", color: "white", padding: "10px", marginTop: "10px" }}>Submit Request</button>
          </form>
        </div>
      )}

      {/* The List */}
      {loading ? <p>Loading...</p> : (
        <div style={{ display: "grid", gap: "15px" }}>
          {requests.length === 0 && <p style={{color: "gray"}}>No requests found.</p>}
          
          {requests.map(req => (
            <div key={req.id} style={{ 
              border: "1px solid #eee", 
              borderRadius: "8px", 
              padding: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "white",
              boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 style={{ margin: 0 }}>{req.title}</h3>
                  <span style={{ 
                    fontSize: "12px", 
                    padding: "2px 8px", 
                    borderRadius: "10px", 
                    color: "white",
                    backgroundColor: getPriorityColor(req.priority)
                  }}>
                    {req.priority.toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: "5px 0 0 0", color: "gray", fontSize: "14px" }}>
                  Status: <strong>{req.status.replace("_", " ").toUpperCase()}</strong> • 
                  Dept: <strong>{departments.find(d => d.id === req.department_id)?.name || "Unknown"}</strong>
                </p>
              </div>
              <button style={{ border: "1px solid #ccc", background: "white" }}>View Details</button>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default RequestsPage