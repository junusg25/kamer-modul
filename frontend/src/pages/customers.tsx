import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Button } from '../components/ui/button'
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
import { Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { apiService } from '../services/api'
import { formatStatus, formatStatusWithTranslation, getStatusBadgeVariant, getStatusBadgeColor } from '../lib/status'
import { formatCurrency } from '../lib/currency'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '../hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '../components/ui/column-visibility-dropdown'
import {
  Search,
  Mail,
  Phone,
  MapPin,
  Plus,
  Filter,
  User,
  Building2
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

const getStatusBadge = (status: Customer['status'], t: any) => {
  if (!status) return <Badge variant="outline">{t('status.unknown')}</Badge>
  
  return (
    <Badge 
      variant={getStatusBadgeVariant(status)} 
      className={getStatusBadgeVariant(status) === 'outline' ? getStatusBadgeColor(status) : undefined}
    >
      {formatStatusWithTranslation(status, t)}
    </Badge>
  )
}

export default function Customers() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  
  // Define columns with translations
  const CUSTOMER_COLUMNS = defineColumns([
    { key: 'customer', label: t('tables.customer') },
    { key: 'type', label: t('tables.headers.type') },
    { key: 'contact', label: t('tables.headers.address') },
    { key: 'status', label: t('tables.headers.status') },
    { key: 'machines', label: t('tables.machines') },
    { key: 'total_spent', label: t('tables.headers.total_spent') },
    { key: 'owner', label: t('tables.headers.assigned_to') },
  ])
  
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
                      <span>{t('pages.customers.searching')}...</span>
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
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.customers.title')}</h1>
            <p className="text-muted-foreground">
              {t('pages.customers.description')}
            </p>
          </div>
          <Button onClick={() => navigate('/add-customer')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('pages.customers.add_customer')}
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <SmartSearch
                    placeholder={t('pages.customers.search_placeholder')}
                    value={appliedSearchTerm}
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
                      {t('filter')}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{t('pages.customers.filter_by')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Status Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">{t('tables.headers.status')}</Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, status: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={t('pages.customers.all_statuses')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">{t('pages.customers.clear_status')}</SelectItem>
                          <SelectItem value="active">{t('status.active')}</SelectItem>
                          <SelectItem value="inactive">{t('status.inactive')}</SelectItem>
                          <SelectItem value="pending">{t('status.pending')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Owner Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">{t('tables.headers.assigned_to')}</Label>
                      <Select
                        value={filters.owner}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, owner: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={t('pages.customers.all_owners')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">{t('pages.customers.clear_owner')}</SelectItem>
                          <SelectItem value="assigned">{t('pages.customers.assigned')}</SelectItem>
                          <SelectItem value="unassigned">{t('pages.customers.unassigned')}</SelectItem>
                          {getUniqueOwners().map(owner => (
                            <SelectItem key={owner} value={owner || ''}>{owner}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Customer Type Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">{t('tables.headers.type')}</Label>
                      <Select
                        value={filters.customer_type}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, customer_type: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={t('pages.customers.all_types')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">{t('pages.customers.clear_type')}</SelectItem>
                          <SelectItem value="private">{t('pages.customers.private_personnel')}</SelectItem>
                          <SelectItem value="company">{t('pages.customers.company')}</SelectItem>
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
                      {t('pages.customers.clear_filters')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                
                {/* Search Status Indicator */}
                {appliedSearchTerm && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{t('pages.customers.searching')}...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        <span>
                          {totalCount > 0 
                            ? t('pages.customers.search_results_found', { count: totalCount, query: appliedSearchTerm }) 
                            : t('pages.customers.no_search_results', { query: appliedSearchTerm })
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
                  {isColumnVisible('customer') && <TableHead>{t('tables.customer')}</TableHead>}
                  {isColumnVisible('type') && <TableHead>{t('tables.headers.type')}</TableHead>}
                  {isColumnVisible('contact') && <TableHead>{t('tables.headers.address')}</TableHead>}
                  {isColumnVisible('status') && <TableHead>{t('tables.headers.status')}</TableHead>}
                  {isColumnVisible('machines') && <TableHead>{t('tables.machines')}</TableHead>}
                  {isColumnVisible('total_spent') && <TableHead>{t('tables.headers.total_spent')}</TableHead>}
                  {isColumnVisible('owner') && <TableHead>{t('tables.headers.assigned_to')}</TableHead>}
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
                          {customer.customer_type === 'company' ? t('status.company') : t('status.private')}
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
                        {getStatusBadge(customer.status || 'active', t)}
                      </TableCell>
                    )}
                    {isColumnVisible('machines') && (
                      <TableCell>
                        <Badge variant="outline">{customer.total_machines || 0} {t('tables.machines')}</Badge>
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
      </div>
    </MainLayout>
  )
}