import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, FileText, Clock, CheckCircle, AlertCircle, User } from 'lucide-react'

interface RepairTicket {
  id: string
  ticket_number: string
  customer_name: string
  machine_model: string
  status: string
  priority: string
  created_at: string
  assigned_to: string
}

export function RepairTicketsPage() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<RepairTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Mock data
  useEffect(() => {
    const mockTickets: RepairTicket[] = [
      {
        id: '1',
        ticket_number: 'RT-2024-001',
        customer_name: 'ABC Company',
        machine_model: 'HDS 8/18-4 C',
        status: 'in_progress',
        priority: 'high',
        created_at: '2024-10-14',
        assigned_to: 'John Doe'
      },
      {
        id: '2',
        ticket_number: 'RT-2024-002',
        customer_name: 'XYZ Corp',
        machine_model: 'NT 65/2',
        status: 'pending',
        priority: 'medium',
        created_at: '2024-10-13',
        assigned_to: 'Jane Smith'
      }
    ]
    
    setTimeout(() => {
      setTickets(mockTickets)
      setLoading(false)
    }, 1000)
  }, [])

  const filteredTickets = tickets.filter(ticket =>
    ticket.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ticket.machine_model.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />
      case 'pending':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="card-mobile">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Repair Tickets</h1>
          <button
            onClick={() => navigate('/repair-tickets/new')}
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
            placeholder="Search tickets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-mobile pl-10"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card-mobile text-center">
          <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {tickets.filter(t => t.status === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">Pending</div>
        </div>
        <div className="card-mobile text-center">
          <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {tickets.filter(t => t.status === 'in_progress').length}
          </div>
          <div className="text-sm text-gray-600">In Progress</div>
        </div>
        <div className="card-mobile text-center">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <div className="text-2xl font-bold text-gray-900">
            {tickets.filter(t => t.status === 'completed').length}
          </div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {loading ? (
          <div className="card-mobile text-center py-8">
            <div className="text-gray-600">Loading tickets...</div>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="card-mobile text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'Try adjusting your search terms' : 'Create your first repair ticket'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/repair-tickets/new')}
                className="btn-mobile bg-primary-600 text-white"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Ticket
              </button>
            )}
          </div>
        ) : (
          filteredTickets.map((ticket) => (
            <div
              key={ticket.id}
              onClick={() => navigate(`/repair-tickets/${ticket.id}`)}
              className="card-mobile cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="font-semibold text-gray-900">{ticket.ticket_number}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>Customer: {ticket.customer_name}</div>
                    <div>Machine: {ticket.machine_model}</div>
                    <div className="flex items-center space-x-1">
                      <User className="h-4 w-4" />
                      <span>Assigned to: {ticket.assigned_to}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-2">
                  {getStatusIcon(ticket.status)}
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="text-xs text-gray-500 border-t border-gray-200 pt-2">
                Created {new Date(ticket.created_at).toLocaleDateString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
