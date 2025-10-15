import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, Phone, Mail, MapPin, Settings, FileText } from 'lucide-react'

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  created_at: string
  total_machines: number
  active_tickets: number
}

export function CustomersPage() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data for now
  useEffect(() => {
    const mockCustomers: Customer[] = [
      {
        id: '1',
        name: 'ABC Company',
        email: 'contact@abc.com',
        phone: '+387 33 123 456',
        address: 'Sarajevo, Bosnia and Herzegovina',
        created_at: '2024-01-15',
        total_machines: 5,
        active_tickets: 2
      },
      {
        id: '2',
        name: 'XYZ Corporation',
        email: 'info@xyz.com',
        phone: '+387 33 789 012',
        address: 'Mostar, Bosnia and Herzegovina',
        created_at: '2024-02-20',
        total_machines: 3,
        active_tickets: 1
      }
    ]
    
    setTimeout(() => {
      setCustomers(mockCustomers)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  )

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="card-mobile">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <button
            onClick={() => navigate('/customers/new')}
            className="btn-mobile bg-primary-600 text-white"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-mobile pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-mobile text-center">
          <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{customers.length}</div>
          <div className="text-sm text-gray-600">Total Customers</div>
        </div>
        <div className="card-mobile text-center">
          <Users className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {customers.reduce((sum, c) => sum + c.active_tickets, 0)}
          </div>
          <div className="text-sm text-gray-600">Active Tickets</div>
        </div>
      </div>

      {/* Customers List */}
      <div className="space-y-3">
        {loading ? (
          <div className="card-mobile text-center py-8">
            <div className="text-gray-600">Loading customers...</div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="card-mobile text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Create your first customer to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/customers/new')}
                className="btn-mobile bg-primary-600 text-white"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Customer
              </button>
            )}
          </div>
        ) : (
          filteredCustomers.map((customer) => (
            <div
              key={customer.id}
              onClick={() => navigate(`/customers/${customer.id}`)}
              className="card-mobile cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{customer.name}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Mail className="h-4 w-4" />
                      <span>{customer.email}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="h-4 w-4" />
                      <span>{customer.phone}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <Settings className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">{customer.total_machines} machines</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FileText className="h-4 w-4 text-gray-500" />
                    <span className="text-gray-600">{customer.active_tickets} active</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Added {new Date(customer.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
