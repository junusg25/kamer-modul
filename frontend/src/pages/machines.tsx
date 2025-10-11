import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
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
  X,
  Filter
} from 'lucide-react'
import { apiService } from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { useColumnVisibility, defineColumns, getDefaultColumnKeys } from '@/hooks/useColumnVisibility'
import { ColumnVisibilityDropdown } from '@/components/ui/column-visibility-dropdown'

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

// Define columns for the machines table
const MACHINE_COLUMNS = defineColumns([
  { key: 'name', label: 'Model Name' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'catalogue', label: 'Catalogue #' },
  { key: 'category', label: 'Category' },
  { key: 'warranty', label: 'Warranty' },
  { key: 'serials', label: 'Serials' },
  { key: 'assigned', label: 'Assigned' },
])

export default function Machines() {
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
  } = useColumnVisibility('machines', getDefaultColumnKeys(MACHINE_COLUMNS))
  const { hasPermission } = useAuth()
  const [machineModels, setMachineModels] = useState<MachineModel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('')
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    category: '',
    manufacturer: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [pageSize] = useState(20)

  // Fetch machine models when applied search term or filters change
  useEffect(() => {
    fetchMachineModels()
  }, [appliedSearchTerm, filters, currentPage])

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
      setError('Failed to load machine models')
      console.error('Error fetching machine models:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleViewModel = (modelId: string) => {
    navigate(`/machines/model/${modelId}`)
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
          <span className="ml-2">Loading machine models...</span>
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
            <Button onClick={fetchMachineModels}>Try Again</Button>
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
            <h1 className="text-3xl font-bold tracking-tight">Machine Models</h1>
            <p className="text-muted-foreground">
              Manage machine models and track assigned machines
            </p>
          </div>
          <Button onClick={() => navigate('/add-machine-model')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Machine Model
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalModels}</div>
              <p className="text-xs text-muted-foreground">Machine models</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Assigned Machines</CardTitle>
              <User className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAssigned}</div>
              <p className="text-xs text-muted-foreground">With customers</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUnassigned}</div>
              <p className="text-xs text-muted-foreground">Available for assignment</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Warranty</CardTitle>
              <Shield className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActiveWarranty}</div>
              <p className="text-xs text-muted-foreground">Under warranty</p>
            </CardContent>
          </Card>
        </div>

        {/* Machine Models Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search machine models... (press Enter to search)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        setAppliedSearchTerm(searchTerm)
                        setCurrentPage(1) // Reset to first page when searching
                      }
                    }}
                    className="pl-10 pr-10 w-80"
                    disabled={isLoading}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0"
                      onClick={() => {
                        setSearchTerm('')
                        setAppliedSearchTerm('')
                        setCurrentPage(1)
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
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
                      Filters
                      {(filters.category || filters.manufacturer) && (
                        <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                          {[filters.category, filters.manufacturer].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Category Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                      <Select
                        value={filters.category}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, category: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">Clear Category</SelectItem>
                          {getUniqueCategories().map(category => (
                            <SelectItem key={category} value={category || ''}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Manufacturer Filter */}
                    <div className="p-2">
                      <Label className="text-xs font-medium text-muted-foreground">Manufacturer</Label>
                      <Select
                        value={filters.manufacturer}
                        onValueChange={(value) => {
                          setFilters(prev => ({ ...prev, manufacturer: value === 'clear' ? '' : value }))
                          setCurrentPage(1) // Reset to first page when filter changes
                        }}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="All manufacturers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="clear">Clear Manufacturer</SelectItem>
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
                  {isColumnVisible('name') && <TableHead>Model Name</TableHead>}
                  {isColumnVisible('manufacturer') && <TableHead>Manufacturer</TableHead>}
                  {isColumnVisible('catalogue') && <TableHead>Catalogue Number</TableHead>}
                  {isColumnVisible('category') && <TableHead>Category</TableHead>}
                  {isColumnVisible('warranty') && <TableHead>Warranty Period</TableHead>}
                  {isColumnVisible('serials') && <TableHead>Total Serials</TableHead>}
                  {isColumnVisible('assigned') && <TableHead>Assigned</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
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
                        <div>
                          <div className="font-medium">{model.name}</div>
                          {model.description && (
                            <div className="text-sm text-muted-foreground">
                              {model.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isColumnVisible('manufacturer') && (
                      <TableCell className="font-medium">{model.manufacturer}</TableCell>
                    )}
                    {isColumnVisible('catalogue') && (
                      <TableCell className="text-sm text-muted-foreground">
                        {model.catalogue_number || 'N/A'}
                      </TableCell>
                    )}
                    {isColumnVisible('category') && (
                      <TableCell>
                        <Badge variant="outline">{model.category_name || 'Uncategorized'}</Badge>
                      </TableCell>
                    )}
                    {isColumnVisible('warranty') && (
                      <TableCell>
                        <Badge variant="outline" className="border-orange-300 text-orange-700">
                          {model.warranty_months} months
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
                              {model.unassigned_serials} unassigned
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
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewModel(model.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Model
                          </DropdownMenuItem>
                          {hasPermission('machines:assign') && (
                            <DropdownMenuItem>
                              <Wrench className="mr-2 h-4 w-4" />
                              Assign Machine
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
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
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} machine models
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
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}