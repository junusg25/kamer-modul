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
import { API_ROOT } from '../config/api'
import { useAuth } from '../contexts/auth-context'
import { formatCurrency } from '../lib/currency'
import { formatDate, formatDateTime } from '../lib/dateTime'
import { toast } from 'sonner'
import { formatStatus, getStatusBadgeVariant, getStatusBadgeColor } from '@/lib/status'

interface WarrantyWorkOrder {
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

export default function WarrantyWorkOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [warrantyWorkOrder, setWarrantyWorkOrder] = useState<WarrantyWorkOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    status: '',
    priority: '',
    technician_id: '',
    description: '',
    started_at: '',
    completed_at: '',
    labor_hours: '',
    labor_rate: '',
    troubleshooting_fee: ''
  })

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [completedAlertOpen, setCompletedAlertOpen] = useState(false)

  // Notes state
  const [notes, setNotes] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [noteDialogOpen, setNoteDialogOpen] = useState(false)

  // Inventory state
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false)
  const [newInventory, setNewInventory] = useState({
    inventory_id: '',
    quantity: 1
  })
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [isLoadingInventoryItems, setIsLoadingInventoryItems] = useState(false)
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null)
  const [editQuantity, setEditQuantity] = useState('')

  // Technicians state
  const [technicians, setTechnicians] = useState<any[]>([])
  const [isLoadingTechnicians, setIsLoadingTechnicians] = useState(false)

  useEffect(() => {
    if (id) {
      fetchWarrantyWorkOrderDetails()
      fetchNotes()
      fetchInventory()
      fetchInventoryItems()
      fetchTechnicians()
    }
  }, [id])

  const fetchWarrantyWorkOrderDetails = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch warranty work order details
      const response = await apiService.getWarrantyWorkOrder(id!) as any
      setWarrantyWorkOrder(response.data)
      
      // Initialize form with current data
      if (response.data) {
        setForm({
          status: response.data.status || '',
          priority: response.data.priority || '',
          technician_id: (response.data.owner_technician_id || response.data.technician_id)?.toString() || 'unassigned',
          description: response.data.description || '',
          started_at: response.data.started_at || '',
          completed_at: response.data.completed_at || '',
          labor_hours: response.data.labor_hours?.toString() || '',
          labor_rate: response.data.labor_rate?.toString() || '',
          troubleshooting_fee: response.data.troubleshooting_fee?.toString() || ''
        })
      }
    } catch (err) {
      setError('Failed to load warranty work order details.')
      console.error('Error fetching warranty work order details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchNotes = async () => {
    try {
      const response = await apiService.getWarrantyWorkOrderNotes(id!)
      setNotes(response.data || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
    }
  }

  const fetchInventory = async () => {
    try {
      setIsLoadingInventory(true)
      const response = await apiService.getWarrantyWorkOrderInventory(id!)
      setInventory(response.data || [])
    } catch (err) {
      console.error('Error fetching inventory:', err)
    } finally {
      setIsLoadingInventory(false)
    }
  }

  const fetchInventoryItems = async () => {
    try {
      setIsLoadingInventoryItems(true)
      const response = await apiService.getInventory({ limit: 1000 })
      setInventoryItems(response.data || [])
    } catch (err) {
      console.error('Error fetching inventory items:', err)
    } finally {
      setIsLoadingInventoryItems(false)
    }
  }

  const handleDeleteInventory = async (item: InventoryItem) => {
    try {
      await apiService.deleteWarrantyWorkOrderInventory(id!, item.id)
      
      toast.success('Part deleted successfully')
      await fetchInventory()
      await fetchWarrantyWorkOrderDetails()
      
      // Update total cost in database after deleting inventory
      if (warrantyWorkOrder) {
        const calculatedTotalCost = calculateTotalCost()
        await apiService.updateWarrantyWorkOrder(warrantyWorkOrder.id, { total_cost: calculatedTotalCost })
      }
    } catch (err: any) {
      console.error('Error deleting inventory:', err)
      toast.error(err.response?.data?.message || 'Failed to delete part')
    }
  }

  const handleAddInventory = async () => {
    if (!newInventory.inventory_id || !newInventory.quantity) return

    try {
      await apiService.createWarrantyWorkOrderInventory(id!, {
        inventory_id: parseInt(newInventory.inventory_id),
        quantity: parseInt(newInventory.quantity.toString())
      })
      
      toast.success('Part added successfully')
      setNewInventory({ inventory_id: '', quantity: 1 })
      setInventoryDialogOpen(false)
      await fetchInventory()
      await fetchWarrantyWorkOrderDetails()
      
      // Update total cost in database after adding inventory
      if (warrantyWorkOrder) {
        const calculatedTotalCost = calculateTotalCost()
        await apiService.updateWarrantyWorkOrder(warrantyWorkOrder.id, { total_cost: calculatedTotalCost })
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
      // For warranty work orders, we need to delete the old item and add a new one
      // since there's no update endpoint
      await apiService.deleteWarrantyWorkOrderInventory(id!, editingInventoryItem.id)
      
      await apiService.createWarrantyWorkOrderInventory(id!, {
        inventory_id: parseInt(editingInventoryItem.inventory_id),
        quantity: parseInt(editQuantity)
      })
      
      toast.success('Part updated successfully')
      setEditingInventoryItem(null)
      setEditQuantity('')
      await fetchInventory()
      await fetchWarrantyWorkOrderDetails()
      
      // Update total cost in database after updating inventory
      if (warrantyWorkOrder) {
        const calculatedTotalCost = calculateTotalCost()
        await apiService.updateWarrantyWorkOrder(warrantyWorkOrder.id, { total_cost: calculatedTotalCost })
      }
    } catch (err: any) {
      console.error('Error updating inventory:', err)
      toast.error(err.response?.data?.message || 'Failed to update part')
    }
  }

  const fetchTechnicians = async () => {
    try {
      setIsLoadingTechnicians(true)
      const response = await apiService.getUsers({ limit: 100 })
      setTechnicians(response.data || [])
    } catch (err) {
      console.error('Error fetching technicians:', err)
    } finally {
      setIsLoadingTechnicians(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Reset form to original values
    if (warrantyWorkOrder) {
      setForm({
        status: warrantyWorkOrder.status || '',
        priority: warrantyWorkOrder.priority || '',
        technician_id: (warrantyWorkOrder.owner_technician_id || warrantyWorkOrder.technician_id)?.toString() || 'unassigned',
        description: warrantyWorkOrder.description || '',
        started_at: warrantyWorkOrder.started_at || '',
        completed_at: warrantyWorkOrder.completed_at || '',
        labor_hours: warrantyWorkOrder.labor_hours?.toString() || '',
        labor_rate: warrantyWorkOrder.labor_rate?.toString() || '',
        troubleshooting_fee: warrantyWorkOrder.troubleshooting_fee?.toString() || ''
      })
    }
  }

  const handleSave = async () => {
    if (!warrantyWorkOrder) return

    try {
      setIsSaving(true)
      const updates: any = {}
      
      // Check for changes and add to updates
      if (form.status !== warrantyWorkOrder.status) {
        updates.status = form.status
      }
      if (form.priority !== warrantyWorkOrder.priority) {
        updates.priority = form.priority
      }
      if (form.technician_id !== ((warrantyWorkOrder.owner_technician_id || warrantyWorkOrder.technician_id)?.toString() || 'unassigned')) {
        updates.technician_id = form.technician_id && form.technician_id !== 'unassigned' ? parseInt(form.technician_id) : null
      }
      if (form.description !== warrantyWorkOrder.description) {
        updates.description = form.description
      }
      if (form.labor_hours !== (warrantyWorkOrder.labor_hours?.toString() || '')) {
        updates.labor_hours = form.labor_hours ? parseFloat(form.labor_hours) : null
      }
      if (form.labor_rate !== (warrantyWorkOrder.labor_rate?.toString() || '')) {
        updates.labor_rate = form.labor_rate ? parseFloat(form.labor_rate) : null
      }
      if (form.troubleshooting_fee !== (warrantyWorkOrder.troubleshooting_fee?.toString() || '')) {
        updates.troubleshooting_fee = form.troubleshooting_fee ? parseFloat(form.troubleshooting_fee) : null
      }

      // Always calculate and update total_cost
      const calculatedTotalCost = calculateTotalCost()
      updates.total_cost = calculatedTotalCost

      // Note: started_at and completed_at are handled automatically by the backend
      // based on status changes, so we don't send them explicitly

      // Always make API call to update total_cost, even if no other fields changed
      await apiService.updateWarrantyWorkOrder(warrantyWorkOrder.id, updates)
      toast.success('Warranty work order updated successfully')
      
      // Refresh data
      await fetchWarrantyWorkOrderDetails()
      
      setIsEditing(false)
    } catch (err: any) {
      console.error('Error updating warranty work order:', err)
      toast.error(err.response?.data?.message || 'Failed to update warranty work order')
    } finally {
      setIsSaving(false)
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

  const handleDelete = () => {
    if (warrantyWorkOrder?.status === 'completed') {
      setCompletedAlertOpen(true)
    } else {
      setDeleteDialogOpen(true)
    }
  }

  const confirmDelete = async () => {
    if (!warrantyWorkOrder) return

    try {
      await apiService.deleteWarrantyWorkOrder(warrantyWorkOrder.id)
      toast.success('Warranty work order deleted successfully')
      navigate('/warranty-work-orders')
    } catch (err: any) {
      console.error('Error deleting warranty work order:', err)
      toast.error(err.response?.data?.message || 'Failed to delete warranty work order')
    }
  }

  const handlePrint = async () => {
    if (!warrantyWorkOrder) return

    try {
            
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_ROOT}/api/print/warranty-work-order/${warrantyWorkOrder.id}`, {
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
    if (!warrantyWorkOrder) return

    try {
            
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_ROOT}/api/print/warranty-work-order/${warrantyWorkOrder.id}`, {
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
      link.download = `warranty-work-order-${warrantyWorkOrder.formatted_number || warrantyWorkOrder.id}-${new Date().toISOString().split('T')[0]}.pdf`
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

  const handleAddNote = async () => {
    if (!newNote.trim()) return

    try {
      setIsAddingNote(true)
      await apiService.createWarrantyWorkOrderNote(warrantyWorkOrder!.id, {
        note: newNote
      })
      
      setNewNote('')
      setNoteDialogOpen(false)
      await fetchNotes()
      toast.success('Note added successfully')
    } catch (err) {
      console.error('Error adding note:', err)
      toast.error('Failed to add note')
    } finally {
      setIsAddingNote(false)
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

  const getStatusBadge = (status: string) => {
    const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = {
      intake: Clock,
      quoted: FileText,
      pending: Clock,
      in_progress: Activity,
      completed: CheckCircle,
      cancelled: XCircle,
      testing: Settings,
      parts_ordered: Package,
      waiting_approval: UserCheck,
      waiting_supplier: Truck,
      service_cancelled: XCircle,
      warranty_declined: XCircle
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
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">High</Badge>
      case 'medium':
        return <Badge variant="default">Medium</Badge>
      case 'low':
        return <Badge variant="secondary">Low</Badge>
      default:
        return <Badge variant="outline">Normal</Badge>
    }
  }

  const canEdit = user?.role !== 'sales' // Sales users cannot edit

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading warranty work order details...</span>
        </div>
      </MainLayout>
    )
  }

  if (error || !warrantyWorkOrder) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error || 'Warranty work order not found'}</AlertDescription>
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
                  Warranty Work Order {warrantyWorkOrder.formatted_number || `#${warrantyWorkOrder.id}`}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Created {formatDate(warrantyWorkOrder.created_at)}
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
                    onClick={handleDelete}
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
                  <p className="text-sm font-medium">{warrantyWorkOrder.customer_name || 'N/A'}</p>
                </div>
                
                {warrantyWorkOrder.customer_phone && (
                  <div>
                    <Label className="text-sm font-medium">Phone</Label>
                    <p className="text-sm">{warrantyWorkOrder.customer_phone}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.customer_email && (
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm">{warrantyWorkOrder.customer_email}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.customer_company && (
                  <div>
                    <Label className="text-sm font-medium">Company</Label>
                    <p className="text-sm">{warrantyWorkOrder.customer_company}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.customer_address && (
                  <div>
                    <Label className="text-sm font-medium">Address</Label>
                    <p className="text-sm">{warrantyWorkOrder.customer_address}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.customer_city && (
                  <div>
                    <Label className="text-sm font-medium">City</Label>
                    <p className="text-sm">{warrantyWorkOrder.customer_city}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.customer_vat_number && (
                  <div>
                    <Label className="text-sm font-medium">VAT Number</Label>
                    <p className="text-sm">{warrantyWorkOrder.customer_vat_number}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.customer_owner_name && (
                  <div>
                    <Label className="text-sm font-medium">Assigned To</Label>
                    <p className="text-sm">{warrantyWorkOrder.customer_owner_name}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.customer_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/customers/${warrantyWorkOrder.customer_id}`)}
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
                  <p className="text-sm font-medium">{warrantyWorkOrder.machine_name || 'N/A'}</p>
                </div>
                
                {warrantyWorkOrder.serial_number && (
                  <div>
                    <Label className="text-sm font-medium">Serial Number</Label>
                    <p className="text-sm font-mono">{warrantyWorkOrder.serial_number}</p>
                  </div>
                )}
                
                {(warrantyWorkOrder.owner_technician_name || warrantyWorkOrder.technician_name) && (
                  <div>
                    <Label className="text-sm font-medium">Assigned Technician</Label>
                    <p className="text-sm">{warrantyWorkOrder.owner_technician_name || warrantyWorkOrder.technician_name}</p>
                  </div>
                )}
                
                {warrantyWorkOrder.machine_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/machines/${warrantyWorkOrder.machine_id}`)}
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
                          <SelectItem value="warranty_declined">Warranty Declined</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      getStatusBadge(warrantyWorkOrder.status)
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
                      getPriorityBadge(warrantyWorkOrder.priority)
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
                  const startedAt = isEditing ? form.started_at : warrantyWorkOrder.started_at
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
                  const completedAt = isEditing ? form.completed_at : warrantyWorkOrder.completed_at
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
                  const startedAt = isEditing ? form.started_at : warrantyWorkOrder.started_at
                  const completedAt = isEditing ? form.completed_at : warrantyWorkOrder.completed_at
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
                  Warranty Work Order Details
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
                    <p className="text-sm mt-1">{warrantyWorkOrder.description || 'No description provided'}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="technician">Technician</Label>
                  {isEditing ? (
                    <Select value={form.technician_id || "unassigned"} onValueChange={(value) => setForm(f => ({ ...f, technician_id: value === "unassigned" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id.toString()}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm mt-1">{warrantyWorkOrder.owner_technician_name || warrantyWorkOrder.technician_name || 'Unassigned'}</p>
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
                      <p className="text-sm mt-1">{warrantyWorkOrder.labor_hours || '0'} hours</p>
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
                      <p className="text-sm mt-1">{warrantyWorkOrder.labor_rate || '0'} KM/hour</p>
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
                      <p className="text-sm mt-1">{warrantyWorkOrder.troubleshooting_fee || '0'} KM</p>
                    )}
                  </div>

                  <div>
                    <Label>Parts Cost (KM)</Label>
                    <p className="text-sm mt-1">{formatCurrency((Number((inventory || []).reduce((sum: number, item) => sum + (Number(item.total_price) || 0), 0))))}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-between items-center">
                    <Label className="text-lg font-semibold">Total Cost (Reference Only)</Label>
                    <span className="text-lg font-bold">{formatCurrency(calculateTotalCost() || 0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    * Warranty work orders are free for customers. Costs shown are for internal reference only.
                  </p>
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
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inventory */}
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
                {isLoadingInventory ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span className="text-sm">Loading inventory...</span>
                  </div>
                ) : inventory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No parts used</p>
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
                          <TableCell className="text-right">{formatCurrency(item.unit_price || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.total_price || 0)}</TableCell>
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
                Add a note to this warranty work order.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter your note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddNote} disabled={isAddingNote || !newNote.trim()}>
                {isAddingNote ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Note
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Warranty Work Order"
          description="Are you sure you want to delete this warranty work order? This action cannot be undone."
        />

        {/* Completed Item Alert Dialog */}
        <CompletedItemAlertDialog
          open={completedAlertOpen}
          onOpenChange={setCompletedAlertOpen}
          title="Cannot Delete Completed Work Order"
          description="Completed warranty work orders cannot be deleted. Please contact an administrator if you need to make changes."
        />

        {/* Add Inventory Dialog */}
        <Dialog open={inventoryDialogOpen} onOpenChange={setInventoryDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Part</DialogTitle>
              <DialogDescription>
                Add a part to this warranty work order.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="inventory-select">Select Part</Label>
                <Select
                  value={newInventory.inventory_id}
                  onValueChange={(value) => setNewInventory(prev => ({ ...prev, inventory_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a part" />
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems.map((item) => (
                      <SelectItem key={item.id} value={item.id.toString()}>
                        {item.name} - {formatCurrency(item.unit_price || 0)} (Stock: {item.quantity})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={newInventory.quantity}
                  onChange={(e) => setNewInventory(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setInventoryDialogOpen(false)
                setNewInventory({ inventory_id: '', quantity: 1 })
              }}>
                Cancel
              </Button>
              <Button onClick={handleAddInventory} disabled={!newInventory.inventory_id || !newInventory.quantity}>
                Add Part
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}