import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { CompletedItemAlertDialog } from '../components/ui/completed-item-alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  ArrowLeft,
  Edit,
  Save,
  X,
  Trash2,
  Eye,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  User,
  Wrench,
  Printer,
  Package,
  Settings,
  MessageSquare,
  Plus,
  UserCheck,
  DollarSign,
  Truck
} from 'lucide-react'
import apiService from '../services/api'
import { useAuth } from '../contexts/auth-context'
import { toast } from 'sonner'
import { formatDate, formatDateTime } from '../lib/dateTime'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '../lib/status'

interface WorkOrder {
  id: string
  formatted_number?: string
  description?: string
  status: string
  priority?: string
  technician_id?: string
  owner_technician_id?: string
  started_at?: string
  completed_at?: string
  labor_hours?: number
  labor_rate?: number
  troubleshooting_fee?: number
  quote_subtotal_parts?: number
  quote_total?: number
  is_warranty?: boolean
  
  // Customer fields
  customer_id?: string
  customer_name?: string
  customer_phone?: string
  customer_email?: string
  customer_company?: string
  customer_address?: string
  customer_city?: string
  customer_vat_number?: string
  customer_owner_name?: string
  
  // Machine fields
  machine_id?: string
  machine_name?: string
  serial_number?: string
  technician_name?: string
  owner_technician_name?: string
  
  created_at: string
  updated_at: string
}

interface Note {
  id: string
  content: string
  created_at: string
  user_name?: string
}

interface InventoryItem {
  id: string
  inventory_id: string
  inventory_name: string
  quantity: number
  unit_price: number
  total_price: number
}

interface User {
  id: string
  name: string
  role: string
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  
  // State
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [allInventory, setAllInventory] = useState<any[]>([])
  
