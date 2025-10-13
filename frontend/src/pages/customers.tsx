import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { SmartSearch } from '../components/ui/smart-search'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Loader2 } from 'lucide-react'
import { apiService } from '../services/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Label } from '../components/ui/label'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { GeneralAlertDialog } from '../components/ui/general-alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '../lib/status'
import { formatCurrency } from '../lib/currency'
import { toast } from 'sonner'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '../hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '../components/ui/column-visibility-dropdown'
import {
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Mail,
  Phone,
  MapPin,
  Plus,
  Filter,
  User,
  Building2,
  Save,
  X
} from 'lucide-react'

interface Customer {
  id: string
  customer_type: 'private' | 'company'
  name: string
  contact_person?: string
  email: string
  phone: string
  phone2?: string
  fax?: string
  street_address?: string
  city?: string
  postal_code?: string
  company_name?: string
  vat_number?: string
  owner_id?: number
  owner_name?: string
  ownership_notes?: string
  assigned_at?: string
  total_machines?: number
  machines_purchased?: number
  total_spent?: number
  status?: 'active' | 'inactive' | 'pending'
  created_at: string
  updated_at: string
}

interface CustomerFormData {
  customer_type: 'private' | 'company'
  name: string
  contact_person?: string
  email?: string
  phone?: string
  phone2?: string
  fax?: string
  street_address?: string
  city?: string
  postal_code?: string
  company_name?: string
  vat_number?: string
  owner_id?: number
  ownership_notes?: string
  status?: 'active' | 'inactive' | 'pending'
}

// Define columns for the customers table
const CUSTOMER_COLUMNS = defineColumns([
  { key: 'customer', label: 'Customer' },
  { key: 'type', label: 'Type' },
  { key: 'contact', label: 'Contact' },
  { key: 'status', label: 'Status' },
  { key: 'machines', label: 'Machines' },
  { key: 'total_spent', label: 'Total Spent' },
  { key: 'owner', label: 'Owner' },
])

