import { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault() // Stop page reload
    setError("")

    // 1. Prepare Form Data (OAuth2 expects x-www-form-urlencoded)
    const formData = new FormData()
    formData.append('username', email) // Backend expects 'username', not 'email'
    formData.append('password', password)

    try {
      // 2. Send Request
      const response = await axios.post('/access/token', formData)
      
      // 3. Save the Token (The "ID Card")
      const token = response.data.access_token
      localStorage.setItem('crm_token', token)
      
      // 4. Redirect to Dashboard
      navigate('/dashboard')
      
    } catch (err) {
      console.error(err)
      setError("Invalid credentials")
    }
  }

  // Minimalistic Design
  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: "100px", fontFamily: "sans-serif" }}>
      <form onSubmit={handleLogin} style={{ width: "300px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <h2>Login</h2>
        
        <input 
          type="email" 
          placeholder="Email" 
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ padding: "10px", fontSize: "16px" }}
        />
        
        <input 
          type="password" 
          placeholder="Password" 
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ padding: "10px", fontSize: "16px" }}
        />
        
        <button type="submit" style={{ padding: "10px", cursor: "pointer", backgroundColor: "black", color: "white", border: "none" }}>
          Sign In
        </button>

        {error && <p style={{ color: "red", fontSize: "14px" }}>{error}</p>}
      </form>
    </div>
  )
}

export default Login
