import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
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
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { GeneralAlertDialog } from '../components/ui/general-alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Wrench,
  User,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  Building,
  Euro,
  Clock,
  Award,
  Shield,
  Activity,
  Save,
  X,
  MoreHorizontal,
  ShoppingCart,
  Settings
} from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { formatDate } from '../lib/dateTime'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '../lib/status'
import { formatCurrency } from '../lib/currency'
import { toast } from 'sonner'

interface Customer {
  id: string
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
  owner_name?: string
  ownership_notes?: string
  assigned_at?: string
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

interface CustomerMachine {
  id: string
  name: string
  model_name: string
  catalogue_number?: string
  serial_number: string
  warranty_expiry_date?: string
  warranty_active: boolean
  manufacturer: string
  purchase_date?: string
  sale_price?: number
  is_sale: boolean
  machine_condition?: 'new' | 'used'
  sold_by_name?: string
  added_by_name?: string
}

interface WorkOrder {
  id: string
  machine_id: string
  customer_id: string
  description?: string
  status: string
  technician_id?: string
  priority: string
  ticket_number?: string
  formatted_number?: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  total_cost?: number
  is_warranty: boolean
  labor_hours?: number
  labor_rate?: number
  quote_subtotal_parts?: number
  quote_total?: number
  approval_status?: string
  approval_at?: string
  troubleshooting_fee?: number
  paid_at?: string
  converted_from_ticket_id?: string
  owner_technician_id?: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  machine_name: string
  serial_number: string
  technician_name?: string
  owner_technician_name?: string
}

interface WarrantyWorkOrder {
  id: string
  machine_id: string
  customer_id: string
  description?: string
  status: string
  technician_id?: string
  priority: string
  ticket_number?: string
  formatted_number?: string
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  labor_hours?: number
  labor_rate?: number
  troubleshooting_fee?: number
  quote_subtotal_parts?: number
  quote_total?: number
  converted_from_ticket_id?: string
  owner_technician_id?: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  machine_name: string
  serial_number: string
  technician_name?: string
  owner_technician_name?: string
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [machines, setMachines] = useState<CustomerMachine[]>([])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [warrantyWorkOrders, setWarrantyWorkOrders] = useState<WarrantyWorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [machineAlertOpen, setMachineAlertOpen] = useState(false)
  
  // Machine deletion state
  const [machineDeleteDialogOpen, setMachineDeleteDialogOpen] = useState(false)
  const [machineToDelete, setMachineToDelete] = useState<CustomerMachine | null>(null)
  
  // Edit functionality state
  const [isEditing, setIsEditing] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
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

  useEffect(() => {
    if (id) {
      fetchCustomerDetails()
    }
  }, [id])

  const fetchCustomerDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch customer details
      const customerResponse = await apiService.getCustomer(id!) as any
      setCustomer(customerResponse.data)

      // Fetch customer machines
      const machinesResponse = await apiService.getCustomerMachines(id!) as any
      setMachines(machinesResponse.data || [])

      // Fetch customer work orders
      const workOrdersResponse = await apiService.getCustomerWorkOrders(id!) as any
      setWorkOrders(workOrdersResponse.data || [])

