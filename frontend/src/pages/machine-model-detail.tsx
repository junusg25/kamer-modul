import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SmartSearch } from '@/components/ui/smart-search'
import { Pagination } from '@/components/ui/pagination'
import { matchesAccentInsensitive } from '@/utils/searchUtils'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  ArrowLeft,
  Plus,
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
  Euro,
  Check,
  ChevronDown
} from 'lucide-react'
import { apiService } from '@/services/api'
import { AssignMachineModal } from '@/components/assign-machine-modal'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { formatDate } from '@/lib/dateTime'
import { cn } from '@/lib/utils'
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
  category_id?: number
  category_name?: string
  total_serials: number
  total_assigned: number
  unassigned_serials: number
  active_warranty: number
  expired_warranty: number
  created_at: string
  updated_at: string
}

interface MachineCategory {
  id: number
  name: string
  description?: string
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
  const { t } = useTranslation()
  const { modelId } = useParams<{ modelId: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [model, setModel] = useState<MachineModel | null>(null)
  const [assignedMachines, setAssignedMachines] = useState<AssignedMachine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(25)
  const [error, setError] = useState('')
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  
  // Edit model state
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingModel, setEditingModel] = useState<MachineModel | null>(null)
  const [machineCategories, setMachineCategories] = useState<MachineCategory[]>([])
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [manufacturerPopoverOpen, setManufacturerPopoverOpen] = useState(false)
  const [manufacturerSearch, setManufacturerSearch] = useState('')
  const [manufacturerOptions, setManufacturerOptions] = useState<string[]>([])
  
  // Delete machine confirmation state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [machineToDelete, setMachineToDelete] = useState<AssignedMachine | null>(null)
  
  // Delete model confirmation state
  const [showDeleteModelDialog, setShowDeleteModelDialog] = useState(false)
  const [isDeletingModel, setIsDeletingModel] = useState(false)

  useEffect(() => {
    if (modelId) {
      fetchModelDetails()
    }
  }, [modelId])

  useEffect(() => {
    fetchCategories()
    fetchManufacturers()
  }, [])

  const fetchCategories = async () => {
    try {
      const response = await apiService.getMachineCategories()
      setMachineCategories((response as any).data || [])
    } catch (err) {
      console.error('Error fetching categories:', err)
    }
  }

  const fetchManufacturers = async () => {
    try {
      const response = await apiService.getSuppliers({ limit: 100 })
      const suppliersData = (response as any).data || []
      // Extract unique manufacturer names from suppliers
      const supplierNames = suppliersData.map((s: any) => s.name)
      setManufacturerOptions(supplierNames)
    } catch (err) {
      console.error('Error fetching manufacturers:', err)
      setManufacturerOptions([])
    }
  }

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