  // UI State
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Dialog states
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false)
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null)
  const [editQuantity, setEditQuantity] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [completedAlertOpen, setCompletedAlertOpen] = useState(false)
  
  // Form state
  const [form, setForm] = useState({
    description: '',
    status: 'pending',
    priority: 'medium',
    technician_id: '',
    labor_hours: '',
    labor_rate: '50',
    troubleshooting_fee: '',
    is_warranty: false,
    started_at: '',
    completed_at: ''
  })
  
  // Dialog form states
  const [newNote, setNewNote] = useState('')
  const [newInventory, setNewInventory] = useState({
    inventory_id: '',
    quantity: 1
  })

  useEffect(() => {
    if (id) {
      fetchWorkOrderDetails()
    }
  }, [id])

  const fetchWorkOrderDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Fetch work order details
      const workOrderResponse = await apiService.getWorkOrder(id!) as any
      setWorkOrder(workOrderResponse.data)
      
      // Initialize form with work order data
      if (workOrderResponse.data) {
        const wo = workOrderResponse.data
        setForm({
          description: wo.description || '',
          status: wo.status || 'pending',
          priority: wo.priority || 'medium',
          technician_id: wo.owner_technician_id || wo.technician_id || 'unassigned',
          labor_hours: wo.labor_hours?.toString() || '',
          labor_rate: wo.labor_rate?.toString() || '50',
          troubleshooting_fee: wo.troubleshooting_fee?.toString() || '',
          is_warranty: wo.is_warranty || false,
          started_at: wo.started_at || '',
          completed_at: wo.completed_at || ''
        })
      }
      
      // Fetch related data
      await Promise.all([
        fetchNotes(),
        fetchInventory(),
        fetchUsers(),
        fetchAllInventory()
      ])
      
    } catch (err) {
      setError('Failed to load work order details.')
      console.error('Error fetching work order details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNotes = async () => {
    try {
      const response = await apiService.getWorkOrderNotes(id!) as any
      setNotes(response.data || response || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
    }
  }

  const fetchInventory = async () => {
    try {
      const response = await apiService.getWorkOrderInventory(id!) as any
      setInventory(response.data || response || [])
    } catch (err) {
      console.error('Error fetching inventory:', err)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await apiService.getUsers() as any
      const usersData = response.data || response
      setUsers(Array.isArray(usersData) ? usersData : [])
    } catch (err) {
      console.error('Error fetching users:', err)
    }
  }

  const fetchAllInventory = async () => {
    try {
      const response = await apiService.getInventory({ limit: 1000 }) as any
      setAllInventory(response.data || [])
    } catch (err) {
      console.error('Error fetching inventory:', err)
    }
  }

  const handleSave = async () => {
    if (!workOrder) return

    setIsSaving(true)
    try {
      const updates: any = {}
      
      // Check for changes and add to updates
      if (form.description !== workOrder.description) {
        updates.description = form.description
      }
      if (form.status !== workOrder.status) {
        updates.status = form.status
      }
      if (form.priority !== workOrder.priority) {
        updates.priority = form.priority
      }
      if (form.technician_id !== (workOrder.technician_id?.toString() || '')) {
        updates.technician_id = form.technician_id && form.technician_id !== 'unassigned' ? parseInt(form.technician_id) : null
      }
      if (form.labor_hours !== (workOrder.labor_hours?.toString() || '')) {
        updates.labor_hours = form.labor_hours ? parseFloat(form.labor_hours) : null
      }
      if (form.labor_rate !== (workOrder.labor_rate?.toString() || '')) {
        updates.labor_rate = form.labor_rate ? parseFloat(form.labor_rate) : null
      }
      if (form.troubleshooting_fee !== (workOrder.troubleshooting_fee?.toString() || '')) {
        updates.troubleshooting_fee = form.troubleshooting_fee ? parseFloat(form.troubleshooting_fee) : null
      }
      if (form.is_warranty !== workOrder.is_warranty) {
        updates.is_warranty = form.is_warranty
      }

      // Always calculate and update total_cost
      const calculatedTotalCost = calculateTotalCost()
      updates.total_cost = calculatedTotalCost

      // Note: started_at and completed_at are handled automatically by the backend
      // based on status changes, so we don't send them explicitly

      // Always make API call to update total_cost, even if no other fields changed
      await apiService.updateWorkOrder(workOrder.id, updates)
      
      toast.success('Work order updated successfully')
      setIsEditing(false)
      await fetchWorkOrderDetails()
      
    } catch (err: any) {
      console.error('Error updating work order:', err)
      toast.error(err.response?.data?.message || 'Failed to update work order')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (workOrder) {
      setForm({
        description: workOrder.description || '',
        status: workOrder.status || 'pending',
        priority: workOrder.priority || 'medium',
        technician_id: workOrder.owner_technician_id || workOrder.technician_id || 'unassigned',
        labor_hours: workOrder.labor_hours?.toString() || '',
        labor_rate: workOrder.labor_rate?.toString() || '50',
        troubleshooting_fee: workOrder.troubleshooting_fee?.toString() || '',
        is_warranty: workOrder.is_warranty || false,
        started_at: workOrder.started_at || '',
        completed_at: workOrder.completed_at || ''
      })
    }
    setIsEditing(false)
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return

    try {
      await apiService.createWorkOrderNote({
        work_order_id: parseInt(id!),
        content: newNote
      })
      
      toast.success('Note added successfully')
      setNewNote('')
      setNoteDialogOpen(false)
      await fetchNotes()
      
    } catch (err: any) {
      console.error('Error adding note:', err)
      toast.error(err.response?.data?.message || 'Failed to add note')
    }
  }

  const handleAddInventory = async () => {
    if (!newInventory.inventory_id || !newInventory.quantity) return

    try {
      await apiService.createWorkOrderInventory({
        work_order_id: parseInt(id!),
        inventory_id: parseInt(newInventory.inventory_id),
        quantity: parseInt(newInventory.quantity.toString())
      })
      
      toast.success('Part added successfully')
      setNewInventory({ inventory_id: '', quantity: 1 })
      setInventoryDialogOpen(false)
      await fetchInventory()
      await fetchWorkOrderDetails() // Refresh to update costs
      
      // Update total cost in database after adding inventory
      if (workOrder) {
        const calculatedTotalCost = calculateTotalCost()
        await apiService.updateWorkOrder(workOrder.id, { total_cost: calculatedTotalCost })
      }
      
    } catch (err: any) {
      console.error('Error adding inventory:', err)
      toast.error(err.response?.data?.message || 'Failed to add part')
    }
  }

  const handleEditInventory = (item: InventoryItem) => {
    setEditingInventoryItem(item)
    setEditQuantity(item.quantity.toString())
  }

  const handleUpdateInventory = async () => {
    if (!editingInventoryItem) return
    
    try {
      await apiService.updateWorkOrderInventory(editingInventoryItem.id, {
        quantity: parseInt(editQuantity)
      })
      
      toast.success('Part updated successfully')
      setEditingInventoryItem(null)
      setEditQuantity('')
      await fetchInventory()
      await fetchWorkOrderDetails()
      
      // Update total cost in database after updating inventory
      if (workOrder) {
        const calculatedTotalCost = calculateTotalCost()
        await apiService.updateWorkOrder(workOrder.id, { total_cost: calculatedTotalCost })
      }
    } catch (err: any) {
      console.error('Error updating inventory:', err)
      toast.error(err.response?.data?.message || 'Failed to update part')
    }
  }

  const handleDeleteInventory = async (item: InventoryItem) => {
    try {
      await apiService.deleteWorkOrderInventory(item.id)
      
      toast.success('Part deleted successfully')
      await fetchInventory()
      await fetchWorkOrderDetails()
      
      // Update total cost in database after deleting inventory
      if (workOrder) {
        const calculatedTotalCost = calculateTotalCost()
        await apiService.updateWorkOrder(workOrder.id, { total_cost: calculatedTotalCost })
      }
    } catch (err: any) {
      console.error('Error deleting inventory:', err)
      toast.error(err.response?.data?.message || 'Failed to delete part')
    }
  }

  const handleDelete = async () => {
    if (!workOrder) return

    try {
      await apiService.deleteWorkOrder(workOrder.id)
      toast.success('Work order deleted successfully')
      navigate('/work-orders')
    } catch (err: any) {
      console.error('Error deleting work order:', err)
      toast.error(err.response?.data?.message || 'Failed to delete work order')
    }
  }

  const handlePrint = async () => {
    if (!workOrder) return

    try {
            
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3000/api/print/work-order/${workOrder.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

            
      if (!response.ok) {
        const errorData = await response.json()
                throw new Error(`Failed to generate PDF: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      }
      
      // Clean up the URL after printing
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
      }, 1000)

    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF for printing')
    }
  }

  const handleDownloadPDF = async () => {
    if (!workOrder) return

    try {
            
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:3000/api/print/work-order/${workOrder.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

            
      if (!response.ok) {
        const errorData = await response.json()
                throw new Error(`Failed to generate PDF: ${response.status} ${response.statusText}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `work-order-${workOrder.formatted_number || workOrder.id}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      toast.success('PDF downloaded successfully')

    } catch (error) {
      console.error('Error downloading PDF:', error)
      toast.error('Failed to download PDF')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      intake: FileText,
      pending: Clock,
      in_progress: Activity,
      completed: CheckCircle,
      cancelled: XCircle,
      testing: Settings,
      parts_ordered: Package,
      waiting_approval: UserCheck,
      waiting_supplier: Truck,
      service_cancelled: XCircle
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
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>
      case 'medium':
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Medium</Badge>
      case 'low':
        return <Badge variant="outline" className="border-green-300 text-green-700">Low</Badge>
      default:
        return <Badge variant="outline">Normal</Badge>
    }
  }

  const calculateTotalCost = () => {
    const laborCost = (parseFloat(form.labor_hours) || 0) * (parseFloat(form.labor_rate) || 0)
    const partsCost = (inventory || []).reduce((sum: number, item) => sum + (Number(item.total_price) || 0), 0)
    const troubleshootingCost = parseFloat(form.troubleshooting_fee) || 0
    return Number(laborCost + partsCost + troubleshootingCost)
  }

  const calculateDuration = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diffMs = end.getTime() - start.getTime()
    
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  const handleStatusChange = (newStatus: string) => {
    const currentStatus = form.status
    const now = new Date().toISOString()
    
    setForm(prev => {
      const updated = { ...prev, status: newStatus }
      
      // Auto-assign started_at when changing to 'in_progress'
      if (newStatus === 'in_progress' && currentStatus !== 'in_progress') {
        updated.started_at = now
      }
      
      // Auto-assign completed_at when changing to 'completed'
      if (newStatus === 'completed' && currentStatus !== 'completed') {
        updated.completed_at = now
      }
      
      // Clear completed_at when changing from 'completed' to any other status
      if (currentStatus === 'completed' && newStatus !== 'completed') {
        updated.completed_at = ''
      }
      
      return updated
    })
  }

  const canEdit = user?.role !== 'sales' // Sales users cannot edit

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading work order details...</span>
        </div>
      </MainLayout>
    )
  }

  if (error || !workOrder) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'Work order not found'}</AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                <Wrench className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  Work Order {workOrder.formatted_number || `#${workOrder.id}`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Created {formatDate(workOrder.created_at)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                {user?.role !== 'sales' && (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    disabled={!canEdit}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                {user?.role !== 'sales' && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      // Check if work order is completed
                      if (workOrder?.status === 'completed') {
                        setCompletedAlertOpen(true)
                        return
                      }
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Customer & Machine Info */}
          <div className="space-y-6">
            {/* Customer Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm font-medium">{workOrder.customer_name || 'N/A'}</p>
                </div>
                
                {workOrder.customer_phone && (
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm">{workOrder.customer_phone}</p>
                  </div>
                )}
                
                {workOrder.customer_email && (
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm">{workOrder.customer_email}</p>
                  </div>
                )}
                
                {workOrder.customer_company && (
                  <div>
                    <Label className="text-sm font-medium">Company</Label>
                    <p className="text-sm">{workOrder.customer_company}</p>
                  </div>
                )}
                
                {workOrder.customer_address && (
                  <div>
                    <Label className="text-sm font-medium">Address</Label>
                    <p className="text-sm">{workOrder.customer_address}</p>
                  </div>
                )}
                
                {workOrder.customer_city && (
                  <div>
                    <Label className="text-sm font-medium">City</Label>
                    <p className="text-sm">{workOrder.customer_city}</p>
                  </div>
                )}
                
                {workOrder.customer_vat_number && (
                  <div>
                    <Label className="text-sm font-medium">VAT Number</Label>
                    <p className="text-sm">{workOrder.customer_vat_number}</p>
                  </div>
                )}
                
                {workOrder.customer_owner_name && (
                  <div>
                    <Label className="text-sm font-medium">Assigned To</Label>
                    <p className="text-sm">{workOrder.customer_owner_name}</p>
                  </div>
                )}
                
                {workOrder.customer_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/customers/${workOrder.customer_id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Full Customer Details
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Machine Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5" />
                  Machine Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Model Name</Label>
                  <p className="text-sm font-medium">{workOrder.machine_name || 'N/A'}</p>
                </div>
                
                {workOrder.serial_number && (
                  <div>
                    <Label className="text-sm font-medium">Serial Number</Label>
                    <p className="text-sm font-mono">{workOrder.serial_number}</p>
                  </div>
                )}
                
                {workOrder.technician_name && (
                  <div>
                    <Label className="text-sm font-medium">Assigned Technician</Label>
                    <p className="text-sm">{workOrder.technician_name}</p>
                  </div>
                )}
                
                {workOrder.machine_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/machines/${workOrder.machine_id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Full Machine Details
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Status & Priority */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Status & Priority
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    {isEditing ? (
                      <Select value={form.status} onValueChange={(value) => handleStatusChange(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="intake">Intake</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="testing">Testing</SelectItem>
                          <SelectItem value="parts_ordered">Parts Ordered</SelectItem>
                          <SelectItem value="waiting_approval">Waiting Approval</SelectItem>
                          <SelectItem value="waiting_supplier">Waiting Supplier</SelectItem>
                          <SelectItem value="service_cancelled">Service Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getStatusBadge(workOrder.status)
                    )}
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Priority</Label>
                  <div className="mt-1">
                    {isEditing ? (
                      <Select value={form.priority} onValueChange={(value) => setForm(f => ({ ...f, priority: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getPriorityBadge(workOrder.priority)
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Time Tracking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Time Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const startedAt = isEditing ? form.started_at : workOrder.started_at
                  return startedAt && startedAt.trim() !== '' && (
                    <div>
                      <Label className="text-sm font-medium">Started At</Label>
                      <p className="text-sm">
                        {formatDateTime(startedAt)}
                      </p>
                    </div>
                  )
                })()}
                
                {(() => {
                  const completedAt = isEditing ? form.completed_at : workOrder.completed_at
                  return completedAt && completedAt.trim() !== '' && (
                    <div>
                      <Label className="text-sm font-medium">Completed At</Label>
                      <p className="text-sm">
                        {formatDateTime(completedAt)}
                      </p>
                    </div>
                  )
                })()}
                
                {(() => {
                  const startedAt = isEditing ? form.started_at : workOrder.started_at
                  const completedAt = isEditing ? form.completed_at : workOrder.completed_at
                  return startedAt && startedAt.trim() !== '' && completedAt && completedAt.trim() !== '' && (
                    <div>
                      <Label className="text-sm font-medium">Total Duration</Label>
                      <p className="text-sm">
                        {calculateDuration(startedAt, completedAt)}
                      </p>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Work Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Work Order Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="description">Description</Label>
                  {isEditing ? (
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                      rows={4}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-sm mt-1">{workOrder.description || 'No description provided'}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="technician">Technician</Label>
                  {isEditing ? (
                    <Select value={form.technician_id} onValueChange={(value) => setForm(f => ({ ...f, technician_id: value }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select technician" />
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
                  ) : (
                    <p className="text-sm mt-1">
                      {workOrder.owner_technician_name || workOrder.technician_name || 'No technician assigned'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cost Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Cost Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="labor_hours">Labor Hours</Label>
                    {isEditing ? (
                      <Input
                        id="labor_hours"
                        type="number"
                        step="0.1"
                        value={form.labor_hours}
                        onChange={(e) => setForm(f => ({ ...f, labor_hours: e.target.value }))}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm mt-1">{workOrder.labor_hours || '0'} hours</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="labor_rate">Labor Rate (KM/hour)</Label>
                    {isEditing ? (
                      <Input
                        id="labor_rate"
                        type="number"
                        step="0.01"
                        value={form.labor_rate}
                        onChange={(e) => setForm(f => ({ ...f, labor_rate: e.target.value }))}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm mt-1">{workOrder.labor_rate || '0'} KM/hour</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="troubleshooting_fee">Troubleshooting Fee (KM)</Label>
                    {isEditing ? (
                      <Input
                        id="troubleshooting_fee"
                        type="number"
                        step="0.01"
                        value={form.troubleshooting_fee}
                        onChange={(e) => setForm(f => ({ ...f, troubleshooting_fee: e.target.value }))}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm mt-1">{workOrder.troubleshooting_fee || '0'} KM</p>
                    )}
                  </div>

                  <div>
                    <Label>Parts Cost (KM)</Label>
                    <p className="text-sm mt-1">{(Number((inventory || []).reduce((sum: number, item) => sum + (Number(item.total_price) || 0), 0))).toFixed(2)} KM</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Total Cost</Label>
                    <span className="text-lg font-bold">{(calculateTotalCost() || 0).toFixed(2)} KM</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Technician Notes
                  </CardTitle>
                  {isEditing && (
                    <Button
                      size="sm"
                      onClick={() => setNoteDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Note
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No notes yet</p>
                ) : (
                  <div className="space-y-3">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(note.created_at)}
                          {note.user_name && ` • ${note.user_name}`}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Parts Used */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Parts Used
                  </CardTitle>
                  {isEditing && (
                    <Button
                      size="sm"
                      onClick={() => setInventoryDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Part
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {inventory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No parts used yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {isEditing && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventory.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.inventory_name}</TableCell>
                          <TableCell className="text-right">
                            {editingInventoryItem?.id === item.id ? (
                              <Input
                                type="number"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(e.target.value)}
                                className="w-20 text-right"
                                min="1"
                              />
                            ) : (
                              item.quantity
                            )}
                          </TableCell>
                          <TableCell className="text-right">{Number(item.unit_price || 0).toFixed(2)} KM</TableCell>
                          <TableCell className="text-right">{Number(item.total_price || 0).toFixed(2)} KM</TableCell>
                          {isEditing && (
                            <TableCell className="text-right">
                              {editingInventoryItem?.id === item.id ? (
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleUpdateInventory}
                                    disabled={!editQuantity || parseInt(editQuantity) <= 0}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingInventoryItem(null)
                                      setEditQuantity('')
                                    }}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditInventory(item)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteInventory(item)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Add Note Dialog */}
        <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Note</DialogTitle>
              <DialogDescription>
                Add a note to this work order for other technicians to see.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="note-content">Note Content</Label>
                <Textarea
                  id="note-content"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={4}
                  className="mt-1"
                  placeholder="Enter your note here..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNote} disabled={!newNote.trim()}>
                Add Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Inventory Dialog */}
        <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Part</DialogTitle>
              <DialogDescription>
                Add a part to this work order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="inventory-item">Part</Label>
                <Select 
                  value={newInventory.inventory_id} 
                  onValueChange={(value) => setNewInventory(prev => ({ ...prev, inventory_id: value }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a part" />
                  </SelectTrigger>
                  <SelectContent>
                    {allInventory.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} - {item.price} KM
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newInventory.quantity}
                  onChange={(e) => setNewInventory(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInventoryDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddInventory} disabled={!newInventory.inventory_id || !newInventory.quantity}>
                Add Part
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDelete}
          title="Delete Work Order"
          itemName={workOrder?.formatted_number || `#${workOrder?.id}`}
          itemType="work order"
        />

        {/* Completed Work Order Alert Dialog */}
        <CompletedItemAlertDialog
          open={completedAlertOpen}
          onOpenChange={setCompletedAlertOpen}
          itemName={workOrder?.formatted_number || `#${workOrder?.id}`}
          itemType="work order"
          title="Cannot Delete Completed Work Order"
        />
      </div>
    </MainLayout>
  )
}