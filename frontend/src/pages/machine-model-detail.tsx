import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  ArrowLeft,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Wrench,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  Package,
  Shield,
  CheckCircle,
  XCircle,
  Building,
  Receipt,
  Euro
} from 'lucide-react'
import { apiService } from '@/services/api'
import { AssignMachineModal } from '@/components/assign-machine-modal'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/dateTime'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface MachineModel {
  id: string
  name: string
  catalogue_number?: string
  manufacturer: string
  description?: string
  warranty_months: number
  category_name?: string
  total_serials: number
  total_assigned: number
  unassigned_serials: number
  active_warranty: number
  expired_warranty: number
  created_at: string
  updated_at: string
}

interface AssignedMachine {
  id: string // This is machine_serials.id
  assigned_machine_id: string // This is assigned_machines.id
  serial_id: string
  customer_id: string
  purchase_date?: string
  warranty_expiry_date?: string
  warranty_active: boolean
  description?: string
  assigned_at: string
  updated_at: string
  receipt_number?: string
  sold_by_user_id?: string
  added_by_user_id?: string
  machine_condition?: string
  sale_date?: string
  sale_price?: number
  is_sale: boolean
  serial_number: string
  model_name: string
  catalogue_number?: string
  manufacturer: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
}

export default function MachineModelDetail() {
  const { modelId } = useParams<{ modelId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [model, setModel] = useState<MachineModel | null>(null)
  const [assignedMachines, setAssignedMachines] = useState<AssignedMachine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  
  // Edit model state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingModel, setEditingModel] = useState<MachineModel | null>(null)
  
  // Delete confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [machineToDelete, setMachineToDelete] = useState<AssignedMachine | null>(null)

  useEffect(() => {
    if (modelId) {
      fetchModelDetails()
    }
  }, [modelId])

  const fetchModelDetails = async () => {
    try {
      setIsLoading(true)
      // Fetch model details with assigned machines
      const response = await apiService.getMachineModel(modelId!)
      const responseData = response.data || response
      
      // Extract model and serials from the response
      const { model: modelData, serials } = responseData
      
      if (modelData) {
        setModel(modelData)
      }
      
      if (serials) {
        setAssignedMachines(serials)
      }
    } catch (err) {
      setError('Failed to load machine model details')
      console.error('Error fetching machine model details:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getWarrantyStatus = (warrantyActive: boolean, warrantyExpiry?: string) => {
    if (!warrantyExpiry) {
      return <Badge variant="outline">No Warranty</Badge>
    }
    
    if (warrantyActive) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
    } else {
      return <Badge variant="destructive">Expired</Badge>
    }
  }

  const getConditionBadge = (condition?: string) => {
    switch (condition) {
      case 'new':
        return <Badge variant="default" className="bg-green-100 text-green-800">New</Badge>
      case 'used':
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Used</Badge>
      default:
        return <Badge variant="outline">{condition || 'Unknown'}</Badge>
    }
  }

  const filteredMachines = assignedMachines.filter(machine =>
    machine.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    machine.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (machine.receipt_number && machine.receipt_number.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totalRevenue = assignedMachines
    .filter(m => m.is_sale && m.sale_price)
    .reduce((sum, m) => sum + (parseFloat(m.sale_price?.toString() || '0') || 0), 0)

  const salesWithPrice = assignedMachines.filter(m => m.is_sale && m.sale_price)
  const avgSalePrice = salesWithPrice.length > 0 
    ? salesWithPrice.reduce((sum, m) => sum + (parseFloat(m.sale_price?.toString() || '0') || 0), 0) / salesWithPrice.length
    : 0

  const handleAssignSuccess = () => {
    // Refresh the data after successful assignment
    fetchModelDetails()
  }

  const handleSaveEdit = async () => {
    if (!editingModel) return
    
    try {
      // Update the machine model via API
      await apiService.updateMachineModel(editingModel.id, {
        name: editingModel.name,
        manufacturer: editingModel.manufacturer,
        catalogue_number: editingModel.catalogue_number,
        warranty_months: editingModel.warranty_months,
        description: editingModel.description
      })
      
      toast.success('Machine model updated successfully')
      
      // Refresh the data
      await fetchModelDetails()
      setShowEditDialog(false)
      setEditingModel(null)
    } catch (err: any) {
      console.error('Error updating machine model:', err)
      toast.error(err.message || 'Failed to update machine model')
    }
  }

  const handleDeleteClick = (machine: AssignedMachine) => {
    setMachineToDelete(machine)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!machineToDelete) return

    try {
      setIsDeleting(true)
      
      await apiService.deleteMachine(machineToDelete.assigned_machine_id)
      
      toast.success("Machine permanently deleted successfully.")
      
      setIsDeleteDialogOpen(false)
      setMachineToDelete(null)
      fetchModelDetails() // Refresh the data
    } catch (err: any) {
      console.error('Error deleting machine:', err)
      const errorMessage = err.response?.data?.message || "Failed to delete machine. Please try again."
      toast.error(errorMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading machine model details...</span>
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
            <Button onClick={fetchModelDetails}>Try Again</Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (!model) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-red-600 mb-4">Machine model not found</p>
            <Button onClick={() => navigate('/machines')}>Back to Machines</Button>
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
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              onClick={() => navigate('/machines')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
              <p className="text-muted-foreground">
                {model.manufacturer} • {model.catalogue_number || 'No catalogue number'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => {
              setEditingModel(model)
              setShowEditDialog(true)
            }}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Model
            </Button>
            {hasPermission('machines:assign') && (
              <Button onClick={() => setIsAssignModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Assign Machine
              </Button>
            )}
          </div>
        </div>

        {/* Model Information */}
        <Card>
          <CardHeader>
            <CardTitle>Model Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Manufacturer</span>
                </div>
                <p className="text-lg font-semibold">{model.manufacturer}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Warranty Period</span>
                </div>
                <p className="text-lg font-semibold">{model.warranty_months} months</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Category</span>
                </div>
                <p className="text-lg font-semibold">{model.category_name || 'Uncategorized'}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Total Assigned</span>
                </div>
                <p className="text-lg font-semibold">{model.total_assigned}</p>
              </div>
            </div>
            {model.description && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center space-x-2 mb-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Description</span>
                </div>
                <p className="text-muted-foreground">{model.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Total Sales</span>
                </div>
                <p className="text-2xl font-bold">
                  {assignedMachines.filter(m => m.is_sale).length}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">Total Assignments</span>
                </div>
                <p className="text-2xl font-bold">{assignedMachines.length}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Euro className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Total Revenue</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">Avg Sale Price</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(avgSalePrice)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assigned Machines Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Assigned Machines</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search machines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-80"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Warranty Status</TableHead>
                  <TableHead>Sale Price</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMachines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2">
                        <Package className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No assigned machines found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMachines.map((machine, index) => (
                    <TableRow key={`machine-${machine.id}-${index}`} onClick={() => navigate(`/machines/${machine.assigned_machine_id}`)} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Button 
                          variant="link" 
                          className="p-0 h-auto font-medium"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/machines/${machine.assigned_machine_id}`)
                          }}
                        >
                          {machine.serial_number}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{machine.customer_name}</div>
                          {machine.customer_email && (
                            <div className="text-sm text-muted-foreground">
                              {machine.customer_email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={machine.is_sale ? "default" : "outline"}
                          className={machine.is_sale ? "bg-green-100 text-green-800" : ""}
                        >
                          {machine.is_sale ? 'Sale' : 'Assignment'}
                        </Badge>
                      </TableCell>
                      <TableCell>{getConditionBadge(machine.machine_condition)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(machine.purchase_date)}
                      </TableCell>
                      <TableCell>
                        {getWarrantyStatus(machine.warranty_active, machine.warranty_expiry_date)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {machine.sale_price ? formatCurrency(machine.sale_price) : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {machine.receipt_number || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/machines/${machine.assigned_machine_id}`)
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/machines/${machine.assigned_machine_id}`)
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Machine
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Wrench className="mr-2 h-4 w-4" />
                              Create Service Ticket
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClick(machine)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Machine
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Assign Machine Modal */}
        {hasPermission('machines:assign') && (
          <AssignMachineModal
            isOpen={isAssignModalOpen}
            onClose={() => setIsAssignModalOpen(false)}
            onSuccess={handleAssignSuccess}
            modelId={modelId!}
            modelName={model.name}
            warrantyMonths={model.warranty_months}
          />
        )}

        {/* Edit Machine Model Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Machine Model</DialogTitle>
              <DialogDescription>
                Update the machine model information below.
              </DialogDescription>
            </DialogHeader>
            {editingModel && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Model Name *</Label>
                    <Input
                      id="edit-name"
                      value={editingModel.name}
                      onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                      placeholder="Enter model name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-manufacturer">Manufacturer *</Label>
                    <Input
                      id="edit-manufacturer"
                      value={editingModel.manufacturer}
                      onChange={(e) => setEditingModel({ ...editingModel, manufacturer: e.target.value })}
                      placeholder="Enter manufacturer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-catalogue">Catalogue Number</Label>
                    <Input
                      id="edit-catalogue"
                      value={editingModel.catalogue_number || ''}
                      onChange={(e) => setEditingModel({ ...editingModel, catalogue_number: e.target.value })}
                      placeholder="Enter catalogue number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-warranty">Warranty (months)</Label>
                    <Input
                      id="edit-warranty"
                      type="number"
                      min="0"
                      max="120"
                      value={editingModel.warranty_months}
                      onChange={(e) => setEditingModel({ ...editingModel, warranty_months: parseInt(e.target.value) || 0 })}
                      placeholder="12"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editingModel.description || ''}
                    onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                    placeholder="Enter machine model description..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editingModel?.name || !editingModel?.manufacturer}>
                Save Changes
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
                    <p><strong>Machine:</strong> {machineToDelete?.model_name}</p>
                    <p><strong>Serial:</strong> {machineToDelete?.serial_number}</p>
                    <p><strong>Customer:</strong> {machineToDelete?.customer_name}</p>
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
      </div>
    </MainLayout>
  )
}
