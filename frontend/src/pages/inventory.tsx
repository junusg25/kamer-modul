import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
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
  Search,
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
  { key: 'name', label: 'Item Name' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'price', label: 'Unit Price' },
  { key: 'category', label: 'Category' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'sku', label: 'SKU' },
  { key: 'location', label: 'Location' },
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

const getStockStatus = (quantity: number, minStock?: number) => {
  if (!minStock) {
    return <Badge variant="outline">No Min Level</Badge>
  }
  
  if (quantity <= 0) {
    return <Badge variant="destructive">Out of Stock</Badge>
  } else if (quantity <= minStock) {
    return <Badge variant="outline" className="border-orange-300 text-orange-700">Low Stock</Badge>
  } else {
    return <Badge variant="outline" className="border-green-300 text-green-700">In Stock</Badge>
  }
}

export default function Inventory() {
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
  const [searchTerm, setSearchTerm] = useState('')
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

  const handleSearch = () => {
    setAppliedSearchTerm(searchTerm)
    setCurrentPage(1)
  }

  const handleClearSearch = () => {
    setSearchTerm('')
    setAppliedSearchTerm('')
    setCurrentPage(1)
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
            Add Item
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCount}</div>
              <p className="text-xs text-muted-foreground">Inventory items</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Low Stock</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lowStockItems.length}</div>
              <p className="text-xs text-muted-foreground">Below minimum level</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Out of Stock</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{outOfStockItems.length}</div>
              <p className="text-xs text-muted-foreground">Need restocking</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground">Inventory value</p>
            </CardContent>
          </Card>
        </div>

        {/* Inventory Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search inventory..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSearch()
                      }
                    }}
                    className="pl-10 w-80"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={handleClearSearch}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <Button onClick={handleSearch} variant="outline">
                  Search
                </Button>
                
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
                      Filters
                      {getActiveFiltersCount() > 0 && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {getActiveFiltersCount()}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">Category</label>
                      <Select value={filters.category || "all"} onValueChange={(value) => handleFilterChange('category', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {getUniqueCategories().map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">Supplier</label>
                      <Select value={filters.supplier || "all"} onValueChange={(value) => handleFilterChange('supplier', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All suppliers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All suppliers</SelectItem>
                          {getUniqueSuppliers().map((supplier) => (
                            <SelectItem key={supplier} value={supplier}>
                              {supplier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="p-2">
                      <label className="text-sm font-medium mb-2 block">Stock Status</label>
                      <Select value={filters.stock_status || "all"} onValueChange={(value) => handleFilterChange('stock_status', value === "all" ? "" : value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="in_stock">In Stock</SelectItem>
                          <SelectItem value="low_stock">Low Stock</SelectItem>
                          <SelectItem value="out_of_stock">Out of Stock</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleClearFilters}>
                      <X className="mr-2 h-4 w-4" />
                      Clear Filters
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
                  {isColumnVisible('name') && <TableHead>Item</TableHead>}
                  {isColumnVisible('sku') && <TableHead>SKU</TableHead>}
                  {isColumnVisible('category') && <TableHead>Category</TableHead>}
                  {isColumnVisible('quantity') && <TableHead>Quantity</TableHead>}
                  {isColumnVisible('price') && <TableHead>Unit Price</TableHead>}
                  {isColumnVisible('supplier') && <TableHead>Supplier</TableHead>}
                  {isColumnVisible('location') && <TableHead>Location</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
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
                        {item.sku || 'N/A'}
                      </TableCell>
                    )}
                    {isColumnVisible('category') && (
                      <TableCell>
                        <Badge variant="outline">{item.category || 'Uncategorized'}</Badge>
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
                        {item.supplier || 'N/A'}
                      </TableCell>
                    )}
                    {isColumnVisible('location') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {item.location || 'N/A'}
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
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewItem(item.id); }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditItem(item); }}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Item
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleAdjustStock(item); }}>
                            <Package className="mr-2 h-4 w-4" />
                            Adjust Stock
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDeleteItem(item); }}
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
              <DialogTitle>Edit Inventory Item</DialogTitle>
              <DialogDescription>
                Update the details for {selectedItem?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Item Name *</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-sku">SKU</Label>
                <Input
                  id="edit-sku"
                  value={editFormData.sku}
                  onChange={(e) => setEditFormData({ ...editFormData, sku: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-quantity">Quantity *</Label>
                <Input
                  id="edit-quantity"
                  type="number"
                  value={editFormData.quantity}
                  onChange={(e) => setEditFormData({ ...editFormData, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-unit-price">Unit Price (KM) *</Label>
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
                <Label htmlFor="edit-category">Category</Label>
                <Input
                  id="edit-category"
                  value={editFormData.category}
                  onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-supplier">Supplier</Label>
                <Input
                  id="edit-supplier"
                  value={editFormData.supplier}
                  onChange={(e) => setEditFormData({ ...editFormData, supplier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editFormData.location}
                  onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-min-stock">Minimum Stock Level</Label>
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
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Adjust Stock Dialog */}
        <Dialog open={adjustStockDialogOpen} onOpenChange={setAdjustStockDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adjust Stock</DialogTitle>
              <DialogDescription>
                Update stock level for {selectedItem?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="current-stock">Current Stock</Label>
                <Input
                  id="current-stock"
                  value={selectedItem?.quantity || 0}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-quantity">New Quantity *</Label>
                <Input
                  id="new-quantity"
                  type="number"
                  value={stockAdjustment.quantity}
                  onChange={(e) => setStockAdjustment({ ...stockAdjustment, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment-reason">Reason</Label>
                <Select 
                  value={stockAdjustment.reason} 
                  onValueChange={(value) => setStockAdjustment({ ...stockAdjustment, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="adjustment">Stock Adjustment</SelectItem>
                    <SelectItem value="restock">Restocking</SelectItem>
                    <SelectItem value="damage">Damaged Items</SelectItem>
                    <SelectItem value="lost">Lost Items</SelectItem>
                    <SelectItem value="correction">Inventory Correction</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAdjustStockDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveStockAdjustment} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adjusting...
                  </>
                ) : (
                  'Adjust Stock'
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
          title="Delete Inventory Item"
          description={`Are you sure you want to delete ${selectedItem?.name}? This action cannot be undone.`}
          isLoading={isSubmitting}
        />

        {/* Inventory In Use Alert Dialog */}
        <InventoryInUseAlertDialog
          open={inUseAlertOpen}
          onOpenChange={setInUseAlertOpen}
          itemName={itemInUse.item?.name}
          workOrderCount={itemInUse.workOrderCount}
          title="Cannot Delete Inventory Item"
        />
      </div>
    </MainLayout>
  )
}