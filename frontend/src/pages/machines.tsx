import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SmartSearch } from '@/components/ui/smart-search'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  X,
  Filter,
  Check,
  ChevronDown,
  Building
} from 'lucide-react'
import { apiService } from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

// Define columns for the machines table
const MACHINE_COLUMNS = defineColumns([
  { key: 'name', label: 'pages.machines.model_name' },
  { key: 'manufacturer', label: 'pages.machines.manufacturer' },
  { key: 'catalogue', label: 'pages.machines.catalogue_number' },
  { key: 'category', label: 'pages.machines.category' },
  { key: 'warranty', label: 'pages.machines.warranty_period' },
  { key: 'serials', label: 'pages.machines.total_serials' },
  { key: 'assigned', label: 'pages.machines.assigned' },
])

export default function Machines() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  
  // Column visibility hook
  const {
    visibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isSyncing
  } = useColumnVisibility('machines', getDefaultColumnKeys(MACHINE_COLUMNS))
  const { hasPermission } = useAuth()
  const [machineModels, setMachineModels] = useState<MachineModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    category: '',
    manufacturer: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(25)
  
  // Edit model state
  const [editingModel, setEditingModel] = useState<MachineModel | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [machineCategories, setMachineCategories] = useState<MachineCategory[]>([])
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [manufacturerPopoverOpen, setManufacturerPopoverOpen] = useState(false)
  const [manufacturerSearch, setManufacturerSearch] = useState('')
  const [manufacturerOptions, setManufacturerOptions] = useState<string[]>([])
  
  // Delete model state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [modelToDelete, setModelToDelete] = useState<MachineModel | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch machine models when applied search term or filters change
  useEffect(() => {
    fetchMachineModels()
  }, [appliedSearchTerm, filters, currentPage])

  // Fetch categories and suppliers on mount
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
      // Extract unique manufacturer names from existing models and suppliers
      const supplierNames = suppliersData.map((s: any) => s.name)
      const modelManufacturers = machineModels.map(m => m.manufacturer).filter(Boolean)
      const allManufacturers = [...new Set([...supplierNames, ...modelManufacturers])]
      setManufacturerOptions(allManufacturers)
    } catch (err) {
      console.error('Error fetching manufacturers:', err)
      // Fallback to existing model manufacturers
      const modelManufacturers = machineModels.map(m => m.manufacturer).filter(Boolean)
      setManufacturerOptions([...new Set(modelManufacturers)])
    }
  }

  const fetchMachineModels = async () => {
    try {
      setIsLoading(true)
      setError('')

      const searchParams: any = {
        page: currentPage,
        limit: pageSize
      }

      if (appliedSearchTerm.trim()) {
        searchParams.search = appliedSearchTerm.trim()
      }

      if (filters.category) {
        searchParams.category = filters.category
      }

      if (filters.manufacturer) {
        searchParams.manufacturer = filters.manufacturer
      }

      const response = await apiService.getMachineModels(searchParams) as any
      
      // Backend returns { data: [...], pagination: {...} }
      const modelsData = response.data || []
      const pagination = response.pagination || {}
      
      setMachineModels(modelsData)
      setTotalPages(pagination.pages || 1)
      setTotalCount(pagination.total || 0)
      
    } catch (err) {
      setError(t('machines_failed_to_load_machine_models'))
      console.error('Error fetching machine models:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewModel = (modelId: string) => {
    navigate(`/machines/model/${modelId}`)
  }

  const handleEditModel = (model: MachineModel) => {
    // Create a copy of the model to avoid mutating the original
    setEditingModel({ ...model })
    setShowEditDialog(true)
  }

  const handleSaveEdit = async () => {
    if (!editingModel || !editingModel.id) {
      toast.error(t('machines_invalid_model_data'))
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
      
      // Update the machine model via API
      await apiService.updateMachineModel(editingModel.id, updateData)
      
      toast.success(t('machines_machine_model_updated_successfully'))
      
      // Refresh the list
      await fetchMachineModels()
      setShowEditDialog(false)
      setEditingModel(null)
      setCategorySearch('')
    } catch (err: any) {
      console.error('Error updating machine model:', err)
      toast.error(err.message || t('machines_failed_to_update_machine_model'))
    }
  }

  const handleDeleteClick = (model: MachineModel) => {
    setModelToDelete(model)
    setShowDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    if (!modelToDelete) return

    try {
      setIsDeleting(true)
      await apiService.deleteMachineModel(modelToDelete.id)
      toast.success(t('machines_machine_model_deleted_successfully'))
      setShowDeleteDialog(false)
      setModelToDelete(null)
      // Refresh the list
      await fetchMachineModels()
    } catch (err: any) {
      console.error('Error deleting machine model:', err)
      toast.error(err.message || t('machines_failed_to_delete_machine_model'))
    } finally {
      setIsDeleting(false)
    }
  }

  // Get unique categories and manufacturers for filter dropdowns
  const getUniqueCategories = () => {
    const categories = machineModels
      .map(model => model.category_name)
      .filter((category, index, self) => category && self.indexOf(category) === index)
    return categories.sort()
  }

  const getUniqueManufacturers = () => {
    const manufacturers = machineModels
      .map(model => model.manufacturer)
      .filter((manufacturer, index, self) => manufacturer && self.indexOf(manufacturer) === index)
    return manufacturers.sort()
  }

  // No more frontend filtering - backend handles it all
  const filteredModels = machineModels

  const totalModels = totalCount
  const totalAssigned = machineModels.reduce((sum, model) => sum + (parseInt(model.total_assigned?.toString() || '0') || 0), 0)
  const totalUnassigned = machineModels.reduce((sum, model) => sum + (parseInt(model.unassigned_serials?.toString() || '0') || 0), 0)
  const totalActiveWarranty = machineModels.reduce((sum, model) => sum + (parseInt(model.active_warranty?.toString() || '0') || 0), 0)

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">{t('pages.machines.loading_machine_models')}</span>
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
            <Button onClick={fetchMachineModels}>{t('pages.machines.try_again')}</Button>
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
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.machines.title')}</h1>
            <p className="text-muted-foreground">
              {t('pages.machines.subtitle')}
            </p>
          </div>
          <Button onClick={() => navigate('/add-machine-model')}>
            <Plus className="mr-2 h-4 w-4" />
{t('pages.machines.add_machine_model')}
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.machines.total_models')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalModels}</div>
              <p className="text-xs text-muted-foreground">{t('pages.machines.machine_models')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.machines.assigned_machines')}</CardTitle>
              <User className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
              <p className="text-xs text-muted-foreground">{t('pages.machines.with_customers')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.machines.unassigned')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUnassigned}</div>
              <p className="text-xs text-muted-foreground">{t('pages.machines.available_for_assignment')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.machines.active_warranty')}</CardTitle>
              <Shield className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActiveWarranty}</div>
              <p className="text-xs text-muted-foreground">{t('pages.machines.under_warranty')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Machine Models Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
        <SmartSearch
          placeholder={t('pages.machines.search_machine_models')}
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
                
                {/* Column Visibility */}
                <ColumnVisibilityDropdown
                  columns={MACHINE_COLUMNS}
                  visibleColumns={visibleColumns}
                  onToggleColumn={toggleColumn}
                  onShowAll={showAllColumns}
                  onHideAll={hideAllColumns}
                  onReset={resetColumns}
                  isSyncing={isSyncing}
                />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-9">
                      <Filter className="mr-2 h-4 w-4" />
{t('pages.machines.filters')}
                      {(filters.category || filters.manufacturer) && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                          {[filters.category, filters.manufacturer].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{t('pages.machines.filter_by')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Category Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">{t('pages.machines.category')}</Label>
                      <Select
                        value={filters.category}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, category: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={t('pages.machines.all_categories')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">{t('pages.machines.clear_category')}</SelectItem>
                          {getUniqueCategories().map(category => (
                            <SelectItem key={category} value={category || ''}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Manufacturer Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">{t('pages.machines.manufacturer')}</Label>
                      <Select
                        value={filters.manufacturer}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, manufacturer: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={t('pages.machines.all_manufacturers')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">{t('pages.machines.clear_manufacturer')}</SelectItem>
                          {getUniqueManufacturers().map(manufacturer => (
                            <SelectItem key={manufacturer} value={manufacturer || ''}>{manufacturer}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setFilters({ category: '', manufacturer: '' })
                        setCurrentPage(1) // Reset to first page when clearing filters
                      }}
                      className="text-center"
                    >
{t('pages.machines.clear_filters')}
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
                  {isColumnVisible('name') && <TableHead>{t('pages.machines.model_name')}</TableHead>}
                  {isColumnVisible('manufacturer') && <TableHead>{t('pages.machines.manufacturer')}</TableHead>}
                  {isColumnVisible('catalogue') && <TableHead>{t('pages.machines.catalogue_number')}</TableHead>}
                  {isColumnVisible('category') && <TableHead>{t('pages.machines.category')}</TableHead>}
                  {isColumnVisible('warranty') && <TableHead>{t('pages.machines.warranty_period')}</TableHead>}
                  {isColumnVisible('serials') && <TableHead>{t('pages.machines.total_serials')}</TableHead>}
                  {isColumnVisible('assigned') && <TableHead>{t('pages.machines.assigned')}</TableHead>}
                  <TableHead className="text-right">{t('pages.machines.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model, index) => (
                  <TableRow 
                    key={`model-${model.id}-${index}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewModel(model.id)}
                  >
                    {isColumnVisible('name') && (
                      <TableCell>
                        <div className="font-medium">{model.name}</div>
                      </TableCell>
                    )}
                    {isColumnVisible('manufacturer') && (
                      <TableCell className="font-medium">{model.manufacturer}</TableCell>
                    )}
                    {isColumnVisible('catalogue') && (
                      <TableCell className="text-sm text-muted-foreground">
{model.catalogue_number || t('common.na')}
                      </TableCell>
                    )}
                    {isColumnVisible('category') && (
                      <TableCell>
                        <Badge variant="outline">{model.category_name || t('machines_uncategorized')}</Badge>
                      </TableCell>
                    )}
                    {isColumnVisible('warranty') && (
                      <TableCell>
                        <Badge variant="outline" className="border-orange-300 text-orange-700">
{model.warranty_months} {t('pages.machines.months')}
                        </Badge>
                      </TableCell>
                    )}
                    {isColumnVisible('serials') && (
                      <TableCell className="font-medium">{model.total_serials}</TableCell>
                    )}
                    {isColumnVisible('assigned') && (
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                            {model.total_assigned}
                          </Badge>
                          {model.unassigned_serials > 0 && (
                            <Badge variant="outline" className="border-orange-300 text-orange-700 dark:border-orange-700 dark:text-orange-400">
{model.unassigned_serials} {t('pages.machines.unassigned')}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{t('pages.machines.actions')}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewModel(model.id)}>
                            <Eye className="mr-2 h-4 w-4" />
{t('pages.machines.view_details')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            handleEditModel(model)
                          }}>
                            <Edit className="mr-2 h-4 w-4" />
{t('pages.machines.edit_model')}
                          </DropdownMenuItem>
                          {hasPermission('machines:assign') && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/machines/model/${model.id}`)
                            }}>
                              <Wrench className="mr-2 h-4 w-4" />
{t('pages.machines.assign_machine')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(model)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
{t('pages.machines.delete_model')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
{t('pages.machines.showing')} {((currentPage - 1) * pageSize) + 1} {t('pages.machines.to')} {Math.min(currentPage * pageSize, totalCount)} {t('pages.machines.of')} {totalCount} {t('pages.machines.machine_models_count')}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
{t('pages.machines.previous')}
                  </Button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
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
                    );
                  })}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
{t('pages.machines.next')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Machine Model Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t('pages.machines.edit_machine_model')}</DialogTitle>
              <DialogDescription>
                {t('pages.machines.update_machine_model_info')}
              </DialogDescription>
            </DialogHeader>
            {editingModel && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">{t('pages.machines.model_name_required')}</Label>
                    <Input
                      id="edit-name"
                      value={editingModel.name}
                      onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                      placeholder={t('pages.machines.enter_model_name')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-manufacturer">{t('pages.machines.manufacturer_required')}</Label>
                    <Popover open={manufacturerPopoverOpen} onOpenChange={setManufacturerPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={manufacturerPopoverOpen}
                          className="w-full justify-between h-11"
                        >
{editingModel.manufacturer || t('machines_select_manufacturer')}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="border-b p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('pages.machines.search_or_type_new_manufacturer')}
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
                                  <p className="font-medium">{t('pages.machines.add')} "{manufacturerSearch}"</p>
                                  <p className="text-sm text-muted-foreground">{t('pages.machines.create_new_manufacturer')}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Existing options */}
                          {manufacturerOptions.filter(opt => 
                            manufacturerSearch === '' || 
                            opt.toLowerCase().includes(manufacturerSearch.toLowerCase())
                          ).length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">{t('pages.machines.no_manufacturers_found')}</div>
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
                    <Label htmlFor="edit-catalogue">{t('pages.machines.catalogue_number')}</Label>
                    <Input
                      id="edit-catalogue"
                      value={editingModel.catalogue_number || ''}
                      onChange={(e) => setEditingModel({ ...editingModel, catalogue_number: e.target.value })}
                      placeholder={t('pages.machines.enter_catalogue_number')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-warranty">{t('pages.machines.warranty_months')}</Label>
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
                  
                  {/* Category Selection */}
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit-category">{t('pages.machines.category')}</Label>
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
                            : editingModel.category_name || t('machines_select_category_optional')}
                          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <div className="border-b p-3">
                          <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder={t('pages.machines.search_categories')}
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
                              <p className="font-medium">{t('pages.machines.no_category')}</p>
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
                                <Package className="w-4 h-4 text-primary" />
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
                  <Label htmlFor="edit-description">{t('pages.machines.description')}</Label>
                  <Textarea
                    id="edit-description"
                    value={editingModel.description || ''}
                    onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                    placeholder={t('pages.machines.enter_machine_model_description')}
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                {t('pages.machines.cancel')}
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editingModel?.name || !editingModel?.manufacturer}>
                {t('pages.machines.save_changes')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('pages.machines.delete_machine_model')}</DialogTitle>
              <DialogDescription>
                <div className="space-y-2">
                  <p>{t('pages.machines.delete_confirmation')}</p>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <p className="text-sm text-yellow-800">
<strong>{t('pages.machines.warning')}</strong> {t('pages.machines.delete_warning')}
                    </p>
                  </div>
                  {modelToDelete && (
                    <div className="mt-4 space-y-1">
                      <p><strong>{t('pages.machines.model')}</strong> {modelToDelete.name}</p>
                      <p><strong>{t('pages.machines.manufacturer')}:</strong> {modelToDelete.manufacturer}</p>
                      <p><strong>{t('pages.machines.total_serials')}</strong> {modelToDelete.total_serials}</p>
                      <p><strong>{t('pages.machines.assigned')}</strong> {modelToDelete.total_assigned}</p>
                    </div>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
                {t('pages.machines.cancel')}
              </Button>
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={isDeleting}>
                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isDeleting ? t('machines_deleting') : t('machines_delete_model')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}