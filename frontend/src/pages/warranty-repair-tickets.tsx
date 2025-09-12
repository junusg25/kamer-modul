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
  Shield,
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
import { toast } from 'sonner'
import { formatDate } from '@/lib/dateTime'
import { formatCurrency } from '@/lib/currency'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'

interface WarrantyRepairTicket {
  id: string
  ticket_number?: string
  formatted_number?: string
  year_created?: number
  customer_id: string
  customer_name: string
  company_name?: string
  machine_id: string
  manufacturer?: string
  model_name?: string
  serial_number?: string
  problem_description: string
  submitted_by: string
  submitted_by_name?: string
  status: string
  priority?: string
  converted_to_warranty_work_order_id?: string
  converted_work_order_formatted_number?: string
  converted_by_technician_id?: string
  converted_by_technician_name?: string
  converted_at?: string
  created_at: string
  updated_at: string
  sales_opportunity?: boolean
  sales_notes?: string
  potential_value?: number | string
  sales_user_id?: string
  lead_quality?: string
}

export default function WarrantyRepairTickets() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()
  const [warrantyRepairTickets, setWarrantyRepairTickets] = useState<WarrantyRepairTicket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
  
  // Convert to work order state
  const [convertModalOpen, setConvertModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<WarrantyRepairTicket | null>(null)
  const [selectedTechnician, setSelectedTechnician] = useState<string>('')
  const [users, setUsers] = useState<any[]>([])
  const [isConverting, setIsConverting] = useState(false)

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [ticketToDelete, setTicketToDelete] = useState<WarrantyRepairTicket | null>(null)
  const [convertedAlertOpen, setConvertedAlertOpen] = useState(false)
  const [convertedTicket, setConvertedTicket] = useState<WarrantyRepairTicket | null>(null)

  useEffect(() => {
    fetchWarrantyRepairTickets()
    fetchUsers()
  }, [appliedSearchTerm, filters, currentPage])

  const fetchWarrantyRepairTickets = async () => {
    try {
      setIsLoading(true)
      setError(null)
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
      
      console.log('Fetching warranty repair tickets with params:', searchParams)
      
      const response = await apiService.getWarrantyRepairTickets(searchParams) as any
      console.log('Warranty repair tickets response:', response)
      
      setWarrantyRepairTickets(response.data || [])
      setTotalPages(response.pagination?.pages || 1)
      setTotalCount(response.pagination?.total || 0)
    } catch (err) {
      setError('Failed to load warranty repair tickets.')
      console.error('Error fetching warranty repair tickets:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiService.getUsers()
      setUsers(response.data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const handleViewTicket = (id: string) => {
    navigate(`/warranty-repair-tickets/${id}`)
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
    warrantyRepairTickets.forEach(ticket => {
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

  const handleConvertToWorkOrder = (ticket: WarrantyRepairTicket) => {
    setSelectedTicket(ticket)
    setConvertModalOpen(true)
  }

  const handleConvertSubmit = async () => {
    if (!selectedTicket || !selectedTechnician) return

    try {
      setIsConverting(true)
      await apiService.convertWarrantyRepairTicketToWorkOrder(selectedTicket.id, {
        technician_id: selectedTechnician,
        priority: selectedTicket.priority || 'medium'
      })
      
      toast.success('Warranty repair ticket converted to work order successfully')
      setConvertModalOpen(false)
      setSelectedTicket(null)
      setSelectedTechnician('')
      fetchWarrantyRepairTickets()
    } catch (err: any) {
      console.error('Error converting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to convert warranty repair ticket')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDeleteTicket = (ticket: WarrantyRepairTicket) => {
    if (ticket.status === 'converted' || ticket.status === 'converted - warranty') {
      setConvertedTicket(ticket)
      setConvertedAlertOpen(true)
    } else {
      setTicketToDelete(ticket)
      setDeleteDialogOpen(true)
    }
  }

  const confirmDeleteTicket = async () => {
    if (!ticketToDelete) return

    try {
      await apiService.deleteWarrantyRepairTicket(ticketToDelete.id)
      toast.success('Warranty repair ticket deleted successfully')
      setDeleteDialogOpen(false)
      setTicketToDelete(null)
      fetchWarrantyRepairTickets()
    } catch (err: any) {
      console.error('Error deleting ticket:', err)
      toast.error(err.response?.data?.message || 'Failed to delete warranty repair ticket')
    }
  }

  const handlePrintTicket = async (ticket: WarrantyRepairTicket) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/warranty-repair-ticket/${ticket.id}`, {
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
        newWindow.document.title = `Warranty Repair Ticket ${ticket.formatted_number || ticket.ticket_number}`
      }
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error printing ticket:', error)
      toast.error('Failed to print ticket')
    }
  }

  const handleDownloadTicket = async (ticket: WarrantyRepairTicket) => {
    try {
      const response = await fetch(`http://localhost:3000/api/print/warranty-repair-ticket/${ticket.id}`, {
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
      link.download = `warranty-repair-ticket-${ticket.formatted_number || ticket.ticket_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading ticket:', error)
      toast.error('Failed to download ticket')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      intake: Clock,
      converted: CheckCircle,
      'converted - warranty': CheckCircle,
      cancelled: AlertCircle,
    }
    
    const Icon = statusIcons[status] || Clock
    
    return (
      <Badge 
        variant={getStatusBadgeVariant(status)} 
        className={`flex items-center gap-1 ${getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : ''}`}
      >
        <Icon className="h-3 w-3" />
        {formatStatus(status)}
      </Badge>
    )
  }

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Medium</Badge>
    
    const priorityConfig = {
      low: { color: 'bg-green-50 text-green-700 border-green-200', label: 'Low' },
      medium: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Medium' },
      high: { color: 'bg-red-50 text-red-700 border-red-200', label: 'High' },
    }
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    )
  }

  const getLeadQualityBadge = (quality?: string) => {
    if (!quality || quality === 'unknown') return null
    
    const qualityConfig = {
      cold: { color: 'outline' as const, label: 'Cold' },
      warm: { color: 'default' as const, label: 'Warm' },
      hot: { color: 'destructive' as const, label: 'Hot' },
    }
    
    const config = qualityConfig[quality as keyof typeof qualityConfig]
    if (!config) return null
    
    return (
      <Badge variant={config.color}>
        {config.label}
      </Badge>
    )
  }


  const openTickets = warrantyRepairTickets.filter(t => t.status !== 'converted' && t.status !== 'converted - warranty')
  const convertedTickets = warrantyRepairTickets.filter(t => t.status === 'converted' || t.status === 'converted - warranty')
  const highPriorityTickets = warrantyRepairTickets.filter(t => t.priority === 'high')
  const totalTickets = totalCount

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading warranty repair tickets...</span>
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
            <Button onClick={fetchWarrantyRepairTickets}>Try Again</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Warranty Repair Tickets</h1>
            <p className="text-muted-foreground">
              Manage warranty repair tickets and track conversions
            </p>
          </div>
          {hasPermission('repair_tickets:write') && (
            <Button onClick={() => navigate('/create-warranty-repair-ticket')}>
              <Plus className="mr-2 h-4 w-4" />
              New Warranty Ticket
            </Button>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openTickets.length}</div>
              <p className="text-xs text-muted-foreground">Not converted</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Converted Tickets</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{convertedTickets.length}</div>
              <p className="text-xs text-muted-foreground">To work orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">High Priority</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{highPriorityTickets.length}</div>
              <p className="text-xs text-muted-foreground">Urgent tickets</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTickets}</div>
              <p className="text-xs text-muted-foreground">All warranty tickets</p>
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
                      <label className="text-sm font-medium mb-2 block">Status</label>
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
                      <label className="text-sm font-medium mb-2 block">Priority</label>
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
                      <label className="text-sm font-medium mb-2 block">Technician</label>
                      <Select value={filters.technician || "all"} onValueChange={(value) => handleFilterChange('technician', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All technicians" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All technicians</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {getUniqueTechnicians().map(technician => (
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

            {/* Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Machine</TableHead>
                    <TableHead>Problem</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[70px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {warrantyRepairTickets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No warranty repair tickets found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    warrantyRepairTickets.map((ticket) => (
                      <TableRow 
                        key={ticket.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/warranty-repair-tickets/${ticket.id}`)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-orange-500" />
                            {ticket.formatted_number || `#${ticket.ticket_number || ticket.id}`}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{ticket.customer_name}</div>
                            {ticket.company_name && (
                              <div className="text-sm text-muted-foreground">{ticket.company_name}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{ticket.model_name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">
                              {ticket.serial_number || 'N/A'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate">
                            {ticket.problem_description}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(ticket.status)}</TableCell>
                        <TableCell>{getPriorityBadge(ticket.priority)}</TableCell>
                        <TableCell>{ticket.submitted_by_name || 'Unknown'}</TableCell>
                        <TableCell>{formatDate(ticket.created_at)}</TableCell>
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
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Ticket
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <User className="mr-2 h-4 w-4" />
                                Assign Technician
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleConvertToWorkOrder(ticket)}
                                disabled={ticket.status === 'converted' || ticket.status === 'cancelled'}
                              >
                                <Wrench className="mr-2 h-4 w-4" />
                                Convert to Work Order
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintTicket(ticket)}>
                                <Printer className="mr-2 h-4 w-4" />
                                Print
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownloadTicket(ticket)}>
                                <FileText className="mr-2 h-4 w-4" />
                                Download PDF
                              </DropdownMenuItem>
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
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} warranty repair tickets
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

        {/* Convert to Work Order Modal */}
        <Dialog open={convertModalOpen} onOpenChange={setConvertModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert to Warranty Work Order</DialogTitle>
              <DialogDescription>
                Convert warranty repair ticket {selectedTicket?.formatted_number} to a warranty work order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="technician">Assign Technician</Label>
                <Select value={selectedTechnician} onValueChange={setSelectedTechnician}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a technician" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
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
              <Button 
                onClick={handleConvertSubmit} 
                disabled={!selectedTechnician || isConverting}
              >
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
          title="Delete Warranty Repair Ticket"
          description={`Are you sure you want to delete warranty repair ticket ${ticketToDelete?.formatted_number}? This action cannot be undone.`}
        />

        {/* Converted Ticket Alert Dialog */}
        <CompletedItemAlertDialog
          open={convertedAlertOpen}
          onOpenChange={setConvertedAlertOpen}
          title="Cannot Delete Converted Ticket"
          description={`Warranty repair ticket ${convertedTicket?.formatted_number} has been converted to a work order and cannot be deleted.`}
        />
      </div>
    </MainLayout>
  )
}
