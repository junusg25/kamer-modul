import { useParams } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, MapPin, Settings, FileText, Plus } from 'lucide-react'

export function CustomerDetailPage() {
  const { id } = useParams()

  // Mock customer data
  const customer = {
    id: id || '1',
    name: 'ABC Company',
    email: 'contact@abc.com',
    phone: '+387 33 123 456',
    address: 'Sarajevo, Bosnia and Herzegovina',
    created_at: '2024-01-15',
    total_machines: 5,
    active_tickets: 2
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="card-mobile">
        <div className="flex items-center space-x-3 mb-4">
          <button className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">{customer.name}</h1>
        </div>

        {/* Customer Info */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <Mail className="h-5 w-5 text-gray-500" />
            <span className="text-gray-700">{customer.email}</span>
          </div>
          <div className="flex items-center space-x-3">
            <Phone className="h-5 w-5 text-gray-500" />
            <span className="text-gray-700">{customer.phone}</span>
          </div>
          <div className="flex items-center space-x-3">
            <MapPin className="h-5 w-5 text-gray-500" />
            <span className="text-gray-700">{customer.address}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card-mobile">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <button className="btn-mobile bg-blue-600 text-white">
            <Plus className="h-5 w-5 mr-2" />
            New Ticket
          </button>
          <button className="btn-mobile bg-green-600 text-white">
            <Settings className="h-5 w-5 mr-2" />
            Add Machine
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-mobile text-center">
          <Settings className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{customer.total_machines}</div>
          <div className="text-sm text-gray-600">Machines</div>
        </div>
        <div className="card-mobile text-center">
          <FileText className="h-8 w-8 text-orange-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{customer.active_tickets}</div>
          <div className="text-sm text-gray-600">Active Tickets</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card-mobile">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">New repair ticket created</div>
              <div className="text-xs text-gray-600">2 hours ago</div>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">Machine added</div>
              <div className="text-xs text-gray-600">1 day ago</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
