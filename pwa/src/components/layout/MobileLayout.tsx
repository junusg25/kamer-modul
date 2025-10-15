import { ReactNode, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  Home, 
  Bell, 
  Plus,
  Menu,
  X,
  Users,
  Settings,
  FileText,
  Wrench,
  Shield,
  ClipboardList
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

interface MobileLayoutProps {
  children: ReactNode
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showMenu, setShowMenu] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)

  const isActive = (path: string) => location.pathname === path

  // Sidebar navigation items (matching main frontend)
  const sidebarItems = [
    { icon: Home, label: 'Dashboard', path: '/', color: 'text-blue-600' },
    { icon: Users, label: 'Customers', path: '/customers', color: 'text-green-600' },
    { icon: Settings, label: 'Machines', path: '/machines', color: 'text-purple-600' },
    { icon: FileText, label: 'Repair Tickets', path: '/repair-tickets', color: 'text-orange-600' },
    { icon: Shield, label: 'Warranty Tickets', path: '/warranty-repair-tickets', color: 'text-blue-600' },
    { icon: Wrench, label: 'Work Orders', path: '/work-orders', color: 'text-red-600' },
    { icon: ClipboardList, label: 'Warranty Orders', path: '/warranty-work-orders', color: 'text-indigo-600' },
  ]

  // Quick create options based on user role
  const getQuickCreateOptions = () => {
    const baseOptions = [
      { label: 'Repair Ticket', path: '/repair-tickets/new', icon: FileText },
      { label: 'Warranty Ticket', path: '/warranty-repair-tickets/new', icon: Shield },
    ]

    if (user?.role === 'admin') {
      return [
        { label: 'Customer', path: '/customers/new', icon: Users },
        { label: 'Machine', path: '/machines/new', icon: Settings },
        ...baseOptions,
      ]
    }

    return baseOptions
  }

  const quickCreateOptions = getQuickCreateOptions()

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {showMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <h1 className="text-xl font-bold text-gray-900">RepairShop</h1>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => navigate('/notifications')}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
            >
              <Bell className="h-5 w-5 text-gray-600" />
              {/* Notification badge */}
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                3
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar Menu Overlay */}
      {showMenu && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowMenu(false)}>
          <div className="bg-white w-72 h-full shadow-lg overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{user?.name}</h2>
                  <p className="text-sm text-gray-600 capitalize">{user?.role}</p>
                </div>
              </div>
            </div>
            <nav className="p-4 space-y-1">
              {sidebarItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path)
                      setShowMenu(false)
                    }}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      isActive(item.path) 
                        ? 'bg-primary-50 text-primary-600' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Quick Create Menu Overlay */}
      {showQuickCreate && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setShowQuickCreate(false)}>
          <div className="absolute bottom-20 left-4 right-4 bg-white rounded-lg shadow-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Create</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickCreateOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.path}
                    onClick={() => {
                      navigate(option.path)
                      setShowQuickCreate(false)
                    }}
                    className="flex flex-col items-center space-y-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <Icon className="h-8 w-8 text-primary-600" />
                    <span className="text-sm font-medium text-gray-900">{option.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="nav-mobile">
        <div className="flex justify-around items-center py-2">
          {/* Home */}
          <button
            onClick={() => navigate('/')}
            className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors min-w-0 flex-1 ${
              isActive('/') 
                ? 'text-primary-600 bg-primary-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Home className="h-6 w-6" />
            <span className="text-xs font-medium truncate">Home</span>
          </button>

          {/* Notifications */}
          <button
            onClick={() => navigate('/notifications')}
            className={`flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors min-w-0 flex-1 relative ${
              isActive('/notifications') 
                ? 'text-primary-600 bg-primary-50' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Bell className="h-6 w-6" />
            <span className="text-xs font-medium truncate">Alerts</span>
            {/* Notification badge */}
            <span className="absolute top-0 right-2 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          {/* Quick Create (+) */}
          <button
            onClick={() => setShowQuickCreate(!showQuickCreate)}
            className="flex flex-col items-center space-y-1 p-2 rounded-lg transition-colors min-w-0 flex-1"
          >
            <div className="w-12 h-12 bg-primary-600 rounded-full flex items-center justify-center shadow-lg">
              <Plus className="h-6 w-6 text-white" />
            </div>
            <span className="text-xs font-medium truncate">Create</span>
          </button>

          {/* Placeholder for symmetry */}
          <div className="flex-1"></div>
        </div>
      </nav>
    </div>
  )
}
