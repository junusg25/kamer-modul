import React, { useState, useEffect } from 'react'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  Info,
  DollarSign,
  Tag,
  MapPin,
  Building,
  Phone,
  Mail,
  Package,
  Euro,
  Settings,
  FileText,
  Clock,
  Award,
  Shield,
  Activity
} from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import apiService from '@/services/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'
import { formatDate } from '@/lib/dateTime'
import { formatCurrency } from '@/lib/currency'

interface Machine {
  id: string
  customer_id: string
  name: string
  model_name: string
  catalogue_number?: string
  serial_number: string
  description?: string
  warranty_expiry_date?: string
  warranty_active: boolean
  created_at: string
  updated_at: string
  manufacturer: string
  purchase_date?: string
  category_id?: string
  receipt_number?: string
  customer_name: string
  category_name?: string
  sold_by_user_id?: string
  added_by_user_id?: string
  machine_condition?: 'new' | 'used'
  sale_date?: string
  sale_price?: number
  is_sale: boolean
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

export default function MachineDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [machine, setMachine] = useState<Machine | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [warrantyWorkOrders, setWarrantyWorkOrders] = useState<WarrantyWorkOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    warranty_expiry_date: '',
    warranty_active: true,
    machine_condition: 'new' as 'new' | 'used',
    sale_price: '',
    receipt_number: '',
    purchased_at: ''
  })
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (id) {
      fetchMachineDetails()
    }
  }, [id])

  const fetchMachineDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch machine details
      const machineResponse = await apiService.getMachine(id!)
      setMachine(machineResponse.data)

      // Fetch work orders for this machine
      const workOrdersResponse = await apiService.getMachineWorkOrders(id!)
      setWorkOrders(workOrdersResponse.data || [])

      // Fetch warranty work orders for this machine
      const warrantyWorkOrdersResponse = await apiService.getMachineWarrantyWorkOrders(id!)
      setWarrantyWorkOrders(warrantyWorkOrdersResponse.data || [])
    } catch (err) {
      setError('Failed to load machine details.')
      console.error('Error fetching machine details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditClick = () => {
    if (machine) {
      setEditFormData({
        name: machine.name || '',
        description: machine.description || '',
        warranty_expiry_date: machine.warranty_expiry_date || '',
        warranty_active: machine.warranty_active,
        machine_condition: machine.machine_condition || 'new',
        sale_price: machine.sale_price?.toString() || '',
        receipt_number: machine.receipt_number || '',
        purchased_at: machine.purchased_at || ''
      })
      setIsEditDialogOpen(true)
    }
  }

  const handleEditSubmit = async () => {
    if (!machine) return

    try {
      setIsEditing(true)
      
      const updateData = {
        name: editFormData.name,
        description: editFormData.description,
        warranty_expiry_date: editFormData.warranty_expiry_date || null,
        warranty_active: editFormData.warranty_active,
        machine_condition: editFormData.machine_condition,
        sale_price: editFormData.sale_price ? parseFloat(editFormData.sale_price) : null,
        receipt_number: editFormData.receipt_number || null,
        purchased_at: editFormData.purchased_at || null
      }

      // Use the correct API endpoint based on machine type
      if (machine.machine_type === 'sold') {
        await apiService.updateSoldMachine(machine.id, updateData)
      } else {
        await apiService.updateMachine(machine.id, updateData)
      }
      
      toast.success("Machine updated successfully.")
      
      setIsEditDialogOpen(false)
      fetchMachineDetails() // Refresh the data
    } catch (err) {
      console.error('Error updating machine:', err)
      toast.error("Failed to update machine. Please try again.")
    } finally {
      setIsEditing(false)
    }
  }

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!machine) return

    try {
      setIsDeleting(true)
      
      // Use the correct API endpoint based on machine type
      if (machine.machine_type === 'sold') {
        await apiService.deleteSoldMachine(machine.id)
      } else {
        await apiService.deleteMachine(machine.id)
      }
      
      toast.success("Machine permanently deleted successfully.")
      
      setIsDeleteDialogOpen(false)
      navigate('/machines') // Navigate back to machines list
    } catch (err: any) {
      console.error('Error deleting machine:', err)
      const errorMessage = err.response?.data?.message || "Failed to delete machine. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  const getWarrantyStatus = () => {
    if (!machine?.warranty_expiry_date) {
      return { status: 'No Warranty', color: 'secondary' as const }
    }

    const expiryDate = new Date(machine.warranty_expiry_date)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (!machine.warranty_active || daysUntilExpiry < 0) {
      return { status: 'Expired', color: 'destructive' as const }
    } else if (daysUntilExpiry <= 90) {
      return { status: `Expires in ${daysUntilExpiry} days`, color: 'outline' as const }
    } else {
      return { status: 'Active', color: 'default' as const }
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading machine details...</span>
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

  if (!machine) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not Found</AlertTitle>
          <AlertDescription>Machine not found.</AlertDescription>
        </Alert>
      </MainLayout>
    )
  }

  const warrantyStatus = getWarrantyStatus()

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
              <h1 className="text-3xl font-bold tracking-tight">{machine.name}</h1>
              <p className="text-muted-foreground">
                Serial: {machine.serial_number} • {machine.manufacturer}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleEditClick}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Machine
            </Button>
            <Button variant="destructive" onClick={handleDeleteClick}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Machine
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warranty Status</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={warrantyStatus.color} className="text-sm">
                {warrantyStatus.status}
              </Badge>
              {machine.warranty_expiry_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Expires: {formatDate(machine.warranty_expiry_date)}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Work Orders</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{workOrders.length}</div>
              <p className="text-xs text-muted-foreground">Total work orders</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Warranty Work Orders</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{warrantyWorkOrders.length}</div>
              <p className="text-xs text-muted-foreground">Warranty repairs</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium">{machine.customer_name}</div>
              <Button 
                variant="link" 
                className="p-0 h-auto text-xs"
                onClick={() => navigate(`/customers/${machine.customer_id}`)}
              >
                View Customer
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="details" className="space-y-4">
          <TabsList>
            <TabsTrigger value="details">Machine Details</TabsTrigger>
            <TabsTrigger value="work-orders">Work Orders ({workOrders.length})</TabsTrigger>
            <TabsTrigger value="warranty-work-orders">Warranty Work Orders ({warrantyWorkOrders.length})</TabsTrigger>
          </TabsList>

          {/* Machine Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Machine Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    Machine Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Name</p>
                      <p className="text-sm">{machine.name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Model</p>
                      <p className="text-sm">{machine.model_name}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                      <p className="text-sm font-mono">{machine.serial_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                      <p className="text-sm">{machine.manufacturer}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Catalogue Number</p>
                      <p className="text-sm">{machine.catalogue_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Category</p>
                      <p className="text-sm">{machine.category_name || 'N/A'}</p>
                    </div>
                  </div>
                  {machine.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                      <p className="text-sm">{machine.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sales & Assignment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Sales & Assignment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Transaction Type</p>
                      <Badge variant={machine.is_sale ? 'default' : 'outline'}>
                        {machine.is_sale ? 'Sale' : 'Assignment'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Condition</p>
                      <Badge variant={machine.machine_condition === 'new' ? 'default' : 'outline'}>
                        {machine.machine_condition || 'N/A'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Purchase Date</p>
                      <p className="text-sm">{machine.purchase_date ? formatDate(machine.purchase_date) : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Sale Price</p>
                      <p className="text-sm">
                        {machine.sale_price ? formatCurrency(machine.sale_price) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Receipt Number</p>
                      <p className="text-sm">{machine.receipt_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Purchased At</p>
                      <p className="text-sm">{machine.purchased_at || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Sold By</p>
                      <p className="text-sm">{machine.sold_by_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Added By</p>
                      <p className="text-sm">{machine.added_by_name || 'N/A'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Work Orders Tab */}
          <TabsContent value="work-orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Work Orders ({workOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {workOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No work orders found for this machine.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Total Cost</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                          <TableCell>{workOrder.technician_name || 'Unassigned'}</TableCell>
                          <TableCell>{formatDate(workOrder.created_at)}</TableCell>
                          <TableCell>
                            {(() => {
                              // For now, prioritize the stored total_cost if it exists, as it should be more accurate
                              // The work order detail page updates this field when inventory changes
                              if (workOrder.total_cost && workOrder.total_cost > 0) {
                                return formatCurrency(workOrder.total_cost)
                              }
                              
                              // Fallback to calculated total if total_cost is not available
                              const laborCost = (parseFloat(workOrder.labor_hours?.toString() || '0') || 0) * (parseFloat(workOrder.labor_rate?.toString() || '0') || 0)
                              const partsCost = parseFloat(workOrder.quote_subtotal_parts?.toString() || '0') || 0
                              const troubleshootingCost = parseFloat(workOrder.troubleshooting_fee?.toString() || '0') || 0
                              const calculatedTotal = laborCost + partsCost + troubleshootingCost
                              
                              if (calculatedTotal > 0) {
                                return formatCurrency(calculatedTotal)
                              } else if (workOrder.quote_total) {
                                return formatCurrency(workOrder.quote_total)
                              } else {
                                return 'N/A'
                              }
                            })()}
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
                  Warranty Work Orders ({warrantyWorkOrders.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {warrantyWorkOrders.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No warranty work orders found for this machine.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Technician</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
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
                          <TableCell>{workOrder.technician_name || 'Unassigned'}</TableCell>
                          <TableCell>{formatDate(workOrder.created_at)}</TableCell>
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
      </div>

      {/* Edit Machine Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Machine</DialogTitle>
            <DialogDescription>
              Update the machine information below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Machine Name</Label>
                <Input
                  id="name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter machine name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="machine_condition">Condition</Label>
                <Select
                  value={editFormData.machine_condition}
                  onValueChange={(value: 'new' | 'used') => setEditFormData(prev => ({ ...prev, machine_condition: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="used">Used</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editFormData.description}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter machine description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warranty_expiry_date">Warranty Expiry Date</Label>
                <DatePicker
                  value={editFormData.warranty_expiry_date}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, warranty_expiry_date: value }))}
                  placeholder="Select warranty expiry date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_price">Sale Price (KM)</Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  value={editFormData.sale_price}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, sale_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="receipt_number">Receipt Number</Label>
                <Input
                  id="receipt_number"
                  value={editFormData.receipt_number}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, receipt_number: e.target.value }))}
                  placeholder="Enter receipt number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchased_at">Purchased At</Label>
                <Input
                  id="purchased_at"
                  value={editFormData.purchased_at}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, purchased_at: e.target.value }))}
                  placeholder="e.g., AMS, Kamer.ba"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="warranty_active"
                checked={editFormData.warranty_active}
                onChange={(e) => setEditFormData(prev => ({ ...prev, warranty_active: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="warranty_active">Warranty Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isEditing}>
              {isEditing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Updating...' : 'Update Machine'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Machine</DialogTitle>
            <DialogDescription>
              <div className="space-y-2">
                <p>Are you sure you want to permanently delete this machine? This action cannot be undone and will:</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Remove the machine assignment</li>
                  <li>Delete the machine serial permanently</li>
                </ul>
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This machine cannot be deleted if it has associated repair tickets, work orders, or warranty records. Please delete or reassign those records first.
                  </p>
                </div>
                <div className="mt-4 space-y-1">
                  <p><strong>Machine:</strong> {machine?.name}</p>
                  <p><strong>Serial:</strong> {machine?.serial_number}</p>
                  <p><strong>Customer:</strong> {machine?.customer_name}</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  )
}
