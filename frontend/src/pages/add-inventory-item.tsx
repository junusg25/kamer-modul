import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command'
import { ArrowLeft, Save, Loader2, Check, ChevronsUpDown, Plus, Search } from 'lucide-react'
import { apiService } from '../services/api'
import { toast } from 'sonner'
import { cn } from '../lib/utils'

interface InventoryFormData {
  name: string
  description: string
  quantity: string
  unit_price: string
  category: string
  min_stock_level: string
  supplier: string
  sku: string
  location: string
}

interface Category {
  id: number
  name: string
  description?: string
}

interface Supplier {
  id: number
  name: string
  contact_person?: string
  email?: string
  phone?: string
}

const defaultFormData: InventoryFormData = {
  name: '',
  description: '',
  quantity: '0',
  unit_price: '0.00',
  category: '',
  min_stock_level: '5',
  supplier: '',
  sku: '',
  location: ''
}

export default function AddInventoryItem() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<InventoryFormData>(defaultFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<InventoryFormData>>({})
  
  // Dropdown states
  const [categories, setCategories] = useState<string[]>([])
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  
  // Popover states
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false)
  const [categorySearch, setCategorySearch] = useState('')
  const [supplierSearch, setSupplierSearch] = useState('')
  
  // Category creation state
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)

  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    await Promise.all([
      fetchCategories(),
      fetchSuppliers()
    ])
  }

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true)
      const response = await apiService.getInventoryCategories()
      const categoryNames = (response.data || []).map((cat: Category) => cat.name)
      setCategories(categoryNames)
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load categories')
      // Fallback to default categories
      setCategories(['Parts', 'Tools', 'Supplies', 'Equipment', 'Consumables', 'Electronics', 'Mechanical', 'Electrical', 'Hydraulic', 'Pneumatic', 'Safety', 'Cleaning', 'Lubricants', 'Filters', 'Belts', 'Other'])
    } finally {
      setLoadingCategories(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true)
      const response = await apiService.getSuppliers()
      const supplierNames = (response.data || []).map((supplier: Supplier) => supplier.name)
      setSuppliers(supplierNames)
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
      // Fallback to default suppliers
      setSuppliers(['Local Supplier', 'Online Store', 'Manufacturer Direct', 'Distributor', 'Other'])
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const filteredCategories = categories.filter(category =>
    category.toLowerCase().includes(categorySearch.toLowerCase())
  )

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.toLowerCase().includes(supplierSearch.toLowerCase())
  )

  const createNewCategory = async () => {
    const categoryName = categorySearch.trim()
    if (!categoryName) {
      toast.error('Please enter a category name')
      return
    }

    // Check if category already exists
    const existingCategory = categories.find(cat => 
      cat.toLowerCase() === categoryName.toLowerCase()
    )
    
    if (existingCategory) {
      setFormData(prev => ({ ...prev, category: existingCategory }))
      setCategorySearch('')
      setCategoryPopoverOpen(false)
      toast.info(`Category "${existingCategory}" already exists and has been selected`)
      return
    }

    try {
      setIsCreatingCategory(true)
      const response = await apiService.createInventoryCategory({
        name: categoryName,
        description: `Category for ${categoryName}`
      })
      
      const newCategory = response.data
      setCategories(prev => [...prev, newCategory.name])
      setFormData(prev => ({ ...prev, category: newCategory.name }))
      setCategorySearch('')
      setCategoryPopoverOpen(false)
      toast.success(`Category "${newCategory.name}" created successfully`)
    } catch (error: any) {
      console.error('Error creating category:', error)
      toast.error(error.message || 'Failed to create category')
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleInputChange = (field: keyof InventoryFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<InventoryFormData> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    const quantity = parseInt(formData.quantity)
    if (isNaN(quantity) || quantity < 0) {
      newErrors.quantity = 'Quantity must be a valid positive number'
    }

    const unitPrice = parseFloat(formData.unit_price)
    if (isNaN(unitPrice) || unitPrice < 0) {
      newErrors.unit_price = 'Unit price must be a valid positive number'
    }

    const minStockLevel = parseInt(formData.min_stock_level)
    if (formData.min_stock_level && (isNaN(minStockLevel) || minStockLevel < 0)) {
      newErrors.min_stock_level = 'Minimum stock level must be a valid positive number'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting')
      return
    }

    setIsSubmitting(true)
    
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        quantity: parseInt(formData.quantity),
        unit_price: parseFloat(formData.unit_price),
        category: formData.category || null,
        min_stock_level: formData.min_stock_level ? parseInt(formData.min_stock_level) : null,
        supplier: formData.supplier || null,
        sku: formData.sku.trim() || null,
        location: formData.location.trim() || null
      }

      await apiService.createInventoryItem(payload)
      
      toast.success('Inventory item created successfully!')
      navigate('/inventory')
    } catch (error: any) {
      console.error('Error creating inventory item:', error)
      toast.error(error.message || 'Failed to create inventory item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/inventory')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Add Inventory Item</h1>
            <p className="text-muted-foreground">
              Create a new inventory item with all necessary details
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Item Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter item name"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Enter item description"
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input
                    id="sku"
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    placeholder="Enter SKU or part number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryPopoverOpen}
                        className="w-full justify-between h-11"
                      >
                        {formData.category || "Select category..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <div className="border-b p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search or type new category..."
                            className="pl-10"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {categorySearch.trim() && !filteredCategories.some(cat => cat.toLowerCase() === categorySearch.toLowerCase()) && (
                          <div className="p-1 border-b">
                            <div
                              onClick={createNewCategory}
                              className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                {isCreatingCategory ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-green-600" />
                                ) : (
                                  <span className="text-green-600 text-sm font-bold">+</span>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Add "{categorySearch}"</p>
                                <p className="text-xs text-muted-foreground">Create new category</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {filteredCategories.length > 0 && (
                          <div className="p-1">
                            {filteredCategories.map((category) => (
                              <div
                                key={category}
                                onClick={() => {
                                  handleInputChange('category', category)
                                  setCategoryPopoverOpen(false)
                                }}
                                className={cn(
                                  "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                                  formData.category === category && "bg-accent"
                                )}
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    formData.category === category ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <p className="font-medium">{category}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>

            {/* Stock & Pricing */}
            <Card>
              <CardHeader>
                <CardTitle>Stock & Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Initial Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => handleInputChange('quantity', e.target.value)}
                    placeholder="0"
                    className={errors.quantity ? 'border-red-500' : ''}
                  />
                  {errors.quantity && <p className="text-sm text-red-500">{errors.quantity}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="unit_price">Unit Price (KM) *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => handleInputChange('unit_price', e.target.value)}
                    placeholder="0.00"
                    className={errors.unit_price ? 'border-red-500' : ''}
                  />
                  {errors.unit_price && <p className="text-sm text-red-500">{errors.unit_price}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
                  <Input
                    id="min_stock_level"
                    type="number"
                    min="0"
                    value={formData.min_stock_level}
                    onChange={(e) => handleInputChange('min_stock_level', e.target.value)}
                    placeholder="5"
                    className={errors.min_stock_level ? 'border-red-500' : ''}
                  />
                  {errors.min_stock_level && <p className="text-sm text-red-500">{errors.min_stock_level}</p>}
                  <p className="text-xs text-muted-foreground">
                    Alert will be triggered when stock falls below this level
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Supplier & Location */}
            <Card>
              <CardHeader>
                <CardTitle>Supplier & Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={supplierPopoverOpen}
                        className="w-full justify-between h-11"
                      >
                        {formData.supplier || "Select supplier..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <div className="border-b p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search or type new supplier..."
                            className="pl-10"
                            value={supplierSearch}
                            onChange={(e) => setSupplierSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        {supplierSearch.trim() && !filteredSuppliers.some(sup => sup.toLowerCase() === supplierSearch.toLowerCase()) && (
                          <div className="p-1 border-b">
                            <div
                              onClick={() => {
                                handleInputChange('supplier', supplierSearch)
                                setSupplierPopoverOpen(false)
                              }}
                              className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
                                <span className="text-orange-600 text-sm font-bold">+</span>
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Use "{supplierSearch}"</p>
                                <p className="text-xs text-muted-foreground">Add as new supplier</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {filteredSuppliers.length > 0 && (
                          <div className="p-1">
                            {filteredSuppliers.map((supplier) => (
                              <div
                                key={supplier}
                                onClick={() => {
                                  handleInputChange('supplier', supplier)
                                  setSupplierPopoverOpen(false)
                                }}
                                className={cn(
                                  "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                                  formData.supplier === supplier && "bg-accent"
                                )}
                              >
                                <Check
                                  className={cn(
                                    "h-4 w-4",
                                    formData.supplier === supplier ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex-1">
                                  <p className="font-medium">{supplier}</p>
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
                  <Label htmlFor="location">Storage Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="e.g., Warehouse A, Shelf B3"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Item:</span>
                  <span className="text-sm font-medium">{formData.name || 'Not specified'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Quantity:</span>
                  <span className="text-sm font-medium">{formData.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Unit Price:</span>
                  <span className="text-sm font-medium">{formData.unit_price} KM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Value:</span>
                  <span className="text-sm font-medium">
                    {(parseFloat(formData.quantity) * parseFloat(formData.unit_price)).toFixed(2)} KM
                  </span>
                </div>
                {formData.category && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Category:</span>
                    <span className="text-sm font-medium">{formData.category}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Item
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  )
}