const sampleCustomers: Customer[] = [
  {
    id: '1',
    customer_type: 'private',
    name: 'John Smith',
    email: 'john.smith@email.com',
    phone: '+1 (555) 123-4567',
    company_name: 'ABC Corporation',
    status: 'active',
    total_machines: 5,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    customer_type: 'company',
    name: 'Tech Solutions Inc',
    contact_person: 'Sarah Johnson',
    email: 'sarah.j@company.com',
    phone: '+1 (555) 987-6543',
    company_name: 'Tech Solutions Inc',
    status: 'active',
    total_machines: 3,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '3',
    customer_type: 'company',
    name: 'Global Enterprises',
    contact_person: 'Mike Chen',
    email: 'mike.chen@business.com',
    phone: '+1 (555) 456-7890',
    company_name: 'Global Enterprises',
    status: 'pending',
    total_machines: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '4',
    customer_type: 'private',
    name: 'Lisa Wang',
    email: 'lisa.wang@corp.com',
    phone: '+1 (555) 321-0987',
    company_name: 'Innovation Labs',
    status: 'active',
    total_machines: 8,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '5',
    customer_type: 'private',
    name: 'David Kim',
    email: 'david.kim@startup.com',
    phone: '+1 (555) 654-3210',
    company_name: 'StartupCo',
    status: 'inactive',
    total_machines: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
]

const getStatusBadge = (status: Customer['status']) => {
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

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    owner: '',
    status: '',
    customer_type: ''
  })
  
  // Column visibility hook
  const {
    visibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isSyncing
  } = useColumnVisibility('customers', getDefaultColumnKeys(CUSTOMER_COLUMNS))
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const [machineAlertOpen, setMachineAlertOpen] = useState(false)
  const [customerWithMachines, setCustomerWithMachines] = useState<Customer | null>(null)
  
  // Edit functionality state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null)
  const [editFormData, setEditFormData] = useState<CustomerFormData>({
    customer_type: 'private',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    phone2: '',
    fax: '',
    street_address: '',
    city: '',
    postal_code: '',
    company_name: '',
    vat_number: '',
    owner_id: undefined,
    ownership_notes: '',
    status: 'active'
  })
  const [users, setUsers] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(25)

  // Fetch customers when applied search term or filters change
  useEffect(() => {
    fetchCustomers()
  }, [appliedSearchTerm, filters, currentPage])

  const fetchCustomers = async () => {
    try {
      setIsLoading(true)
      setError('')
      
      // Prepare search parameters
      const searchParams: any = {
        page: currentPage,
        limit: pageSize
      }
      
      // Add search term if provided
      if (appliedSearchTerm.trim()) {
        searchParams.search = appliedSearchTerm.trim()
      }
      
      // Add filter parameters
      if (filters.status) {
        searchParams.status = filters.status
      }
      if (filters.owner) {
        if (filters.owner === 'assigned') {
          searchParams.owner_assigned = 'true'
        } else if (filters.owner === 'unassigned') {
          searchParams.owner_assigned = 'false'
        } else {
          searchParams.owner_name = filters.owner
        }
      }
      if (filters.customer_type) {
        searchParams.customer_type = filters.customer_type
      }
      
      const response = await apiService.getCustomers(searchParams) as any
      
      // Backend returns { data: [...], pagination: {...} }
      const customersData = response.data || []
      const pagination = response.pagination || {}
      
      // Deduplicate customers by ID (in case JOIN creates duplicates)
      const uniqueCustomers = customersData.reduce((acc: Customer[], current: Customer) => {
        const existingCustomer = acc.find(customer => customer.id === current.id)
        if (!existingCustomer) {
          acc.push(current)
        } else {
          // Merge data if needed (aggregate machine counts, etc.)
          existingCustomer.total_machines = (existingCustomer.total_machines || 0) + (current.total_machines || 0)
          existingCustomer.total_spent = (parseFloat(existingCustomer.total_spent?.toString() || '0') + parseFloat(current.total_spent?.toString() || '0'))
        }
        return acc
      }, [])
      
      setCustomers(uniqueCustomers)
      setTotalPages(pagination.pages || 1)
      setTotalCount(pagination.total || 0)
      
    } catch (err) {
      setError('Failed to load customers')
      console.error('Error fetching customers:', err)
      // Fallback to sample data if API fails
      setCustomers(sampleCustomers)
      setTotalPages(1)
      setTotalCount(sampleCustomers.length)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewCustomer = (customerId: string | number) => {
    navigate(`/customers/${customerId}`)
  }

  const handleDeleteCustomer = (customer: Customer) => {
    // Check if customer has machines assigned
    if (customer.total_machines && customer.total_machines > 0) {
      setCustomerWithMachines(customer)
      setMachineAlertOpen(true)
      return
    }
    
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteCustomer = async () => {
    if (!customerToDelete) return

    try {
      await apiService.deleteCustomer(customerToDelete.id)
      // Refresh the customers list
      fetchCustomers()
      // Show success message
      
    } catch (error) {
      console.error('Error deleting customer:', error)
      // Show error message
      console.error('Failed to delete customer. Please try again.')
    } finally {
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
    }
  }

  const handleEditCustomer = async (customer: Customer) => {
    setCustomerToEdit(customer)
    
    // Fetch users for owner assignment dropdown
    await fetchUsers()
    
    // Populate form with current customer data
    setEditFormData({
      customer_type: customer.customer_type || 'private',
      name: customer.name || '',
      contact_person: customer.contact_person || '',
      email: customer.email || '',
      phone: customer.phone || '',
      phone2: customer.phone2 || '',
      fax: customer.fax || '',
      street_address: customer.street_address || '',
      city: customer.city || '',
      postal_code: customer.postal_code || '',
      company_name: customer.company_name || '',
      vat_number: customer.vat_number || '',
      owner_id: customer.owner_id || undefined,
      ownership_notes: customer.ownership_notes || '',
      status: customer.status || 'active'
    })
    setEditDialogOpen(true)
  }

  const fetchUsers = async () => {
    try {
      const response = await apiService.getUsers()
      setUsers(response.data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleInputChange = (field: keyof CustomerFormData, value: string | number) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveCustomer = async () => {
    if (!customerToEdit) return

    try {
      setIsSaving(true)
      
      // Prepare update data - only include fields that have values
      const updateData: any = {
        customer_type: editFormData.customer_type,
        name: editFormData.name,
        status: editFormData.status
      }

      // Add optional fields only if they have values
      if (editFormData.contact_person) updateData.contact_person = editFormData.contact_person
      if (editFormData.email) updateData.email = editFormData.email
      if (editFormData.phone) updateData.phone = editFormData.phone
      if (editFormData.phone2) updateData.phone2 = editFormData.phone2
      if (editFormData.fax) updateData.fax = editFormData.fax
      if (editFormData.street_address) updateData.street_address = editFormData.street_address
      if (editFormData.city) updateData.city = editFormData.city
      if (editFormData.postal_code) updateData.postal_code = editFormData.postal_code
      if (editFormData.company_name) updateData.company_name = editFormData.company_name
      if (editFormData.vat_number) updateData.vat_number = editFormData.vat_number
      if (editFormData.owner_id) updateData.owner_id = editFormData.owner_id
      if (editFormData.ownership_notes) updateData.ownership_notes = editFormData.ownership_notes

      await apiService.updateCustomer(customerToEdit.id, updateData)
      
      // Refresh customers list
      await fetchCustomers()
      
      toast.success('Customer updated successfully')
      setEditDialogOpen(false)
    } catch (error: any) {
      console.error('Error updating customer:', error)
      
      // Handle specific error messages from backend
      if (error.message) {
        toast.error(error.message)
      } else {
        toast.error('Failed to update customer. Please try again.')
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditDialogOpen(false)
    setCustomerToEdit(null)
    setEditFormData({
      customer_type: 'private',
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      phone2: '',
      fax: '',
      street_address: '',
      city: '',
      postal_code: '',
      company_name: '',
      vat_number: '',
      owner_id: undefined,
      ownership_notes: '',
      status: 'active'
    })
  }

  // Get unique owners for filter dropdown (from current page data)
  const getUniqueOwners = () => {
    const owners = customers
      .map(customer => customer.owner_name)
      .filter((owner, index, self) => owner && self.indexOf(owner) === index)
    return owners.sort()
  }

  // No more frontend filtering - backend handles it all
  const filteredCustomers = customers

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading customers...</span>
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
            <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
            <p className="text-muted-foreground">
              Manage your customer database and relationships
            </p>
          </div>
          <Button onClick={() => navigate('/add-customer')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <SmartSearch
                    placeholder="Search customers..."
                    onSearch={(term) => {
                      setAppliedSearchTerm(term)
                      setCurrentPage(1) // Reset to first page when searching
                    }}
                    onClear={() => {
                      setAppliedSearchTerm('')
                      setCurrentPage(1)
                    }}
                    debounceMs={300}
                    className="w-80"
                    disabled={isLoading}
                  />
                </div>
                
                {/* Column Visibility */}
                <ColumnVisibilityDropdown
                  columns={CUSTOMER_COLUMNS}
                  visibleColumns={visibleColumns}
                  onToggleColumn={toggleColumn}
                  onShowAll={showAllColumns}
                  onHideAll={hideAllColumns}
                  onReset={resetColumns}
                  isSyncing={isSyncing}
                />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <Filter className="mr-2 h-4 w-4" />
                      Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Status Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">Status</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, status: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">Clear Status</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Owner Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">Owner</Label>
                      <Select
                        value={filters.owner}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, owner: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="All owners" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">Clear Owner</SelectItem>
                          <SelectItem value="assigned">Assigned</SelectItem>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {getUniqueOwners().map(owner => (
                            <SelectItem key={owner} value={owner || ''}>{owner}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Customer Type Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">Type</Label>
                      <Select
                        value={filters.customer_type}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, customer_type: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="All types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">Clear Type</SelectItem>
                          <SelectItem value="private">Private Personnel</SelectItem>
                          <SelectItem value="company">Company</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => {
                        setFilters({ owner: '', status: '', customer_type: '' })
                        setCurrentPage(1) // Reset to first page when clearing filters
                      }}
                      className="text-center"
                    >
                      Clear Filters
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Search Status Indicator */}
                {appliedSearchTerm && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        <span>
                          {totalCount > 0 
                            ? `Found ${totalCount} customer${totalCount !== 1 ? 's' : ''} for "${appliedSearchTerm}"` 
                            : `No results found for "${appliedSearchTerm}"`
                          }
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {isColumnVisible('customer') && <TableHead>Customer</TableHead>}
                  {isColumnVisible('type') && <TableHead>Type</TableHead>}
                  {isColumnVisible('contact') && <TableHead>Contact</TableHead>}
                  {isColumnVisible('status') && <TableHead>Status</TableHead>}
                  {isColumnVisible('machines') && <TableHead>Machines</TableHead>}
                  {isColumnVisible('total_spent') && <TableHead>Total Spent</TableHead>}
                  {isColumnVisible('owner') && <TableHead>Owner</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer, index) => (
                  <TableRow 
                    key={`customer-${customer.id}-${index}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    {isColumnVisible('customer') && (
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {customer.customer_type === 'company' ? customer.company_name : customer.name}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center">
                            <MapPin className="mr-1 h-3 w-3" />
                            {customer.city || 'N/A'}
                          </div>
                          {customer.customer_type === 'company' && customer.contact_person && (
                            <div className="text-sm text-muted-foreground flex items-center mt-1">
                              <User className="mr-1 h-3 w-3" />
                              {customer.contact_person}
                            </div>
                          )}
                          {customer.customer_type === 'private' && customer.company_name && (
                            <div className="text-sm text-muted-foreground flex items-center mt-1">
                              <Building2 className="mr-1 h-3 w-3" />
                              {customer.company_name}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('type') && (
                      <TableCell>
                        <Badge 
                          variant={customer.customer_type === 'company' ? 'default' : 'secondary'} 
                          className="text-xs"
                        >
                          {customer.customer_type === 'company' ? 'Company' : 'Private'}
                        </Badge>
                      </TableCell>
                    )}
                    {isColumnVisible('contact') && (
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center text-sm">
                            <Mail className="mr-1 h-3 w-3" />
                            {customer.email}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Phone className="mr-1 h-3 w-3" />
                            {customer.phone}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('status') && (
                      <TableCell>
                        {getStatusBadge(customer.status || 'active')}
                      </TableCell>
                    )}
                    {isColumnVisible('machines') && (
                      <TableCell>
                        <Badge variant="outline">{customer.total_machines || 0} machines</Badge>
                      </TableCell>
                    )}
                    {isColumnVisible('total_spent') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {customer.total_spent ? formatCurrency(customer.total_spent) : 'N/A'}
                      </TableCell>
                    )}
                    {isColumnVisible('owner') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {customer.owner_name || 'N/A'}
                      </TableCell>
                    )}
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
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewCustomer(customer.id)
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEditCustomer(customer)
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Customer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteCustomer(customer)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} customers
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
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
                {totalPages > 5 && (
                  <>
                    <span className="text-muted-foreground">...</span>
                    <Button
                      variant={currentPage === totalPages ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      className="w-8 h-8 p-0"
                    >
                      {totalPages}
                    </Button>
                  </>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDeleteCustomer}
          title="Delete Customer"
          itemName={customerToDelete?.name}
          itemType="customer"
        />

        {/* Customer with Machines Alert Dialog */}
        <GeneralAlertDialog
          open={machineAlertOpen}
          onOpenChange={setMachineAlertOpen}
          title="Cannot Delete Customer"
          description={`Cannot delete ${customerWithMachines?.name} because they have ${customerWithMachines?.total_machines} machine(s) assigned. Please contact an administrator to reassign or remove the machines first.`}
          confirmText="OK"
          showCancel={false}
        />

        {/* Edit Customer Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Customer</DialogTitle>
              <DialogDescription>
                Update customer information and contact details
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Customer Type */}
              <div className="space-y-2">
                <Label htmlFor="customer_type">Customer Type</Label>
                <Select 
                  value={editFormData.customer_type} 
                  onValueChange={(value: 'private' | 'company') => handleInputChange('customer_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="company">Company</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={editFormData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter customer name"
                  required
                />
              </div>

              {/* Contact Person (for company customers) */}
              {editFormData.customer_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={editFormData.contact_person || ''}
                    onChange={(e) => handleInputChange('contact_person', e.target.value)}
                    placeholder="Enter contact person name"
                  />
                </div>
              )}

              {/* Company Name (for company customers) */}
              {editFormData.customer_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company Name</Label>
                  <Input
                    id="company_name"
                    value={editFormData.company_name || ''}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>
              )}

              {/* VAT Number (for company customers) */}
              {editFormData.customer_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="vat_number">VAT Number</Label>
                  <Input
                    id="vat_number"
                    value={editFormData.vat_number || ''}
                    onChange={(e) => handleInputChange('vat_number', e.target.value)}
                    placeholder="Enter VAT number"
                  />
                </div>
              )}

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editFormData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone2">Phone 2</Label>
                  <Input
                    id="phone2"
                    value={editFormData.phone2 || ''}
                    onChange={(e) => handleInputChange('phone2', e.target.value)}
                    placeholder="Enter secondary phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={editFormData.fax || ''}
                    onChange={(e) => handleInputChange('fax', e.target.value)}
                    placeholder="Enter fax number"
                  />
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-2">
                <Label htmlFor="street_address">Street Address</Label>
                <Input
                  id="street_address"
                  value={editFormData.street_address || ''}
                  onChange={(e) => handleInputChange('street_address', e.target.value)}
                  placeholder="Enter street address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={editFormData.city || ''}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    value={editFormData.postal_code || ''}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    placeholder="Enter postal code"
                  />
                </div>
              </div>

              {/* Owner Assignment */}
              <div className="space-y-2">
                <Label htmlFor="owner_id">Assigned Owner</Label>
                <Select 
                  value={editFormData.owner_id?.toString() || 'none'} 
                  onValueChange={(value) => handleInputChange('owner_id', value === 'none' ? undefined : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select owner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No owner assigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select 
                  value={editFormData.status || 'active'} 
                  onValueChange={(value: 'active' | 'inactive' | 'pending') => handleInputChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ownership Notes */}
              <div className="space-y-2">
                <Label htmlFor="ownership_notes">Ownership Notes</Label>
                <Textarea
                  id="ownership_notes"
                  value={editFormData.ownership_notes || ''}
                  onChange={(e) => handleInputChange('ownership_notes', e.target.value)}
                  placeholder="Enter any additional notes"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button onClick={handleSaveCustomer} disabled={isSaving || !editFormData.name.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
