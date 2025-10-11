import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { Loader2 } from 'lucide-react'

const DashboardRouter = () => {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect based on user role
      if (user.role === 'admin') {
        navigate('/dashboard/admin', { replace: true })
      } else if (user.role === 'manager') {
        navigate('/dashboard/manager', { replace: true })
      } else {
        navigate('/dashboard/my-work', { replace: true })
      }
    }
  }, [user, isLoading, navigate])

  // Show loading while determining user role
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  )
}

export default DashboardRouter
