import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Loader2,
  X,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { apiService } from '../services/api'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '../hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '../components/ui/column-visibility-dropdown'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { DeleteConfirmationDialog } from '../components/ui/delete-confirmation-dialog'
import { InventoryInUseAlertDialog } from '../components/ui/inventory-in-use-alert-dialog'
import { formatCurrency } from '../lib/currency'
import { toast } from 'sonner'

// Define columns for the inventory table
const INVENTORY_COLUMNS = defineColumns([
  { key: 'name', label: 'tabs.inventory.item_name' },
  { key: 'description', label: 'tabs.inventory.description' },
  { key: 'quantity', label: 'tabs.inventory.quantity' },
  { key: 'price', label: 'tabs.inventory.unit_price' },
  { key: 'category', label: 'tabs.inventory.category' },
  { key: 'supplier', label: 'tabs.inventory.supplier' },
  { key: 'sku', label: 'tabs.inventory.sku' },
  { key: 'location', label: 'tabs.inventory.location' },
])

interface InventoryItem {
  id: string
  name: string
  description?: string
  quantity: number
  unit_price: number
  category?: string
  min_stock_level?: number
  supplier?: string
  sku?: string
  location?: string
  created_at: string
  updated_at: string
}

const getStockStatus = (quantity: number, minStock?: number, t: any) => {
  if (!minStock) {
    return <Badge variant="outline">{t('pages.inventory.no_min_level')}</Badge>
  }
  
  if (quantity <= 0) {
    return <Badge variant="destructive">{t('pages.inventory.out_of_stock')}</Badge>
  } else if (quantity <= minStock) {
    return <Badge variant="outline" className="border-orange-300 text-orange-700">{t('pages.inventory.low_stock')}</Badge>
  } else {
    return <Badge variant="outline" className="border-green-300 text-green-700">{t('pages.inventory.in_stock')}</Badge>
  }
}

