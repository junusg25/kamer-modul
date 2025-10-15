import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  Camera, 
  FileText, 
  Plus, 
  Clock, 
  CheckCircle,
  AlertCircle,
  TrendingUp
} from 'lucide-react'

export function HomePage() {
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const quickActions = [
    {
      icon: Plus,
      title: 'New Ticket',
      description: 'Create a repair ticket',
      color: 'bg-blue-500',
      onClick: () => navigate('/tickets/new')
    },
    {
      icon: Camera,
      title: 'Take Photo',
      description: 'Capture machine photos',
      color: 'bg-green-500',
      onClick: () => navigate('/camera')
    },
    {
      icon: FileText,
      title: 'View Tickets',
      description: 'Browse all tickets',
      color: 'bg-purple-500',
      onClick: () => navigate('/tickets')
    }
  ]

  const stats = [
    { label: 'Active Tickets', value: '12', icon: Clock, color: 'text-yellow-600' },
    { label: 'Completed Today', value: '5', icon: CheckCircle, color: 'text-green-600' },
    { label: 'Urgent', value: '2', icon: AlertCircle, color: 'text-red-600' },
    { label: 'This Week', value: '28', icon: TrendingUp, color: 'text-blue-600' }
  ]

  if (!isAuthenticated) {
    return (
      <div className="p-4">
        <div className="card-mobile text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Welcome to RepairShop</h2>
          <p className="text-gray-600 mb-6">Please log in to access the mobile app</p>
          <button
            onClick={() => navigate('/login')}
            className="btn-mobile bg-primary-600 text-white w-full"
          >
            Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      {/* Welcome Section */}
      <div className="card-mobile">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your repair tickets today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card-mobile text-center">
              <Icon className={`h-8 w-8 mx-auto mb-2 ${stat.color}`} />
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.label}</div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="card-mobile">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="space-y-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.title}
                onClick={action.onClick}
                className="w-full flex items-center space-x-4 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className={`p-3 rounded-lg ${action.color}`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{action.title}</div>
                  <div className="text-sm text-gray-600">{action.description}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card-mobile">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Ticket #1234 completed</div>
              <div className="text-xs text-gray-600">2 hours ago</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">New ticket #1235 created</div>
              <div className="text-xs text-gray-600">4 hours ago</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Ticket #1233 updated</div>
              <div className="text-xs text-gray-600">6 hours ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
