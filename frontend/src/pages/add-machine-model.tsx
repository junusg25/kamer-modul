import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '../components/ui/command'
import { apiService } from '../services/api'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Package,
  Building,
  Hash,
  FileText,
  Shield,
  Save,
  X,
  Check,
  ChevronDown,
  Search,
  Plus
} from 'lucide-react'

interface MachineModelFormData {
  name: string
  catalogue_number?: string
  manufacturer: string
  category_id?: number
  description?: string
  warranty_months: number
}

interface MachineCategory {
  id: number
  name: string
  description?: string
}

interface Supplier {
  id: number
  name: string
  email?: string
  phone?: string
  category?: string
  status: string
}

export default function AddMachineModelPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState<MachineCategory[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState(false)
  
  // Popover states
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [manufacturerPopoverOpen, setManufacturerPopoverOpen] = useState(false)
  
  // Search states
  const [categorySearch, setCategorySearch] = useState('')
  const [manufacturerSearch, setManufacturerSearch] = useState('')
  
  // Dynamic manufacturer options (combine suppliers with manual entries)
  const [manufacturerOptions, setManufacturerOptions] = useState<string[]>([])
  const [formData, setFormData] = useState<MachineModelFormData>({
    name: '',
    catalogue_number: '',
    manufacturer: '',
    category_id: undefined,
    description: '',
    warranty_months: 12
  })

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
      const response = await apiService.getMachineCategories()
      setCategories(response.data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load machine categories')
    } finally {
      setLoadingCategories(false)
    }
  }

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true)
      const [suppliersResponse, modelsResponse] = await Promise.all([
        apiService.getSuppliers({ limit: 100 }),
        apiService.getMachineModels({ limit: 100 })
      ])
      
      const suppliersData = suppliersResponse.data || []
      setSuppliers(suppliersData)
      
      // Extract manufacturer names from suppliers
      const supplierNames = suppliersData.map((supplier: Supplier) => supplier.name)
      
      // Extract manufacturer names from existing machine models
      const modelsData = (modelsResponse as any).data || []
      const modelManufacturers = modelsData
        .map((m: any) => m.manufacturer)
        .filter((m: string) => m && m.trim())
      
      // Combine and deduplicate manufacturers from both sources
      const allManufacturers = [...new Set([...supplierNames, ...modelManufacturers])]
      setManufacturerOptions(allManufacturers.sort())
    } catch (error) {
      console.error('Error fetching suppliers:', error)
      toast.error('Failed to load suppliers')
      // Fallback to empty array
      setManufacturerOptions([])
    } finally {
      setLoadingSuppliers(false)
    }
  }

  const handleInputChange = (field: keyof MachineModelFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // Filtered options for dropdowns
  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  )

  const filteredManufacturerOptions = manufacturerOptions.filter(option =>
    option.toLowerCase().includes(manufacturerSearch.toLowerCase())
  )

  const createNewCategory = async (categoryName: string) => {
    try {
      setIsCreatingCategory(true)
      
      // Trim whitespace and normalize the name
      const trimmedName = categoryName.trim()
      
      // More thorough check for existing categories
      const existingCategory = categories.find(cat => {
        const existingName = cat.name.toLowerCase().trim()
        const newName = trimmedName.toLowerCase().trim()
        
        // Check for exact match
        if (existingName === newName) return true
        
        // Check for similar names (in case of typos or variations)
        if (existingName.includes(newName) || newName.includes(existingName)) {
          return true
        }
        
        return false
      })
      
      if (existingCategory) {
        // If category exists, just select it instead of creating a new one
        handleInputChange('category_id', existingCategory.id)
        setCategoryPopoverOpen(false)
        setCategorySearch('')
        toast.info(`Category "${trimmedName}" is similar to existing "${existingCategory.name}" and has been selected`)
        return
      }
      
      const response = await apiService.createMachineCategory({ 
        name: trimmedName
      })
      
      const newCategory = response.data
      
      // Add the new category to the local state
      setCategories(prev => [...prev, newCategory])
      
      // Select the new category
      handleInputChange('category_id', newCategory.id)
      setCategoryPopoverOpen(false)
      setCategorySearch('')
      
      toast.success(`Category "${trimmedName}" created successfully`)
    } catch (error) {
      console.error('Error creating category:', error)
      console.error('Full error object:', error)
      
      if (error.message && error.message.includes('already exists')) {
        // Try to find the similar category and suggest it
        const similarCategory = categories.find(cat => {
          const existingName = cat.name.toLowerCase().trim()
          const newName = categoryName.trim().toLowerCase()
          return existingName.includes(newName) || newName.includes(existingName)
        })
        
        if (similarCategory) {
          toast.error(`Category "${categoryName.trim()}" is too similar to existing "${similarCategory.name}". Please select the existing category or use a different name.`)
        } else {
          toast.error(`Category "${categoryName.trim()}" already exists. Please select it from the list.`)
        }
      } else {
        toast.error('Failed to create category. Please try again.')
      }
    } finally {
      setIsCreatingCategory(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('Machine model name is required')
      return
    }
    
    if (!formData.manufacturer.trim()) {
      toast.error('Manufacturer is required')
      return
    }

    try {
      setIsSubmitting(true)
      await apiService.createMachineModel(formData)
      toast.success('Machine model created successfully')
      navigate('/machines')
    } catch (error) {
      console.error('Error creating machine model:', error)
      toast.error('Failed to create machine model. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/machines')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-10 w-10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Add New Machine Model</h1>
              <p className="text-muted-foreground">
                Create a new machine model with specifications and warranty information
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button 
              type="submit" 
              form="machine-model-form"
              disabled={isSubmitting}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? 'Creating...' : 'Create Machine Model'}
            </Button>
          </div>
        </div>

        {/* Form */}
        <form id="machine-model-form" onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Basic Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Machine Model Name *</Label>
                  <div className="relative">
                    <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter machine model name"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="catalogue_number">Catalogue Number</Label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="catalogue_number"
                      value={formData.catalogue_number || ''}
                      onChange={(e) => handleInputChange('catalogue_number', e.target.value)}
                      placeholder="Enter catalogue number"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer *</Label>
                  <Popover open={manufacturerPopoverOpen} onOpenChange={setManufacturerPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={manufacturerPopoverOpen}
                        className="w-full justify-between h-10"
                      >
                        {formData.manufacturer || "Select manufacturer..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <div className="border-b p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search or type new manufacturer..."
                            className="pl-10"
                            value={manufacturerSearch}
                            onChange={(e) => setManufacturerSearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {/* Manual entry option */}
                        {manufacturerSearch && !filteredManufacturerOptions.includes(manufacturerSearch) && (
                          <div className="p-1 border-b">
                            <div
                              onClick={() => {
                                handleInputChange('manufacturer', manufacturerSearch)
                                setManufacturerPopoverOpen(false)
                              }}
                              className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                <span className="text-green-600 text-sm font-bold">+</span>
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Add "{manufacturerSearch}"</p>
                                <p className="text-sm text-muted-foreground">Create new manufacturer</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Existing options */}
                        {filteredManufacturerOptions.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">No manufacturers found.</div>
                        ) : (
                          <div className="p-1">
                            {filteredManufacturerOptions.map((option) => (
                              <div
                                key={option}
                                onClick={() => {
                                  handleInputChange('manufacturer', option)
                                  setManufacturerPopoverOpen(false)
                                }}
                                className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
                                  <Building className="h-4 w-4 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{option}</p>
                                  <p className="text-sm text-muted-foreground">Select manufacturer</p>
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

            {/* Category and Warranty Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Category & Warranty</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category_id">Category</Label>
                  <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryPopoverOpen}
                        className="w-full justify-between h-10"
                      >
                        {formData.category_id 
                          ? categories.find(cat => cat.id === formData.category_id)?.name 
                          : "Select category..."}
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <div className="border-b p-3">
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search categories or type new..."
                            className="pl-10"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {/* No category option */}
                        <div className="p-1 border-b">
                          <div
                            onClick={() => {
                              handleInputChange('category_id', undefined)
                              setCategoryPopoverOpen(false)
                            }}
                            className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100">
                              <span className="text-gray-600 text-sm font-bold">-</span>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">No category</p>
                              <p className="text-sm text-muted-foreground">Leave category empty</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Manual entry option */}
                        {categorySearch && !filteredCategories.some(cat => {
                          const existingName = cat.name.toLowerCase().trim()
                          const newName = categorySearch.trim().toLowerCase()
                          return existingName === newName || existingName.includes(newName) || newName.includes(existingName)
                        }) && (
                          <div className="p-1 border-b">
                            <div
                              onClick={() => {
                                createNewCategory(categorySearch)
                              }}
                              className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                                {isCreatingCategory ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-green-600 border-t-transparent"></div>
                                ) : (
                                  <span className="text-green-600 text-sm font-bold">+</span>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">Create "{categorySearch}"</p>
                                <p className="text-sm text-muted-foreground">
                                  {isCreatingCategory ? 'Creating category...' : 'Add new category'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Existing options */}
                        {filteredCategories.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">No categories found.</div>
                        ) : (
                          <div className="p-1">
                            {filteredCategories.map((category) => (
                              <div
                                key={category.id}
                                onClick={() => {
                                  handleInputChange('category_id', category.id)
                                  setCategoryPopoverOpen(false)
                                }}
                                className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                              >
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100">
                                  <Package className="h-4 w-4 text-orange-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{category.name}</p>
                                  <p className="text-sm text-muted-foreground">Select category</p>
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
                  <Label htmlFor="warranty_months">Warranty Period (Months)</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="warranty_months"
                      type="number"
                      min="0"
                      max="120"
                      value={formData.warranty_months}
                      onChange={(e) => handleInputChange('warranty_months', parseInt(e.target.value) || 0)}
                      placeholder="Enter warranty period in months"
                      className="pl-10"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Description</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="description">Machine Model Description</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Enter detailed description of the machine model, specifications, features, etc."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </MainLayout>
  )
}