export default function Inventory() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  
  // Column visibility hook
  const {
    visibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isSyncing
  } = useColumnVisibility('inventory', getDefaultColumnKeys(INVENTORY_COLUMNS))
  
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    category: '',
    supplier: '',
    stock_status: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(25)
  const [error, setError] = useState('')
  
  // Edit/Delete state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [inUseAlertOpen, setInUseAlertOpen] = useState(false)
  const [itemInUse, setItemInUse] = useState<{ item: InventoryItem | null, workOrderCount: number }>({ item: null, workOrderCount: 0 })
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    quantity: '',
    unit_price: '',
    category: '',
    supplier: '',
    sku: '',
    location: '',
    min_stock_level: ''
  })
  const [stockAdjustment, setStockAdjustment] = useState({
    quantity: '',
    reason: 'adjustment'
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [appliedSearchTerm, filters, currentPage])

  const fetchInventory = async () => {
    try {
      setIsLoading(true)
      const searchParams: any = {
        page: currentPage,
        limit: pageSize
      }
      
      if (appliedSearchTerm) {
        searchParams.search = appliedSearchTerm
      }
      
      if (filters.category) {
        searchParams.category = filters.category
      }
      
      if (filters.supplier) {
        searchParams.supplier = filters.supplier
      }
      
      if (filters.stock_status) {
        searchParams.stock_status = filters.stock_status
      }
      
      
      
      const response = await apiService.getInventory(searchParams)
      
      
      const inventoryData = response.data || []
      setInventory(inventoryData)
      setTotalPages(response.pagination?.pages || 1)
      setTotalCount(response.pagination?.total || 0)
    } catch (err) {
      setError('Failed to load inventory')
      console.error('Error fetching inventory:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewItem = (itemId: string) => {
    navigate(`/inventory/${itemId}`)
  }

  const handleEditItem = (item: InventoryItem) => {
    setSelectedItem(item)
    setEditFormData({
      name: item.name,
      description: item.description || '',
      quantity: item.quantity.toString(),
      unit_price: item.unit_price.toString(),
      category: item.category || '',
      supplier: item.supplier || '',
      sku: item.sku || '',
      location: item.location || '',
      min_stock_level: item.min_stock_level?.toString() || ''
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedItem) return

    setIsSubmitting(true)
    try {
      await apiService.updateInventoryItem(selectedItem.id, {
        name: editFormData.name,
        description: editFormData.description || null,
        quantity: parseInt(editFormData.quantity),
        unit_price: parseFloat(editFormData.unit_price),
        category: editFormData.category || null,
        supplier: editFormData.supplier || null,
        sku: editFormData.sku || null,
        location: editFormData.location || null,
        min_stock_level: editFormData.min_stock_level ? parseInt(editFormData.min_stock_level) : null
      })
      
      toast.success('Inventory item updated successfully')
      setEditDialogOpen(false)
      setSelectedItem(null)
      fetchInventory()
    } catch (err: any) {
      console.error('Error updating item:', err)
      toast.error(err.response?.data?.message || 'Failed to update item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdjustStock = (item: InventoryItem) => {
    setSelectedItem(item)
    setStockAdjustment({
      quantity: item.quantity.toString(),
      reason: 'adjustment'
    })
    setAdjustStockDialogOpen(true)
  }

  const handleSaveStockAdjustment = async () => {
    if (!selectedItem) return

    setIsSubmitting(true)
    try {
      await apiService.updateInventoryItem(selectedItem.id, {
        quantity: parseInt(stockAdjustment.quantity)
      })
      
      toast.success('Stock adjusted successfully')
      setAdjustStockDialogOpen(false)
      setSelectedItem(null)
      fetchInventory()
    } catch (err: any) {
      console.error('Error adjusting stock:', err)
      toast.error(err.response?.data?.message || 'Failed to adjust stock')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteItem = (item: InventoryItem) => {
    setSelectedItem(item)
    setDeleteDialogOpen(true)
  }

  const confirmDeleteItem = async () => {
    if (!selectedItem) return

    setIsSubmitting(true)
    try {
      await apiService.deleteInventoryItem(selectedItem.id)
      toast.success('Inventory item deleted successfully')
      setDeleteDialogOpen(false)
      setSelectedItem(null)
      fetchInventory()
    } catch (err: any) {
      console.error('Error deleting item:', err)
      
      // Check if it's a "item in use" error
      if (err.response?.data?.message?.includes('currently used in') && err.response?.data?.message?.includes('work order')) {
        // Extract the count from the error message
        const message = err.response.data.message
        const countMatch = message.match(/used in (\d+) work order/)
        const workOrderCount = countMatch ? parseInt(countMatch[1]) : 0
        
        setItemInUse({ item: selectedItem, workOrderCount })
        setInUseAlertOpen(true)
        setDeleteDialogOpen(false)
      } else {
        toast.error(err.response?.data?.message || 'Failed to delete item')
      }
    } finally {
      setIsSubmitting(false)
    }
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
      category: '',
      supplier: '',
      stock_status: ''
    })
    setCurrentPage(1)
  }

  const getUniqueCategories = () => {
    const categories = new Set<string>()
    inventory.forEach(item => {
      if (item.category) {
        categories.add(item.category)
      }
    })
    return Array.from(categories).sort()
  }

  const getUniqueSuppliers = () => {
    const suppliers = new Set<string>()
    inventory.forEach(item => {
      if (item.supplier) {
        suppliers.add(item.supplier)
      }
    })
    return Array.from(suppliers).sort()
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '').length
  }

  const lowStockItems = inventory.filter(item => 
    item.min_stock_level && item.quantity <= item.min_stock_level
  )

  const outOfStockItems = inventory.filter(item => item.quantity <= 0)

  const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading inventory...</span>
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
            <Button onClick={fetchInventory}>Try Again</Button>
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
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground">
              Manage parts, supplies, and equipment inventory
            </p>
          </div>
          <Button onClick={() => navigate('/add-inventory-item')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('pages.inventory.add_item')}
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.inventory.total_items')}</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">{t('pages.inventory.inventory_items')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.inventory.low_stock')}</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground">{t('pages.inventory.below_minimum_level')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.inventory.out_of_stock')}</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outOfStockItems.length}</div>
              <p className="text-xs text-muted-foreground">{t('pages.inventory.need_restocking')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.inventory.total_value')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground">{t('pages.inventory.inventory_value')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
        <SmartSearch
          placeholder={t('pages.inventory.search_inventory')}
          value={appliedSearchTerm}
          onSearch={(term) => {
            setAppliedSearchTerm(term)
            setCurrentPage(1)
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
                  columns={INVENTORY_COLUMNS}
                  visibleColumns={visibleColumns}
                  onToggleColumn={toggleColumn}
                  onShowAll={showAllColumns}
                  onHideAll={hideAllColumns}
                  onReset={resetColumns}
                  isSyncing={isSyncing}
                />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="relative">
                      <Filter className="mr-2 h-4 w-4" />
                      {t('pages.inventory.filters')}
                      {getActiveFiltersCount() > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {getActiveFiltersCount()}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>{t('pages.inventory.filter_by')}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">{t('pages.inventory.category')}</label>
                      <Select value={filters.category || "all"} onValueChange={(value) => handleFilterChange('category', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('pages.inventory.all_categories')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('pages.inventory.all_categories')}</SelectItem>
                          {getUniqueCategories().map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">{t('pages.inventory.supplier')}</label>
                      <Select value={filters.supplier || "all"} onValueChange={(value) => handleFilterChange('supplier', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('pages.inventory.all_suppliers')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('pages.inventory.all_suppliers')}</SelectItem>
                          {getUniqueSuppliers().map((supplier) => (
                            <SelectItem key={supplier} value={supplier}>
                              {supplier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">{t('pages.inventory.stock_status')}</label>
                      <Select value={filters.stock_status || "all"} onValueChange={(value) => handleFilterChange('stock_status', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('pages.inventory.all_statuses')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('pages.inventory.all_statuses')}</SelectItem>
                          <SelectItem value="in_stock">{t('pages.inventory.in_stock')}</SelectItem>
                          <SelectItem value="low_stock">{t('pages.inventory.low_stock')}</SelectItem>
                          <SelectItem value="out_of_stock">{t('pages.inventory.out_of_stock')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      {t('pages.inventory.clear_filters')}
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
                  {isColumnVisible('name') && <TableHead>{t('pages.inventory.item')}</TableHead>}
                  {isColumnVisible('sku') && <TableHead>{t('pages.inventory.sku')}</TableHead>}
                  {isColumnVisible('category') && <TableHead>{t('pages.inventory.category')}</TableHead>}
                  {isColumnVisible('quantity') && <TableHead>{t('pages.inventory.quantity')}</TableHead>}
                  {isColumnVisible('price') && <TableHead>{t('pages.inventory.unit_price')}</TableHead>}
                  {isColumnVisible('supplier') && <TableHead>{t('pages.inventory.supplier')}</TableHead>}
                  {isColumnVisible('location') && <TableHead>{t('pages.inventory.location')}</TableHead>}
                  <TableHead className="text-right">{t('pages.inventory.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item, index) => (
                  <TableRow 
                    key={`item-${item.id}-${index}`}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/inventory/${item.id}`)}
                  >
                    {isColumnVisible('name') && (
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.name}</div>
                          {item.description && (
                            <div className="text-sm text-muted-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('sku') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {item.sku || t('pages.inventory.na')}
                      </TableCell>
                    )}
                    {isColumnVisible('category') && (
                      <TableCell>
                        <Badge variant="outline">{item.category || t('pages.inventory.uncategorized')}</Badge>
                      </TableCell>
                    )}
                    {isColumnVisible('quantity') && (
                      <TableCell className="font-medium">{item.quantity}</TableCell>
                    )}
                    {isColumnVisible('price') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {formatCurrency(item.unit_price)}
                      </TableCell>
                    )}
                    {isColumnVisible('supplier') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {item.supplier || t('pages.inventory.na')}
                      </TableCell>
                    )}
                    {isColumnVisible('location') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {item.location || t('pages.inventory.na')}
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
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuLabel>{t('pages.inventory.actions')}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewItem(item.id); }}>
                            <Eye className="mr-2 h-4 w-4" />
                            {t('pages.inventory.view_details')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            {t('pages.inventory.edit_item')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAdjustStock(item); }}>
                            <Package className="mr-2 h-4 w-4" />
                            {t('pages.inventory.adjust_stock')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t('pages.inventory.delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} items
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

        {/* Edit Item Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('pages.inventory.edit_inventory_item')}</DialogTitle>
              <DialogDescription>
                {t('pages.inventory.update_details_for', { name: selectedItem?.name })}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t('pages.inventory.item_name')} *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">{t('pages.inventory.sku')}</Label>
                <Input
                  id="edit-sku"
                  value={editFormData.sku}
                  onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-description">{t('pages.inventory.description')}</Label>
                <Input
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">{t('pages.inventory.quantity')} *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit-price">{t('pages.inventory.unit_price_km')} *</Label>
                <Input
                  id="edit-unit-price"
                  type="number"
                  step="0.01"
                  value={editFormData.unit_price}
                  onChange={(e) => setEditFormData({ ...editFormData, unit_price: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">{t('pages.inventory.category')}</Label>
                <Input
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplier">{t('pages.inventory.supplier')}</Label>
                <Input
                  id="edit-supplier"
                  value={editFormData.supplier}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">{t('pages.inventory.location')}</Label>
                <Input
                  id="edit-location"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-min-stock">{t('pages.inventory.minimum_stock_level')}</Label>
                <Input
                  id="edit-min-stock"
                  type="number"
                  value={editFormData.min_stock_level}
                  onChange={(e) => setEditFormData({ ...editFormData, min_stock_level: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                {t('pages.inventory.cancel')}
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('pages.inventory.saving')}
                  </>
                ) : (
                  t('pages.inventory.save_changes')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Adjust Stock Dialog */}
        <Dialog open={adjustStockDialogOpen} onOpenChange={setAdjustStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('pages.inventory.adjust_stock')}</DialogTitle>
              <DialogDescription>
                {t('pages.inventory.update_stock_level_for', { name: selectedItem?.name })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-stock">{t('pages.inventory.current_stock')}</Label>
                <Input
                  id="current-stock"
                  value={selectedItem?.quantity || 0}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-quantity">{t('pages.inventory.new_quantity')} *</Label>
                <Input
                  id="new-quantity"
                  type="number"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment-reason">{t('pages.inventory.reason')}</Label>
                <Select 
                  value={stockAdjustment.reason} 
                  onValueChange={(value) => setStockAdjustment({ ...stockAdjustment, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment">{t('pages.inventory.stock_adjustment')}</SelectItem>
                    <SelectItem value="restock">{t('pages.inventory.restocking')}</SelectItem>
                    <SelectItem value="damage">{t('pages.inventory.damaged_items')}</SelectItem>
                    <SelectItem value="lost">{t('pages.inventory.lost_items')}</SelectItem>
                    <SelectItem value="correction">{t('pages.inventory.inventory_correction')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustStockDialogOpen(false)}>
                {t('pages.inventory.cancel')}
              </Button>
              <Button onClick={handleSaveStockAdjustment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('pages.inventory.adjusting')}
                  </>
                ) : (
                  t('pages.inventory.adjust_stock')
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <DeleteConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDeleteItem}
          title={t('pages.inventory.delete_inventory_item')}
          description={t('pages.inventory.delete_confirmation', { name: selectedItem?.name })}
          isLoading={isSubmitting}
        />

        {/* Inventory In Use Alert Dialog */}
        <InventoryInUseAlertDialog
          open={inUseAlertOpen}
          onOpenChange={setInUseAlertOpen}
          itemName={itemInUse.item?.name}
          workOrderCount={itemInUse.workOrderCount}
          title={t('pages.inventory.cannot_delete_item')}
        />
      </div>
    </MainLayout>
  )
}