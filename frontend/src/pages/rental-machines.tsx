import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MainLayout } from '../components/layout/main-layout'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Plus, Search, Filter, Eye, Edit, Trash2, Truck, Calendar } from 'lucide-react'
import apiService from '../services/api'
import { formatDate, formatDateTime } from '../lib/dateTime'
import { useAuth } from '../contexts/auth-context'

interface RentalMachine {
  id: string
  serial_number: string
  rental_status: 'available' | 'rented' | 'maintenance' | 'retired'
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  location?: string
  notes?: string
  model_name: string
  manufacturer: string
  catalogue_number?: string
  category_name?: string
  created_by_name?: string
  rental_count: number
  created_at: string
  updated_at: string
}

interface MachineModel {
  id: string
  name: string
  manufacturer: string
  catalogue_number?: string
}

export default function RentalMachines() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [machines, setMachines] = useState<RentalMachine[]>([])
  const [models, setModels] = useState<MachineModel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: 'all',
    condition: 'all',
    model_id: 'all',
    manufacturer: 'all'
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState<RentalMachine | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [machineToDelete, setMachineToDelete] = useState<RentalMachine | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    model_id: '',
    serial_number: '',
    rental_status: 'available' as const,
    condition: 'good' as const,
    location: '',
    notes: ''
  })

  useEffect(() => {
    fetchRentalMachines()
    fetchMachineModels()
  }, [pagination.page, searchTerm, filters])

  // Reset form when create dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      resetForm()
    }
  }, [isCreateDialogOpen])

  const fetchRentalMachines = async () => {
    try {
      setLoading(true)
      const response = await apiService.getRentalMachines({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        ...filters
      })
      setMachines(response.machines || [])
      setPagination(response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('Error fetching rental machines:', error)
      setMachines([])
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 })
    } finally {
      setLoading(false)
    }
  }

  const fetchMachineModels = async () => {
    try {
      const response = await apiService.getMachineModels()
      // Ensure we always have an array
      if (Array.isArray(response)) {
        setModels(response)
      } else if (response && Array.isArray(response.models)) {
        setModels(response.models)
      } else if (response && Array.isArray(response.data)) {
        setModels(response.data)
      } else {
        console.warn('Unexpected response format for machine models:', response)
        setModels([])
      }
    } catch (error) {
      console.error('Error fetching machine models:', error)
      setModels([])
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchRentalMachines()
  }

  const handleFilterChange = (filterType: string, value: string) => {
    // Convert "all" to empty string for API filtering
    const filterValue = value === 'all' ? '' : value
    setFilters(prev => ({ ...prev, [filterType]: filterValue }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleClearFilters = () => {
    setFilters({
      status: 'all',
      condition: 'all',
      model_id: 'all',
      manufacturer: 'all'
    })
    setSearchTerm('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleCreateMachine = async () => {
    try {
      await apiService.createRentalMachine(formData)
      setIsCreateDialogOpen(false)
      resetForm()
      fetchRentalMachines()
    } catch (error) {
      console.error('Error creating rental machine:', error)
    }
  }

  const handleEditMachine = async () => {
    if (!editingMachine) return
    
    try {
      await apiService.updateRentalMachine(editingMachine.id, formData)
      setIsEditDialogOpen(false)
      setEditingMachine(null)
      resetForm()
      fetchRentalMachines()
    } catch (error) {
      console.error('Error updating rental machine:', error)
    }
  }

  const handleDeleteMachine = async () => {
    if (!machineToDelete) return
    
    try {
      await apiService.deleteRentalMachine(machineToDelete.id)
      setDeleteDialogOpen(false)
      setMachineToDelete(null)
      fetchRentalMachines()
    } catch (error) {
      console.error('Error deleting rental machine:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      model_id: '',
      serial_number: '',
      rental_status: 'available',
      condition: 'good',
      location: '',
      notes: ''
    })
  }

  const openEditDialog = (machine: RentalMachine) => {
    setEditingMachine(machine)
    setFormData({
      model_id: machine.id, // This should be model_id, but we need to get it from the machine data
      serial_number: machine.serial_number,
      rental_status: machine.rental_status,
      condition: machine.condition,
      location: machine.location || '',
      notes: machine.notes || ''
    })
    setIsEditDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { variant: 'default' as const, label: 'Available' },
      rented: { variant: 'secondary' as const, label: 'Rented' },
      reserved: { variant: 'secondary' as const, label: 'Reserved' },
      cleaning: { variant: 'outline' as const, label: 'Cleaning' },
      inspection: { variant: 'outline' as const, label: 'Inspection' },
      maintenance: { variant: 'destructive' as const, label: 'Maintenance' },
      repair: { variant: 'destructive' as const, label: 'Repair' },
      quarantine: { variant: 'destructive' as const, label: 'Quarantine' },
      retired: { variant: 'outline' as const, label: 'Retired' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getConditionBadge = (condition: string) => {
    const conditionConfig = {
      excellent: { variant: 'default' as const, label: 'Excellent' },
      good: { variant: 'secondary' as const, label: 'Good' },
      fair: { variant: 'outline' as const, label: 'Fair' },
      poor: { variant: 'destructive' as const, label: 'Poor' }
    }
    const config = conditionConfig[condition as keyof typeof conditionConfig] || conditionConfig.good
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getUniqueManufacturers = () => {
    if (!Array.isArray(models)) return []
    return [...new Set(models.map(model => model.manufacturer))].sort()
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '').length
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rental Fleet</h1>
            <p className="text-muted-foreground">
              Manage your rental machine fleet
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Machine
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Rental Machine</DialogTitle>
                <DialogDescription>
                  Add a new machine to your rental fleet.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="model_id">Machine Model</Label>
                  <Select value={formData.model_id} onValueChange={(value) => setFormData(prev => ({ ...prev, model_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(models) && models.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.manufacturer} - {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    placeholder="Enter serial number"
                  />
                </div>
                <div>
                  <Label htmlFor="condition">Condition</Label>
                  <Select value={formData.condition} onValueChange={(value: any) => setFormData(prev => ({ ...prev, condition: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Enter location"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Enter notes"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateMachine}>
                    Add Machine
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
              {getActiveFiltersCount() > 0 && (
                <Badge variant="secondary">{getActiveFiltersCount()}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label>Search</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search machines..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} size="sm">
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="rented">Rented</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="quarantine">Quarantine</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Condition</Label>
                <Select value={filters.condition} onValueChange={(value) => handleFilterChange('condition', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All conditions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All conditions</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Manufacturer</Label>
                <Select value={filters.manufacturer} onValueChange={(value) => handleFilterChange('manufacturer', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All manufacturers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All manufacturers</SelectItem>
                    {getUniqueManufacturers().map((manufacturer) => (
                      <SelectItem key={manufacturer} value={manufacturer}>
                        {manufacturer}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={handleClearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Machines Table */}
        <Card>
          <CardHeader>
            <CardTitle>Rental Machines ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Manufacturer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Rental Count</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {machines.map((machine) => (
                    <TableRow 
                      key={machine.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/rental-machines/${machine.id}`)}
                    >
                      <TableCell className="font-medium">{machine.serial_number}</TableCell>
                      <TableCell>{machine.model_name}</TableCell>
                      <TableCell>{machine.manufacturer}</TableCell>
                      <TableCell>{getStatusBadge(machine.rental_status)}</TableCell>
                      <TableCell>{getConditionBadge(machine.condition)}</TableCell>
                      <TableCell>{machine.location || '-'}</TableCell>
                      <TableCell>{machine.rental_count}</TableCell>
                      <TableCell>{formatDateTime(machine.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/rental-machines/${machine.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {user?.role !== 'sales' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(machine)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setMachineToDelete(machine)
                                  setDeleteDialogOpen(true)
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Rental Machine</DialogTitle>
              <DialogDescription>
                Update the details of this rental machine.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_serial_number">Serial Number</Label>
                <Input
                  id="edit_serial_number"
                  value={formData.serial_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit_rental_status">Status</Label>
                <Select value={formData.rental_status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, rental_status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="rented">Rented</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="cleaning">Cleaning</SelectItem>
                    <SelectItem value="inspection">Inspection</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="repair">Repair</SelectItem>
                    <SelectItem value="quarantine">Quarantine</SelectItem>
                    <SelectItem value="retired">Retired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_condition">Condition</Label>
                <Select value={formData.condition} onValueChange={(value: any) => setFormData(prev => ({ ...prev, condition: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_location">Location</Label>
                <Input
                  id="edit_location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea
                  id="edit_notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditMachine}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Rental Machine</DialogTitle>
              <DialogDescription>
                This action cannot be undone. The machine will be permanently removed from your rental fleet.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete this rental machine? This action cannot be undone.
              </p>
              {machineToDelete && (
                <div className="bg-muted p-4 rounded-lg">
                  <p><strong>Serial Number:</strong> {machineToDelete.serial_number}</p>
                  <p><strong>Model:</strong> {machineToDelete.model_name}</p>
                  <p><strong>Manufacturer:</strong> {machineToDelete.manufacturer}</p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteMachine}>
                  Delete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
