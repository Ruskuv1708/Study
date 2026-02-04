import { useEffect, useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { type Department, type DepartmentCreatePayload } from './types'

function DepartmentsPage() {
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [newDept, setNewDept] = useState<DepartmentCreatePayload>({ name: "", description: "" })

  // 1. Fetch Data
  const fetchDepartments = () => {
    const token = localStorage.getItem('crm_token')
    if (!token) return navigate('/')

    axios.get('http://127.0.0.1:8000/workflow/departments', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      setDepartments(res.data)
      setLoading(false)
    })
    .catch(err => console.error(err))
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  // 2. Handle Create
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = localStorage.getItem('crm_token')
    
    try {
      await axios.post('http://127.0.0.1:8000/workflow/departments', newDept, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setNewDept({ name: "", description: "" })
      fetchDepartments() // Refresh list
    } catch (err) {
      alert("Failed to create department")
    }
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px", fontFamily: "sans-serif" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "30px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Departments</h1>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{ background: "none", border: "none", padding: 0, color: "gray", cursor: "pointer", marginTop: "5px" }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Create Form */}
      <div style={{ padding: "20px", border: "1px solid #eee", borderRadius: "8px", marginBottom: "30px", background: "#f9f9f9" }}>
        <h3>Add New Department</h3>
        <form onSubmit={handleCreate} style={{ display: "flex", gap: "10px" }}>
          <input 
            placeholder="Name (e.g. IT Support)" 
            value={newDept.name}
            onChange={e => setNewDept({...newDept, name: e.target.value})}
            required
            style={{ padding: "10px", flex: 1 }}
          />
          <input 
            placeholder="Description (Optional)" 
            value={newDept.description}
            onChange={e => setNewDept({...newDept, description: e.target.value})}
            style={{ padding: "10px", flex: 2 }}
          />
          <button type="submit" style={{ background: "black", color: "white", padding: "10px 20px" }}>Add</button>
        </form>
      </div>

      {/* The List */}
      {loading ? <p>Loading...</p> : (
        <div style={{ display: "grid", gap: "15px" }}>
          {departments.length === 0 && <p style={{color: "gray"}}>No departments found. Create one above.</p>}
          
          {departments.map(dept => (
            <div key={dept.id} style={{ 
              border: "1px solid #eee", 
              borderRadius: "8px", 
              padding: "20px",
              background: "white",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <h3 style={{ margin: 0 }}>{dept.name}</h3>
                <p style={{ margin: "5px 0 0 0", color: "gray" }}>{dept.description || "No description"}</p>
              </div>
              <span style={{ fontSize: "12px", background: "#eee", padding: "4px 8px", borderRadius: "4px" }}>
                ID: {dept.id.substring(0, 8)}...
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default DepartmentsPage