  const getWarrantyStatus = (warrantyActive: boolean, warrantyExpiry?: string, machineType?: string) => {
    if (!warrantyExpiry) {
      return <Badge variant="outline">No Warranty</Badge>
    }

    const expiryDate = new Date(warrantyExpiry)
    const today = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    // For repair machines, ignore warranty_active flag and only check the expiry date
    if (machineType === 'repair') {
      if (daysUntilExpiry < 0) {
        return <Badge variant="destructive">Expired</Badge>
      } else if (daysUntilExpiry <= 90) {
        return <Badge variant="outline" className="border-orange-300 text-orange-700">Expires Soon</Badge>
      } else {
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
      }
    }

    // For sold machines, check both warranty_active flag and expiry date
    if (!warrantyActive || daysUntilExpiry < 0) {
      return <Badge variant="destructive">Expired</Badge>
    } else if (daysUntilExpiry <= 90) {
      return <Badge variant="outline" className="border-orange-300 text-orange-700">Expires Soon</Badge>
    } else {
      return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>
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
    matchesAccentInsensitive(appliedSearchTerm, machine.serial_number || '') ||
    matchesAccentInsensitive(appliedSearchTerm, machine.customer_name || '') ||
    (machine.receipt_number && matchesAccentInsensitive(appliedSearchTerm, machine.receipt_number))
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredMachines.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = startIndex + pageSize
  const paginatedMachines = filteredMachines.slice(startIndex, endIndex)

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [appliedSearchTerm])

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
    if (!editingModel || !editingModel.id) {
      toast.error('Invalid model data')
      console.error('editingModel is missing or has no id:', editingModel)
      return
    }
    
    try {
      // Prepare update payload
      const updateData: any = {
        name: editingModel.name,
        manufacturer: editingModel.manufacturer,
        catalogue_number: editingModel.catalogue_number || null,
        warranty_months: editingModel.warranty_months,
        description: editingModel.description || null
      }
      
      // Only include category_id if it's a valid number
      if (editingModel.category_id && typeof editingModel.category_id === 'number') {
        updateData.category_id = editingModel.category_id
      }
      
      console.log('Updating model:', editingModel.id, updateData)
      
      // Update the machine model via API
      await apiService.updateMachineModel(editingModel.id, updateData)
      
      toast.success('Machine model updated successfully')
      
      // Refresh the data
      await fetchModelDetails()
      setShowEditDialog(false)
      setEditingModel(null)
      setCategorySearch('')
      setManufacturerSearch('')
      setAppliedSearchTerm('')
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

  const handleDeleteModelConfirm = async () => {
    if (!model) return

    try {
      setIsDeletingModel(true)
      await apiService.deleteMachineModel(model.id)
      toast.success('Machine model deleted successfully')
      navigate('/machines')
    } catch (err: any) {
      console.error('Error deleting machine model:', err)
      toast.error(err.message || 'Failed to delete machine model. It may have associated machines.')
    } finally {
      setIsDeletingModel(false)
    }
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">{t('pages.machine_model_detail.loading')}</span>
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
            <Button onClick={fetchModelDetails}>{t('pages.machine_model_detail.try_again')}</Button>
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
            <p className="text-red-600 mb-4">{t('pages.machine_model_detail.not_found')}</p>
            <Button onClick={() => navigate('/machines')}>{t('pages.machine_model_detail.back_to_machines')}</Button>
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
              <span>{t('pages.machine_model_detail.back')}</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{model.name}</h1>
              <p className="text-muted-foreground">
                {model.manufacturer} • {model.catalogue_number || t('pages.machine_model_detail.no_catalogue_number')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => {
              // Create a copy of the model to avoid mutating the original
              console.log('Opening edit dialog for model:', model)
              setEditingModel({ ...model })
              setShowEditDialog(true)
            }}>
              <Edit className="mr-2 h-4 w-4" />
              {t('pages.machine_model_detail.edit_model')}
            </Button>
            {hasPermission('machines:assign') && (
              <Button onClick={() => setIsAssignModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('pages.machine_model_detail.assign_machine')}
              </Button>
            )}
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteModelDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('pages.machine_model_detail.delete_model')}
            </Button>
          </div>
        </div>

        {/* Model Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.machine_model_detail.model_information')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.manufacturer')}</span>
                </div>
                <p className="text-lg font-semibold">{model.manufacturer}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.warranty_period')}</span>
                </div>
                <p className="text-lg font-semibold">{model.warranty_months} {t('pages.machine_model_detail.months')}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.category')}</span>
                </div>
                <p className="text-lg font-semibold">{model.category_name || t('pages.machine_model_detail.uncategorized')}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.total_assigned')}</span>
                </div>
                <p className="text-lg font-semibold">{model.total_assigned}</p>
              </div>
            </div>
            {model.description && (
              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center space-x-2 mb-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.description')}</span>
                </div>
                <p className="text-muted-foreground">{model.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.machine_model_detail.sales_metrics')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.total_sales')}</span>
                </div>
                <p className="text-2xl font-bold">
                  {assignedMachines.filter(m => m.is_sale).length}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Euro className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.total_revenue')}</span>
                </div>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Package className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">{t('pages.machine_model_detail.avg_sale_price')}</span>
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
              <CardTitle>{t('pages.machine_model_detail.assigned_machines')}</CardTitle>
              <div className="flex items-center space-x-2">
                <SmartSearch
                  placeholder={t('pages.machine_model_detail.search_placeholder')}
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
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pages.machine_model_detail.serial_number')}</TableHead>
                  <TableHead>{t('pages.machine_model_detail.customer')}</TableHead>
                  <TableHead>{t('pages.machine_model_detail.type')}</TableHead>
                  <TableHead>{t('pages.machine_model_detail.condition')}</TableHead>
                  <TableHead>{t('pages.machine_model_detail.purchase_date')}</TableHead>
                  <TableHead>{t('pages.machine_model_detail.warranty_status')}</TableHead>
                  <TableHead>{t('pages.machine_model_detail.sale_price')}</TableHead>
                  <TableHead>{t('pages.machine_model_detail.receipt')}</TableHead>
                  <TableHead className="text-right">{t('pages.machine_model_detail.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMachines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="flex flex-col items-center space-y-2">
                        <Package className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">{t('pages.machine_model_detail.no_assigned_machines')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMachines.map((machine, index) => (
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
                          {machine.is_sale ? t('pages.machine_model_detail.sale') : t('pages.machine_model_detail.assignment')}
                        </Badge>
                      </TableCell>
                      <TableCell>{getConditionBadge(machine.machine_condition)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(machine.purchase_date)}
                      </TableCell>
                      <TableCell>
                        {getWarrantyStatus(machine.warranty_active, machine.warranty_expiry_date, machine.machine_type)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {machine.sale_price ? formatCurrency(machine.sale_price) : t('pages.machine_model_detail.na')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {machine.receipt_number || t('pages.machine_model_detail.na')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>{t('pages.machine_model_detail.actions')}</DropdownMenuLabel>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/machines/${machine.assigned_machine_id}`)
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              {t('pages.machine_model_detail.view_details')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/machines/${machine.assigned_machine_id}`)
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              {t('pages.machine_model_detail.edit_machine')}
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Wrench className="mr-2 h-4 w-4" />
                              {t('pages.machine_model_detail.create_service_ticket')}
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
                              {t('pages.machine_model_detail.delete_machine')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4">
                <div className="text-sm text-muted-foreground">
                  {t('pages.machine_model_detail.showing_results', { 
                    start: startIndex + 1, 
                    end: Math.min(endIndex, filteredMachines.length), 
                    total: filteredMachines.length 
                  })}
                </div>
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
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
              <DialogTitle>{t('pages.machine_model_detail.edit_machine_model')}</DialogTitle>
              <DialogDescription>
                {t('pages.machine_model_detail.edit_description')}
              </DialogDescription>
            </DialogHeader>
            {editingModel && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">{t('pages.machine_model_detail.model_name')} *</Label>
                    <Input
                      id="edit-name"
                      value={editingModel.name}
                      onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                      placeholder={t('pages.machine_model_detail.enter_model_name')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-manufacturer">{t('pages.machine_model_detail.manufacturer')} *</Label>
                    <Popover open={manufacturerPopoverOpen} onOpenChange={setManufacturerPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={manufacturerPopoverOpen}
                          className="w-full justify-between h-11"
                        >
                          {editingModel.manufacturer || t('pages.machine_model_detail.select_manufacturer')}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="border-b p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('pages.machine_model_detail.search_manufacturer')}
                              className="pl-10"
                              value={manufacturerSearch}
                              onChange={(e) => setManufacturerSearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {/* Manual entry option */}
                          {manufacturerSearch && !manufacturerOptions.some(opt => opt.toLowerCase() === manufacturerSearch.toLowerCase()) && (
                            <div className="p-1 border-b">
                              <div
                                onClick={() => {
                                  setEditingModel({ ...editingModel, manufacturer: manufacturerSearch })
                                  setManufacturerPopoverOpen(false)
                                  setManufacturerSearch('')
                                }}
                                className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                  <span className="text-green-600 text-sm font-bold">+</span>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{t('pages.machine_model_detail.add_manufacturer', { name: manufacturerSearch })}</p>
                                  <p className="text-sm text-muted-foreground">{t('pages.machine_model_detail.create_new_manufacturer')}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Existing options */}
                          {manufacturerOptions.filter(opt => 
                            manufacturerSearch === '' || 
                            opt.toLowerCase().includes(manufacturerSearch.toLowerCase())
                          ).length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">{t('pages.machine_model_detail.no_manufacturers_found')}</div>
                          ) : (
                            <div className="p-1">
                              {manufacturerOptions
                                .filter(opt => 
                                  manufacturerSearch === '' || 
                                  opt.toLowerCase().includes(manufacturerSearch.toLowerCase())
                                )
                                .map((option) => (
                                <div
                                  key={option}
                                  onClick={() => {
                                    setEditingModel({ ...editingModel, manufacturer: option })
                                    setManufacturerPopoverOpen(false)
                                    setManufacturerSearch('')
                                  }}
                                  className={cn(
                                    "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                                    editingModel.manufacturer === option && "bg-accent"
                                  )}
                                >
                                  <Check
                                    className={cn(
                                      "h-4 w-4",
                                      editingModel.manufacturer === option ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
                                    <Building className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium">{option}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-catalogue">{t('pages.machine_model_detail.catalogue_number')}</Label>
                    <Input
                      id="edit-catalogue"
                      value={editingModel.catalogue_number || ''}
                      onChange={(e) => setEditingModel({ ...editingModel, catalogue_number: e.target.value })}
                      placeholder={t('pages.machine_model_detail.enter_catalogue_number')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-warranty">{t('pages.machine_model_detail.warranty_months')}</Label>
                    <Input
                      id="edit-warranty"
                      type="number"
                      min="0"
                      max="120"
                      value={editingModel.warranty_months}
                      onChange={(e) => setEditingModel({ ...editingModel, warranty_months: parseInt(e.target.value) || 0 })}
                      placeholder={t('pages.machine_model_detail.warranty_placeholder')}
                    />
                  </div>
                  
                  {/* Category Selection */}
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-category">{t('pages.machine_model_detail.category')}</Label>
                    <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={categoryPopoverOpen}
                          className="w-full justify-between h-11"
                        >
                          {editingModel.category_id 
                            ? machineCategories.find(cat => cat.id === editingModel.category_id)?.name 
                            : editingModel.category_name || t('pages.machine_model_detail.select_category_optional')}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="border-b p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('pages.machine_model_detail.search_categories')}
                              className="pl-10"
                              value={categorySearch}
                              onChange={(e) => setCategorySearch(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto p-1">
                          {/* No category option */}
                          <div
                            onClick={() => {
                              setEditingModel({ ...editingModel, category_id: undefined, category_name: undefined })
                              setCategoryPopoverOpen(false)
                            }}
                            className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                              <span className="text-gray-600 text-sm">-</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{t('pages.machine_model_detail.no_category')}</p>
                            </div>
                          </div>
                          {/* Existing categories */}
                          {machineCategories
                            .filter(cat => 
                              categorySearch === '' || 
                              cat.name.toLowerCase().includes(categorySearch.toLowerCase())
                            )
                            .map((category) => (
                            <div
                              key={category.id}
                              onClick={() => {
                                setEditingModel({ ...editingModel, category_id: category.id, category_name: category.name })
                                setCategoryPopoverOpen(false)
                              }}
                              className={cn(
                                "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                                editingModel.category_id === category.id && "bg-accent"
                              )}
                            >
                              <Check
                                className={cn(
                                  "h-4 w-4",
                                  editingModel.category_id === category.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                                <Package className="w-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{category.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-description">{t('pages.machine_model_detail.description')}</Label>
                  <Textarea
                    id="edit-description"
                    value={editingModel.description || ''}
                    onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                    placeholder={t('pages.machine_model_detail.enter_description')}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                {t('pages.machine_model_detail.cancel')}
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editingModel?.name || !editingModel?.manufacturer}>
                {t('pages.machine_model_detail.save_changes')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('pages.machine_model_detail.delete_machine_title')}</DialogTitle>
              <DialogDescription>
                <div className="space-y-2">
                  <p>{t('pages.machine_model_detail.delete_machine_description')}</p>
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                    <li>{t('pages.machine_model_detail.remove_assignment')}</li>
                    <li>{t('pages.machine_model_detail.delete_serial')}</li>
                  </ul>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
                      <strong>{t('pages.machine_model_detail.note')}:</strong> {t('pages.machine_model_detail.delete_warning')}
                    </p>
                  </div>
                  <div className="mt-4 space-y-1">
                    <p><strong>{t('pages.machine_model_detail.machine')}:</strong> {machineToDelete?.model_name}</p>
                    <p><strong>{t('pages.machine_model_detail.serial')}:</strong> {machineToDelete?.serial_number}</p>
                    <p><strong>{t('pages.machine_model_detail.customer')}:</strong> {machineToDelete?.customer_name}</p>
                  </div>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                {t('pages.machine_model_detail.cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDeleting ? t('pages.machine_model_detail.deleting') : t('pages.machine_model_detail.permanently_delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Model Confirmation Dialog */}
        <Dialog open={showDeleteModelDialog} onOpenChange={setShowDeleteModelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('pages.machine_model_detail.delete_model_title')}</DialogTitle>
              <DialogDescription>
                <div className="space-y-2">
                  <p>{t('pages.machine_model_detail.delete_model_description')}</p>
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-800">
                      <strong>{t('pages.machine_model_detail.warning')}:</strong> {t('pages.machine_model_detail.delete_model_warning')}
                    </p>
                  </div>
                  {model && (
                    <div className="mt-4 space-y-1">
                      <p><strong>{t('pages.machine_model_detail.model')}:</strong> {model.name}</p>
                      <p><strong>{t('pages.machine_model_detail.manufacturer')}:</strong> {model.manufacturer}</p>
                      <p><strong>{t('pages.machine_model_detail.total_serials')}:</strong> {model.total_serials}</p>
                      <p><strong>{t('pages.machine_model_detail.assigned_machines')}:</strong> {model.total_assigned}</p>
                      <p><strong>{t('pages.machine_model_detail.active_warranties')}:</strong> {model.active_warranty}</p>
                    </div>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteModelDialog(false)} disabled={isDeletingModel}>
                {t('pages.machine_model_detail.cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDeleteModelConfirm} disabled={isDeletingModel}>
                {isDeletingModel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDeletingModel ? t('pages.machine_model_detail.deleting') : t('pages.machine_model_detail.delete_model')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
