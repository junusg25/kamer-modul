import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Clock,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Printer,
  Filter,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { DeleteConfirmationDialog } from '@/components/ui/delete-confirmation-dialog'
import { CompletedItemAlertDialog } from '@/components/ui/completed-item-alert-dialog'
import { apiService } from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { hasPermission } from '@/lib/permissions'
import { toast } from 'sonner'
import { formatDate } from '@/lib/dateTime'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'

interface RepairTicket {
  id: string
  ticket_number?: string
  formatted_number?: string
  customer_name?: string
  machine_name?: string
  model_name?: string
  serial_number?: string
  manufacturer?: string
  problem_description?: string
  status?: string
  priority?: string
  submitted_by_name?: string
  converted_by_technician_name?: string
  created_at: string
  updated_at: string
}

const getStatusBadge = (status?: string) => {
  if (!status) return <Badge variant="outline">Unknown</Badge>
  
  return (
    <Badge 
      variant={getStatusBadgeVariant(status)} 
      className={getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : undefined}
    >
      {formatStatus(status)}
    </Badge>
  )
}

const getPriorityBadge = (priority?: string) => {
  const priorityConfig = {
    low: { color: 'outline' as const, className: 'bg-green-50 text-green-700 border-green-200', label: 'Low' },
    medium: { color: 'outline' as const, className: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium' },
    high: { color: 'outline' as const, className: 'bg-red-50 text-red-700 border-red-200', label: 'High' }
  }
  
  const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
  
  return (
    <Badge variant={config.color} className={config.className}>
      {config.label}
    </Badge>
  )
}

export default function RepairTickets() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const [tickets, setTickets] = useState<RepairTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    technician: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(20)
  const [error, setError] = useState('')
  
  // Convert to work order state
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null)
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [users, setUsers] = useState<any[]>([])
  const [isConverting, setIsConverting] = useState(false)

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<RepairTicket | null>(null)
  const [convertedAlertOpen, setConvertedAlertOpen] = useState(false)
  const [convertedTicket, setConvertedTicket] = useState<RepairTicket | null>(null)

  useEffect(() => {
    fetchTickets()
  }, [appliedSearchTerm, filters, currentPage])

  const fetchTickets = async () => {
    try {
      setIsLoading(true)
      const searchParams: any = {
        page: currentPage,
        limit: pageSize
      }
      
      if (appliedSearchTerm) {
        searchParams.search = appliedSearchTerm
      }
      
      if (filters.status) {
        searchParams.status = filters.status
      }
      
      if (filters.priority) {
        searchParams.priority = filters.priority
      }
      
      if (filters.technician) {
        searchParams.technician_id = filters.technician
      }
      
      console.log('Fetching repair tickets with params:', searchParams)
      
      const response = await apiService.getRepairTickets(searchParams)
      console.log('Repair tickets response:', response)
      
      const ticketsData = response.data || []
      setTickets(ticketsData)
      setTotalPages(response.pagination?.pages || 1)
      setTotalCount(response.pagination?.total || 0)
    } catch (err) {
      setError('Failed to load repair tickets')
      console.error('Error fetching repair tickets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewTicket = (ticketId: string) => {
    navigate(`/repair-tickets/${ticketId}`)
  }

  const handleSearch = () => {
    setAppliedSearchTerm(searchTerm)
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setAppliedSearchTerm('')
    setCurrentPage(1)
  }

  const handleFilterChange = (filterType: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }))
    setCurrentPage(1)
  }

  const handleClearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      technician: ''
    })
    setCurrentPage(1)
  }

  const getUniqueTechnicians = () => {
    const technicians = new Set<string>()
    tickets.forEach(ticket => {
      if (ticket.converted_by_technician_name) {
        technicians.add(ticket.converted_by_technician_name)
      }
      if (ticket.submitted_by_name) {
        technicians.add(ticket.submitted_by_name)
      }
    })
    return Array.from(technicians).sort()
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '').length
  }

  const handleConvertToWorkOrder = async (ticket: RepairTicket) => {
    setSelectedTicket(ticket)
    setConvertModalOpen(true)
    
    // Fetch users for technician selection
    try {
      const response = await apiService.getUsers()
      const usersData = response.data || response
      setUsers(Array.isArray(usersData) ? usersData : [])
    } catch (err) {
      console.error('Error fetching users:', err)
      toast.error('Failed to load users')
    }
  }

  const handleConvertSubmit = async () => {
    if (!selectedTicket) return

    setIsConverting(true)
    try {
      const convertData = {
        technician_id: selectedTechnician === 'unassigned' ? null : selectedTechnician || null,
        priority: selectedTicket.priority || 'medium',
        estimated_hours: null,
        notes: `Converted from repair ticket ${selectedTicket.formatted_number || selectedTicket.ticket_number}`
      }

      const response = await apiService.convertRepairTicketToWorkOrder(selectedTicket.id, convertData)
      
      toast.success('Repair ticket converted to work order successfully')
      setConvertModalOpen(false)
      setSelectedTicket(null)
      setSelectedTechnician('')
      
      // Refresh tickets list
      await fetchTickets()
      
      // Navigate to the created work order if available
      if (response.data?.work_order?.id) {
        navigate(`/work-orders/${response.data.work_order.id}`)
      }
    } catch (err: any) {
      console.error('Error converting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to convert ticket to work order')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDeleteTicket = (ticket: RepairTicket) => {
    // Check if ticket is converted
    if (ticket.status === 'converted' || ticket.status === 'converted - warranty') {
      setConvertedTicket(ticket)
      setConvertedAlertOpen(true)
      return
    }
    
    setTicketToDelete(ticket)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteTicket = async () => {
    if (!ticketToDelete) return

    try {
      await apiService.deleteRepairTicket(ticketToDelete.id)
      toast.success('Repair ticket deleted successfully')
      setDeleteDialogOpen(false)
      setTicketToDelete(null)
      await fetchTickets() // Refresh the list
    } catch (err: any) {
      console.error('Error deleting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to delete repair ticket')
    }
  }

  const handlePrintTicket = async (ticket: RepairTicket) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/repair-ticket/${ticket.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const newWindow = window.open(url, '_blank')
      if (newWindow) {
        newWindow.document.title = `Repair Ticket ${ticket.formatted_number || ticket.ticket_number}`
      }
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error printing ticket:', error)
      toast.error('Failed to print ticket')
    }
  }

  const handleDownloadTicket = async (ticket: RepairTicket) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/repair-ticket/${ticket.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `repair-ticket-${ticket.formatted_number || ticket.ticket_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading ticket:', error)
      toast.error('Failed to download ticket')
    }
  }

  const openTickets = tickets.filter(t => t.status !== 'converted' && t.status !== 'converted - warranty')
  const convertedTickets = tickets.filter(t => t.status === 'converted' || t.status === 'converted - warranty')
  const highPriorityTickets = tickets.filter(t => t.priority === 'high')
  const totalTickets = totalCount

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading repair tickets...</span>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchTickets}>Try Again</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Repair Tickets</h1>
            <p className="text-muted-foreground">
              Track and manage repair requests and service tickets
            </p>
          </div>
          {hasPermission('repair_tickets:write') && (
            <Button onClick={() => navigate('/create-repair-ticket')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Ticket
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openTickets.length}</div>
              <p className="text-xs text-muted-foreground">Not converted</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Converted Tickets</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{convertedTickets.length}</div>
              <p className="text-xs text-muted-foreground">To work orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <Wrench className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{highPriorityTickets.length}</div>
              <p className="text-xs text-muted-foreground">Urgent tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <FileText className="h-4 w-4 text-gray-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTickets}</div>
              <p className="text-xs text-muted-foreground">All repair tickets</p>
            </CardContent>
          </Card>
        </div>

        {/* Tickets Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search tickets..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch()
                      }
                    }}
                    className="pl-10 w-80"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={handleClearSearch}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button onClick={handleSearch} variant="outline">
                  Search
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="relative">
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                      {getActiveFiltersCount() > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {getActiveFiltersCount()}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Status Filter */}
                    <div className="p-2">
                      <Label className="text-sm font-medium mb-2 block">Status</Label>
                      <Select value={filters.status || "all"} onValueChange={(value) => handleFilterChange('status', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="intake">Intake</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                          <SelectItem value="converted - warranty">Converted - Warranty</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority Filter */}
                    <div className="p-2">
                      <Label className="text-sm font-medium mb-2 block">Priority</Label>
                      <Select value={filters.priority || "all"} onValueChange={(value) => handleFilterChange('priority', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All priorities" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All priorities</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Technician Filter */}
                    <div className="p-2">
                      <Label className="text-sm font-medium mb-2 block">Technician</Label>
                      <Select value={filters.technician || "all"} onValueChange={(value) => handleFilterChange('technician', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All technicians" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All technicians</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {getUniqueTechnicians().map((technician) => (
                            <SelectItem key={technician} value={technician}>
                              {technician}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear Filters
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Machine</TableHead>
                  <TableHead>Problem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Technician</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket, index) => (
                  <TableRow 
                    key={`ticket-${ticket.id}-${index}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/repair-tickets/${ticket.id}`)}
                  >
                    <TableCell className="font-medium">
                      {ticket.formatted_number || ticket.ticket_number || `#${ticket.id}`}
                    </TableCell>
                    <TableCell>{ticket.customer_name || 'N/A'}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{ticket.model_name || 'N/A'}</div>
                        {ticket.serial_number && (
                          <div className="text-sm text-muted-foreground">
                            {ticket.serial_number}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate">
                        {ticket.problem_description || 'No description'}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                    <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ticket.converted_by_technician_name || ticket.submitted_by_name || 'Unassigned'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(ticket.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewTicket(ticket.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          {hasPermission('repair_tickets:write') && (
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Ticket
                            </DropdownMenuItem>
                          )}
                          {hasPermission('repair_tickets:write') && (
                            <DropdownMenuItem>
                              <User className="mr-2 h-4 w-4" />
                              Assign Technician
                            </DropdownMenuItem>
                          )}
                          {hasPermission('repair_tickets:write') && (
                            <DropdownMenuItem 
                              onClick={() => handleConvertToWorkOrder(ticket)}
                              disabled={ticket.status === 'converted' || ticket.status === 'cancelled'}
                            >
                              <Wrench className="mr-2 h-4 w-4" />
                              Convert to Work Order
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => handlePrintTicket(ticket)}>
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownloadTicket(ticket)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Download PDF
                          </DropdownMenuItem>
                          {hasPermission('repair_tickets:delete') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteTicket(ticket)
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} tickets
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(pageNum)}
                          className="w-8 h-8 p-0"
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Convert to Work Order Modal */}
      <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Convert to Work Order</DialogTitle>
            <DialogDescription>
              Please select a technician to assign to this work order or leave unassigned.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="technician">Technician</Label>
              <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                <SelectTrigger>
                  <SelectValue placeholder="Select technician (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">No technician assigned</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConvertSubmit} disabled={isConverting}>
              {isConverting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Converting...
                </>
              ) : (
                'Convert to Work Order'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDeleteTicket}
        title="Delete Repair Ticket"
        itemName={ticketToDelete?.formatted_number || ticketToDelete?.ticket_number || `#${ticketToDelete?.id}`}
        itemType="repair ticket"
      />

      {/* Converted Ticket Alert Dialog */}
      <CompletedItemAlertDialog
        open={convertedAlertOpen}
        onOpenChange={setConvertedAlertOpen}
        itemName={convertedTicket?.formatted_number || convertedTicket?.ticket_number || `#${convertedTicket?.id}`}
        itemType="repair ticket"
        title="Cannot Delete Converted Repair Ticket"
        description="This repair ticket has been converted to a work order and cannot be deleted. Please contact your administrator if you need to remove this ticket."
      />
    </MainLayout>
  )
}