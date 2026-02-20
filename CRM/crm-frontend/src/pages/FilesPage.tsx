import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function FilesPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/reports', { replace: true })
  }, [navigate])

  return null
}

export default FilesPage