      // Fetch customer warranty work orders
      const warrantyWorkOrdersResponse = await apiService.getCustomerWarrantyWorkOrders(id!) as any
      setWarrantyWorkOrders(warrantyWorkOrdersResponse.data || [])
    } catch (err) {
      setError('Failed to load customer details.')
      console.error('Error fetching customer details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteCustomer = () => {
    if (!customer) return

    // Check if customer has machines assigned
    if (machines && machines.length > 0) {
      setMachineAlertOpen(true)
      return
    }
    
    setDeleteDialogOpen(true)
  }

  const confirmDeleteCustomer = async () => {
    if (!customer) return

    try {
      await apiService.deleteCustomer(customer.id)
      // Navigate back to customers list
      navigate('/customers')
      // Show success message
      toast.success('Customer deleted successfully')
    } catch (error: any) {
      console.error('Error deleting customer:', error)
      
      // Handle specific error messages from backend
      if (error.message) {
        toast.error(error.message)
      } else {
        toast.error('Failed to delete customer. Please try again.')
      }
    } finally {
      setDeleteDialogOpen(false)
    }
  }

  const handleDeleteMachine = (machine: CustomerMachine) => {
    setMachineToDelete(machine)
    setMachineDeleteDialogOpen(true)
  }

  const confirmDeleteMachine = async () => {
    if (!machineToDelete) return

    try {
      // Determine if it's a sold machine or repair machine based on machine_type
      if (machineToDelete.machine_type === 'sold') {
        await apiService.deleteSoldMachine(machineToDelete.id)
      } else {
        await apiService.deleteMachine(machineToDelete.id)
      }
      
      // Remove machine from local state
      setMachines(prev => prev.filter(m => m.id !== machineToDelete.id))
      
      // Show success message
      toast.success('Machine deleted successfully')
    } catch (error: any) {
      console.error('Error deleting machine:', error)
      
      // Handle specific error messages from backend
      if (error.message) {
        toast.error(error.message)
      } else {
        toast.error('Failed to delete machine. Please try again.')
      }
    } finally {
      setMachineDeleteDialogOpen(false)
      setMachineToDelete(null)
    }
  }

  const handleEditClick = async () => {
    if (!customer) return
    
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
    if (!customer) return

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

      await apiService.updateCustomer(customer.id, updateData)
      
      // Refresh customer data
      await fetchCustomerDetails()
      
      toast.success('Customer updated successfully')
      setEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating customer:', error)
      toast.error('Failed to update customer. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditDialogOpen(false)
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

  const getWarrantyStatus = (warrantyActive: boolean, warrantyExpiryDate?: string, machineType?: string) => {
    if (!warrantyExpiryDate) {
      return <Badge variant="secondary">No Warranty</Badge>
    }

    const expiryDate = new Date(warrantyExpiryDate)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // For repair machines, ignore warranty_active flag and only check the expiry date
    if (machineType === 'repair') {
      if (daysUntilExpiry < 0) {
        return <Badge variant="destructive">Expired</Badge>
      } else if (daysUntilExpiry <= 90) {
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Expires Soon</Badge>
      } else {
        return <Badge variant="outline" className="border-green-300 text-green-700">Active</Badge>
      }
    }

    // For sold machines, check both warranty_active flag and expiry date
    if (!warrantyActive || daysUntilExpiry < 0) {
      return <Badge variant="destructive">Expired</Badge>
    } else if (daysUntilExpiry <= 90) {
      return <Badge variant="outline" className="border-orange-300 text-orange-700">Expires Soon</Badge>
    } else {
      return <Badge variant="outline" className="border-green-300 text-green-700">Active</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      pending: Clock,
      in_progress: Activity,
      completed: CheckCircle,
      cancelled: XCircle,
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

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { color: 'default' as const },
      medium: { color: 'outline' as const },
      high: { color: 'destructive' as const },
    }
    
    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.medium
    
    return (
      <Badge variant={config.color}>
        {priority}
      </Badge>
    )
  }

  const getConditionBadge = (condition?: string) => {
    if (!condition) return <Badge variant="secondary">N/A</Badge>
    return (
      <Badge variant={condition === 'new' ? 'default' : 'outline'}>
        {condition}
      </Badge>
    )
  }

  const getMachineTypeBadge = (machineType: string) => {
    if (machineType === 'sold') {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
          <ShoppingCart className="w-3 h-3 mr-1" />
          {t('pages.customer_detail.sold')}
        </Badge>
      )
    } else {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
          <Settings className="w-3 h-3 mr-1" />
          {t('pages.customer_detail.repair')}
        </Badge>
      )
    }
  }

  const getMachineTypeIcon = (machineType: string) => {
    if (machineType === 'sold') {
      return <ShoppingCart className="w-4 h-4 text-green-600" />
    } else {
      return <Settings className="w-4 h-4 text-blue-600" />
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading customer details...</span>
        </div>
      </MainLayout>
    )
  }

  if (error) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </MainLayout>
    )
  }

  if (!customer) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Customer not found.</AlertDescription>
        </Alert>
      </MainLayout>
    )
  }

  // Calculate statistics
  const totalMachines = machines.length
  const totalWorkOrders = workOrders.length
  const totalWarrantyWorkOrders = warrantyWorkOrders.length
  const totalSpent = machines
    .filter(m => m.is_sale && m.sale_price)
    .reduce((sum, m) => sum + (parseFloat(m.sale_price?.toString() || '0') || 0), 0)
  const activeWarrantyMachines = machines.filter(m => m.warranty_active).length

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {customer.customer_type === 'company' ? customer.company_name : customer.name}
                </h1>
                <Badge 
                  variant={customer.customer_type === 'company' ? 'default' : 'secondary'} 
                  className="text-sm"
                >
                  {customer.customer_type === 'company' ? 'Company' : 'Private'}
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {customer.customer_type === 'company' && customer.contact_person && `${customer.contact_person} • `}
                {customer.customer_type === 'private' && customer.company_name && `${customer.company_name} • `}
                Customer since {new Date(customer.created_at).getFullYear()}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleEditClick}>
              <Edit className="mr-2 h-4 w-4" />
              {t('pages.customer_detail.edit_customer')}
            </Button>
            <Button variant="destructive" onClick={handleDeleteCustomer}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('pages.customer_detail.delete_customer')}
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.customer_detail.total_machines')}</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMachines}</div>
              <p className="text-xs text-muted-foreground">{t('pages.customer_detail.machines_owned')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.customer_detail.active_warranty')}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeWarrantyMachines}</div>
              <p className="text-xs text-muted-foreground">{t('pages.customer_detail.under_warranty')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.customer_detail.work_orders')}</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWorkOrders}</div>
              <p className="text-xs text-muted-foreground">{t('pages.customer_detail.total_repairs')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.customer_detail.warranty_work_orders')}</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalWarrantyWorkOrders}</div>
              <p className="text-xs text-muted-foreground">{t('pages.customer_detail.warranty_repairs')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.customer_detail.total_spent')}</CardTitle>
              <Euro className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSpent)}</div>
              <p className="text-xs text-muted-foreground">{t('pages.customer_detail.total_purchases')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">{t('pages.customer_detail.customer_details')}</TabsTrigger>
            <TabsTrigger value="machines">{t('pages.customer_detail.machines_tab')} ({machines.length})</TabsTrigger>
            <TabsTrigger value="work-orders">{t('pages.customer_detail.work_orders_tab')} ({workOrders.length})</TabsTrigger>
            <TabsTrigger value="warranty-work-orders">{t('pages.customer_detail.warranty_work_orders_tab')} ({warrantyWorkOrders.length})</TabsTrigger>
          </TabsList>

          {/* Customer Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {customer.customer_type === 'company' ? t('pages.customer_detail.contact_information') : t('pages.customer_detail.personal_information')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {customer.customer_type === 'company' ? (
                      <>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{t('common.company')} {t('common.name')}</p>
                          <p className="text-sm">{customer.company_name || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.contact_person')}</p>
                          <p className="text-sm">{customer.contact_person || 'N/A'}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.full_name')}</p>
                          <p className="text-sm">{customer.name}</p>
                        </div>
                        {customer.company_name && (
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.company')}</p>
                            <p className="text-sm">{customer.company_name}</p>
                          </div>
                        )}
                      </>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.email')}</p>
                      <p className="text-sm">{customer.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.phone')}</p>
                      <p className="text-sm">{customer.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.phone')} 2</p>
                      <p className="text-sm">{customer.phone2 || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.fax')}</p>
                      <p className="text-sm">{customer.fax || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.created_at')}</p>
                      <p className="text-sm">{formatDate(customer.created_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Business Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    {customer.customer_type === 'company' ? t('pages.customer_detail.business_information') : t('pages.customer_detail.address_information')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {customer.customer_type === 'company' && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.vat_number')}</p>
                        <p className="text-sm">{customer.vat_number || 'N/A'}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.street_address')}</p>
                      <p className="text-sm">{customer.street_address || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.city')}</p>
                      <p className="text-sm">{customer.city || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.postal_code')}</p>
                      <p className="text-sm">{customer.postal_code || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.owner')}</p>
                      <p className="text-sm">{customer.owner_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.assigned_at')}</p>
                      <p className="text-sm">
                        {customer.assigned_at 
                          ? formatDate(customer.assigned_at)
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.last_updated')}</p>
                      <p className="text-sm">{formatDate(customer.updated_at)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ownership Information */}
              {customer.ownership_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      {t('pages.customer_detail.ownership_information')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{t('pages.customer_detail.ownership_notes')}</p>
                      <p className="text-sm bg-muted p-3 rounded mt-2">{customer.ownership_notes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Machines Tab */}
          <TabsContent value="machines" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  {t('pages.customer_detail.customer_machines')} ({machines.length})
                  {machines.length > 0 && (
                    <div className="flex items-center gap-2 ml-4 text-sm font-normal">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <ShoppingCart className="w-3 h-3 mr-1" />
                        {machines.filter(m => m.machine_type === 'sold').length} {t('pages.customer_detail.sold')}
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        <Settings className="w-3 h-3 mr-1" />
                        {machines.filter(m => m.machine_type === 'repair').length} {t('pages.customer_detail.repair')}
                      </Badge>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {machines.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('pages.customer_detail.no_machines')}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('pages.customer_detail.machine_type')}</TableHead>
                        <TableHead>{t('pages.customer_detail.serial_number')}</TableHead>
                        <TableHead>{t('pages.customer_detail.model')}</TableHead>
                        <TableHead>{t('pages.customer_detail.manufacturer')}</TableHead>
                        <TableHead>{t('pages.customer_detail.condition')}</TableHead>
                        <TableHead>{t('pages.customer_detail.date')}</TableHead>
                        <TableHead>{t('pages.customer_detail.warranty_active')}</TableHead>
                        <TableHead>{t('pages.customer_detail.sale_price')}</TableHead>
                        <TableHead className="text-right">{t('pages.customer_detail.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {machines.map((machine) => (
                        <TableRow 
                          key={machine.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/machines/${machine.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getMachineTypeIcon(machine.machine_type)}
                              {getMachineTypeBadge(machine.machine_type)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            <Button 
                              variant="link" 
                              className="p-0 h-auto font-medium"
                              onClick={() => navigate(`/machines/${machine.id}`)}
                            >
                              {machine.serial_number || 'N/A'}
                            </Button>
                          </TableCell>
                          <TableCell>{machine.model_name}</TableCell>
                          <TableCell>{machine.manufacturer}</TableCell>
                          <TableCell>{getConditionBadge(machine.machine_condition)}</TableCell>
                          <TableCell>
                            {machine.machine_type === 'sold' 
                              ? (machine.sale_date ? formatDate(machine.sale_date) : 'N/A')
                              : (machine.received_date ? formatDate(machine.received_date) : 'N/A')
                            }
                          </TableCell>
                          <TableCell>{getWarrantyStatus(machine.warranty_active, machine.warranty_expiry_date, machine.machine_type)}</TableCell>
                          <TableCell>
                            {machine.machine_type === 'sold' 
                              ? (machine.sale_price ? formatCurrency(machine.sale_price) : 'N/A')
                              : (machine.sale_price ? formatCurrency(machine.sale_price) : 'N/A')
                            }
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
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/machines/${machine.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Machine Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/machines/${machine.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Machine
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => handleDeleteMachine(machine)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete Machine
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Work Orders Tab */}
          <TabsContent value="work-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  {t('pages.customer_detail.work_orders')} ({workOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('pages.customer_detail.no_work_orders')}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>{t('pages.customer_detail.status_label')}</TableHead>
                        <TableHead>{t('pages.customer_detail.priority')}</TableHead>
                        <TableHead>{t('pages.customer_detail.description')}</TableHead>
                        <TableHead>{t('pages.customer_detail.machine')}</TableHead>
                        <TableHead>{t('pages.customer_detail.assigned_technician')}</TableHead>
                        <TableHead>{t('pages.customer_detail.created_date')}</TableHead>
                        <TableHead>{t('pages.customer_detail.total_cost')}</TableHead>
                        <TableHead className="text-right">{t('pages.customer_detail.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {workOrders.map((workOrder) => (
                        <TableRow key={workOrder.id}>
                          <TableCell className="font-medium">
                            <Button 
                              variant="link" 
                              className="p-0 h-auto"
                              onClick={() => navigate(`/work-orders/${workOrder.id}`)}
                            >
                              #{workOrder.formatted_number || workOrder.id}
                            </Button>
                          </TableCell>
                          <TableCell>{getStatusBadge(workOrder.status)}</TableCell>
                          <TableCell>{getPriorityBadge(workOrder.priority)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {workOrder.description || 'No description'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs"
                              onClick={() => navigate(`/machines/${workOrder.machine_id}`)}
                            >
                              {workOrder.serial_number}
                            </Button>
                          </TableCell>
                          <TableCell>{workOrder.technician_name || 'Unassigned'}</TableCell>
                          <TableCell>{formatDate(workOrder.created_at)}</TableCell>
                          <TableCell>
                            {workOrder.quote_total ? formatCurrency(workOrder.quote_total) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/work-orders/${workOrder.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/work-orders/${workOrder.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Work Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Warranty Work Orders Tab */}
          <TabsContent value="warranty-work-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  {t('pages.customer_detail.warranty_work_orders')} ({warrantyWorkOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {warrantyWorkOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t('pages.customer_detail.no_warranty_work_orders')}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>{t('pages.customer_detail.status_label')}</TableHead>
                        <TableHead>{t('pages.customer_detail.priority')}</TableHead>
                        <TableHead>{t('pages.customer_detail.description')}</TableHead>
                        <TableHead>{t('pages.customer_detail.machine')}</TableHead>
                        <TableHead>{t('pages.customer_detail.assigned_technician')}</TableHead>
                        <TableHead>{t('pages.customer_detail.created_date')}</TableHead>
                        <TableHead>{t('pages.customer_detail.total_cost')}</TableHead>
                        <TableHead className="text-right">{t('pages.customer_detail.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {warrantyWorkOrders.map((workOrder) => (
                        <TableRow key={workOrder.id}>
                          <TableCell className="font-medium">
                            <Button 
                              variant="link" 
                              className="p-0 h-auto"
                              onClick={() => navigate(`/warranty-work-orders/${workOrder.id}`)}
                            >
                              #{workOrder.formatted_number || workOrder.id}
                            </Button>
                          </TableCell>
                          <TableCell>{getStatusBadge(workOrder.status)}</TableCell>
                          <TableCell>{getPriorityBadge(workOrder.priority)}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {workOrder.description || 'No description'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="link" 
                              className="p-0 h-auto text-xs"
                              onClick={() => navigate(`/machines/${workOrder.machine_id}`)}
                            >
                              {workOrder.serial_number}
                            </Button>
                          </TableCell>
                          <TableCell>{workOrder.technician_name || 'Unassigned'}</TableCell>
                          <TableCell>{formatDate(workOrder.created_at)}</TableCell>
                          <TableCell>
                            {workOrder.quote_total ? formatCurrency(workOrder.quote_total) : 'N/A'}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => navigate(`/warranty-work-orders/${workOrder.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/warranty-work-orders/${workOrder.id}`)}>
                                  <Edit className="mr-2 h-4 w-4" /> Edit Work Order
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDeleteCustomer}
          title={t('pages.customer_detail.delete_customer')}
          itemName={customer?.name}
          itemType="customer"
        />

        {/* Machine Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={machineDeleteDialogOpen}
          onOpenChange={setMachineDeleteDialogOpen}
          onConfirm={confirmDeleteMachine}
          title="Delete Machine"
          itemName={machineToDelete?.name}
          itemType="machine"
        />

        {/* Customer with Machines Alert Dialog */}
        <GeneralAlertDialog
          open={machineAlertOpen}
          onOpenChange={setMachineAlertOpen}
          title={t('pages.customer_detail.cannot_delete_customer')}
          description={`Cannot delete ${customer?.name} because they have ${machines.length} machine(s) assigned. Please contact an administrator to reassign or remove the machines first.`}
          confirmText="OK"
          showCancel={false}
        />

        {/* Edit Customer Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('pages.customer_detail.edit_customer')}</DialogTitle>
              <DialogDescription>
                {t('pages.customer_detail.update_customer_info')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Customer Type */}
              <div className="space-y-2">
                <Label htmlFor="customer_type">{t('pages.customer_detail.customer_type')}</Label>
                <Select 
                  value={editFormData.customer_type} 
                  onValueChange={(value: 'private' | 'company') => handleInputChange('customer_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.customer_detail.select_status')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">{t('status.private')}</SelectItem>
                    <SelectItem value="company">{t('status.company')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">{t('common.name')} *</Label>
                <Input
                  id="name"
                  value={editFormData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder={t('pages.customer_detail.enter_name')}
                  required
                />
              </div>

              {/* Contact Person (for company customers) */}
              {editFormData.customer_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="contact_person">{t('pages.customer_detail.contact_person')}</Label>
                  <Input
                    id="contact_person"
                    value={editFormData.contact_person || ''}
                    onChange={(e) => handleInputChange('contact_person', e.target.value)}
                    placeholder={t('pages.customer_detail.enter_contact_person')}
                  />
                </div>
              )}

              {/* Company Name (for company customers) */}
              {editFormData.customer_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="company_name">{t('common.company')} {t('common.name')}</Label>
                  <Input
                    id="company_name"
                    value={editFormData.company_name || ''}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    placeholder={t('pages.customer_detail.enter_company_name')}
                  />
                </div>
              )}

              {/* VAT Number (for company customers) */}
              {editFormData.customer_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="vat_number">{t('pages.customer_detail.vat_number')}</Label>
                  <Input
                    id="vat_number"
                    value={editFormData.vat_number || ''}
                    onChange={(e) => handleInputChange('vat_number', e.target.value)}
                    placeholder={t('pages.customer_detail.enter_vat_number')}
                  />
                </div>
              )}

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('pages.customer_detail.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder={t('pages.customer_detail.enter_email')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('pages.customer_detail.phone')}</Label>
                  <Input
                    id="phone"
                    value={editFormData.phone || ''}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder={t('pages.customer_detail.enter_phone')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone2">{t('pages.customer_detail.phone')} 2</Label>
                  <Input
                    id="phone2"
                    value={editFormData.phone2 || ''}
                    onChange={(e) => handleInputChange('phone2', e.target.value)}
                    placeholder={t('pages.customer_detail.enter_secondary_phone')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    value={editFormData.fax || ''}
                    onChange={(e) => handleInputChange('fax', e.target.value)}
                    placeholder={t('pages.customer_detail.enter_fax_number')}
                  />
                </div>
              </div>

              {/* Address Information */}
              <div className="space-y-2">
                <Label htmlFor="street_address">{t('pages.customer_detail.street_address')}</Label>
                <Input
                  id="street_address"
                  value={editFormData.street_address || ''}
                  onChange={(e) => handleInputChange('street_address', e.target.value)}
                  placeholder="Enter street address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">{t('pages.customer_detail.city')}</Label>
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
                <Label htmlFor="owner_id">{t('pages.customer_detail.owner')}</Label>
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
                {t('pages.customer_detail.cancel')}
              </Button>
              <Button onClick={handleSaveCustomer} disabled={isSaving || !editFormData.name.trim()}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('pages.customer_detail.saving')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('pages.customer_detail.save_changes')}
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