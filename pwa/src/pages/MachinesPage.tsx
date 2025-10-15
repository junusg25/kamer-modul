import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Settings, User, Calendar, Shield } from 'lucide-react'

interface Machine {
  id: string
  model_name: string
  serial_number: string
  customer_name: string
  purchase_date: string
  warranty_expiry: string
  status: string
  type: 'sold' | 'repair'
}

export function MachinesPage() {
  const navigate = useNavigate()
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data
  useEffect(() => {
    const mockMachines: Machine[] = [
      {
        id: '1',
        model_name: 'HDS 8/18-4 C',
        serial_number: '698259',
        customer_name: 'ABC Company',
        purchase_date: '2023-06-15',
        warranty_expiry: '2025-06-15',
        status: 'active',
        type: 'sold'
      },
      {
        id: '2',
        model_name: 'NT 65/2',
        serial_number: '123456',
        customer_name: 'XYZ Corp',
        purchase_date: '2023-08-20',
        warranty_expiry: '2025-08-20',
        status: 'repair',
        type: 'repair'
      }
    ]
    
    setTimeout(() => {
      setMachines(mockMachines)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredMachines = machines.filter(machine =>
    machine.model_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    machine.serial_number.includes(searchTerm) ||
    machine.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string, type: string) => {
    if (type === 'repair') {
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Repair</span>
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Sold</span>
  }

  const isWarrantyExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date()
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="card-mobile">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Machines</h1>
          <button
            onClick={() => navigate('/machines/new')}
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
            placeholder="Search machines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-mobile pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-mobile text-center">
          <Settings className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">{machines.length}</div>
          <div className="text-sm text-gray-600">Total</div>
        </div>
        <div className="card-mobile text-center">
          <Shield className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {machines.filter(m => m.type === 'sold' && !isWarrantyExpired(m.warranty_expiry)).length}
          </div>
          <div className="text-sm text-gray-600">Under Warranty</div>
        </div>
        <div className="card-mobile text-center">
          <Settings className="h-8 w-8 text-orange-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {machines.filter(m => m.type === 'repair').length}
          </div>
          <div className="text-sm text-gray-600">In Repair</div>
        </div>
      </div>

      {/* Machines List */}
      <div className="space-y-3">
        {loading ? (
          <div className="card-mobile text-center py-8">
            <div className="text-gray-600">Loading machines...</div>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="card-mobile text-center py-8">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No machines found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Add your first machine'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/machines/new')}
                className="btn-mobile bg-primary-600 text-white"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Machine
              </button>
            )}
          </div>
        ) : (
          filteredMachines.map((machine) => (
            <div
              key={machine.id}
              onClick={() => navigate(`/machines/${machine.id}`)}
              className="card-mobile cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{machine.model_name}</h3>
                    {getStatusBadge(machine.status, machine.type)}
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Serial: {machine.serial_number}</div>
                    <div>Customer: {machine.customer_name}</div>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Purchased: {new Date(machine.purchase_date).toLocaleDateString()}</span>
                    </div>
                    {machine.type === 'sold' && (
                      <div className="flex items-center space-x-1">
                        <Shield className={`h-4 w-4 ${isWarrantyExpired(machine.warranty_expiry) ? 'text-red-500' : 'text-green-500'}`} />
                        <span className={isWarrantyExpired(machine.warranty_expiry) ? 'text-red-600' : 'text-green-600'}>
                          Warranty: {isWarrantyExpired(machine.warranty_expiry) ? 'Expired' : 'Active'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
