import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/auth-context'
import { apiService } from '../services/api'
import { formatDate, formatDateTime } from '../lib/dateTime'
import { formatCurrency } from '../lib/currency'
import { MainLayout } from '../components/layout/main-layout'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { ArrowLeft, Edit, Trash2, Calendar, User, MapPin, Wrench, DollarSign, Clock, AlertTriangle, History, Package } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'

interface RentalMachineDetail {
  id: string
  serial_number: string
  rental_status: 'available' | 'rented' | 'maintenance' | 'retired'
  condition: 'excellent' | 'good' | 'fair' | 'poor'
  location?: string
  notes?: string
  model_id: string
  model_name: string
  manufacturer: string
  catalogue_number?: string
  model_description?: string
  warranty_months?: number
  category_name?: string
  created_by?: string
  created_by_name?: string
  rental_count: number
  created_at: string
  updated_at: string
}

interface RentalHistory {
  id: string
  rental_machine_id: string
  customer_id: string
  rental_start_date: string
  rental_end_date?: string
  planned_return_date?: string
  actual_return_date?: string
  rental_status: 'active' | 'reserved' | 'returned' | 'overdue' | 'cancelled'
  price_per_day?: number
  price_per_week?: number
  price_per_month?: number
  billing_period: 'daily' | 'weekly' | 'monthly'
  total_amount?: number
  maintenance_reminder_date?: string
  rental_notes?: string
  created_at: string
  updated_at: string
  customer_name: string
  customer_company?: string
}

interface FormData {
  serial_number: string
  rental_status: string
  condition: string
  location: string
  notes: string
}

export default function RentalMachineDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [machine, setMachine] = useState<RentalMachineDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    serial_number: '',
    rental_status: 'available',
    condition: 'good',
    location: '',
    notes: ''
  })

  useEffect(() => {
    if (id) {
      fetchMachineDetails()
    }
  }, [id])

  const fetchMachineDetails = async () => {
    try {
      setLoading(true)
      const response = await apiService.getRentalMachine(id!)
      setMachine(response)
    } catch (err: any) {
      console.error('Error fetching rental machine details:', err)
      setError(err.message || 'Failed to fetch machine details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      available: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Available' },
      rented: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Rented' },
      maintenance: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Maintenance' },
      retired: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Retired' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.available

    return (
      <Badge variant="outline" className={`${config.color} border`}>
        {config.label}
      </Badge>
    )
  }

  const getConditionBadge = (condition: string) => {
    const conditionConfig = {
      excellent: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Excellent' },
      good: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Good' },
      fair: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Fair' },
      poor: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Poor' }
    }

    const config = conditionConfig[condition as keyof typeof conditionConfig] || conditionConfig.good

    return (
      <Badge variant="outline" className={`${config.color} border`}>
        {config.label}
      </Badge>
    )
  }

  const getRentalStatusBadge = (status: string) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Active' },
      reserved: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Reserved' },
      returned: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Returned' },
      overdue: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Overdue' },
      cancelled: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Cancelled' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active

    return (
      <Badge variant="outline" className={`${config.color} border`}>
        {config.label}
      </Badge>
    )
  }

  const calculateTotalRevenue = () => {
    if (!machine?.rental_history) return 0
    return machine.rental_history.reduce((total, rental) => total + (rental.total_amount || 0), 0)
  }

  const getCurrentRental = () => {
    if (!machine?.rental_history) return null
    return machine.rental_history.find(rental => rental.rental_status === 'active' || rental.rental_status === 'reserved')
  }

  const handleEditMachine = async () => {
    if (!machine) return
    
    try {
      await apiService.updateRentalMachine(machine.id, formData)
      setIsEditDialogOpen(false)
      fetchMachineDetails() // Refresh the data
    } catch (error) {
      console.error('Error updating rental machine:', error)
    }
  }

  const handleDeleteMachine = async () => {
    if (!machine) return
    
    try {
      await apiService.deleteRentalMachine(machine.id)
      setDeleteDialogOpen(false)
      navigate('/rental-machines') // Navigate back to the list
    } catch (error) {
      console.error('Error deleting rental machine:', error)
    }
  }

  const openEditDialog = () => {
    if (!machine) return
    
    setFormData({
      serial_number: machine.serial_number,
      rental_status: machine.rental_status,
      condition: machine.condition,
      location: machine.location || '',
      notes: machine.notes || ''
    })
    setIsEditDialogOpen(true)
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-8 bg-muted rounded w-48"></div>
            <div className="h-10 bg-muted rounded w-32"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (error || !machine) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
            <p className="text-muted-foreground mb-4">{error || 'Rental machine not found'}</p>
            <Button onClick={() => navigate('/rental-machines')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Rental Fleet
            </Button>
          </div>
        </div>
      </MainLayout>
    )
  }

  const currentRental = getCurrentRental()
  const totalRevenue = calculateTotalRevenue()

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="outline" onClick={() => navigate('/rental-machines')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Fleet
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Rental Machine Details</h1>
              <p className="text-muted-foreground">Serial: {machine.serial_number}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge(machine.rental_status)}
            {user?.role !== 'sales' && (
              <>
                <Button variant="outline" onClick={openEditDialog}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" onClick={() => setDeleteDialogOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Machine Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="mr-2 h-5 w-5" />
                  Machine Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Serial Number</label>
                    <p className="text-lg font-medium">{machine.serial_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Model</label>
                    <p className="text-lg font-medium">{machine.manufacturer} {machine.model_name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Condition</label>
                    <div className="mt-1">{getConditionBadge(machine.condition)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Location</label>
                    <p className="text-lg">{machine.location || 'Not specified'}</p>
                  </div>
                  {machine.catalogue_number && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Catalogue Number</label>
                      <p className="text-lg">{machine.catalogue_number}</p>
                    </div>
                  )}
                  {machine.warranty_months && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Warranty</label>
                      <p className="text-lg">{machine.warranty_months} months</p>
                    </div>
                  )}
                </div>
                
                {machine.model_description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Description</label>
                    <p className="text-sm bg-muted p-3 rounded-md">{machine.model_description}</p>
                  </div>
                )}
                
                {machine.notes && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Notes</label>
                    <p className="text-sm bg-muted p-3 rounded-md">{machine.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Rental */}
            {currentRental && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="mr-2 h-5 w-5" />
                    Current Rental
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Customer</label>
                      <p className="text-lg font-medium">{currentRental.customer_name}</p>
                      {currentRental.customer_company && (
                        <p className="text-sm text-muted-foreground">{currentRental.customer_company}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div className="mt-1">{getRentalStatusBadge(currentRental.rental_status)}</div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Start Date</label>
                      <p className="text-lg">{formatDate(currentRental.rental_start_date)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">End Date</label>
                      <p className="text-lg">{currentRental.rental_end_date ? formatDate(currentRental.rental_end_date) : 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Billing Period</label>
                      <p className="text-lg capitalize">{currentRental.billing_period}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Total Amount</label>
                      <p className="text-lg font-medium">{currentRental.total_amount ? formatCurrency(currentRental.total_amount) : 'Not specified'}</p>
                    </div>
                  </div>
                  
                  {currentRental.rental_notes && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Rental Notes</label>
                      <p className="text-sm bg-muted p-3 rounded-md">{currentRental.rental_notes}</p>
                    </div>
                  )}
                  
                  <div className="flex justify-end">
                    <Button 
                      variant="outline" 
                      onClick={() => navigate(`/machine-rentals/${currentRental.id}`)}
                    >
                      View Rental Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rental History */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="mr-2 h-5 w-5" />
                  Rental History ({machine.rental_history?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {machine.rental_history && machine.rental_history.length > 0 ? (
                  <div className="space-y-4">
                    {machine.rental_history.map((rental) => (
                      <div key={rental.id} className="border rounded-lg p-4 hover:bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getRentalStatusBadge(rental.rental_status)}
                            <span className="font-medium">{rental.customer_name}</span>
                            {rental.customer_company && (
                              <span className="text-sm text-muted-foreground">({rental.customer_company})</span>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => navigate(`/machine-rentals/${rental.id}`)}
                          >
                            View Details
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <label className="text-muted-foreground">Start Date</label>
                            <p>{formatDate(rental.rental_start_date)}</p>
                          </div>
                          <div>
                            <label className="text-muted-foreground">End Date</label>
                            <p>{rental.rental_end_date ? formatDate(rental.rental_end_date) : '-'}</p>
                          </div>
                          <div>
                            <label className="text-muted-foreground">Billing</label>
                            <p className="capitalize">{rental.billing_period}</p>
                          </div>
                          <div>
                            <label className="text-muted-foreground">Amount</label>
                            <p className="font-medium">{rental.total_amount ? formatCurrency(rental.total_amount) : '-'}</p>
                          </div>
                        </div>
                        {rental.rental_notes && (
                          <div className="mt-2">
                            <label className="text-xs text-muted-foreground">Notes</label>
                            <p className="text-xs bg-muted p-2 rounded mt-1">{rental.rental_notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No rental history found for this machine.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Rentals</label>
                  <p className="text-2xl font-bold">{machine.rental_count}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Total Revenue</label>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Average Revenue</label>
                  <p className="text-lg">
                    {machine.rental_count > 0 ? formatCurrency(totalRevenue / machine.rental_count) : formatCurrency(0)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Category</label>
                  <p className="text-lg">{machine.category_name || 'Not specified'}</p>
                </div>
              </CardContent>
            </Card>

            {/* System Information */}
            <Card>
              <CardHeader>
                <CardTitle>System Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">{formatDateTime(machine.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
                  <p className="text-sm">{formatDateTime(machine.updated_at)}</p>
                </div>
                {machine.created_by_name && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Created By</label>
                    <p className="text-sm">{machine.created_by_name}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

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
              {machine && (
                <div className="bg-muted p-4 rounded-lg">
                  <p><strong>Serial Number:</strong> {machine.serial_number}</p>
                  <p><strong>Model:</strong> {machine.manufacturer} {machine.model_name}</p>
                  <p><strong>Status:</strong> {machine.rental_status}</p>
                  <p><strong>Condition:</strong> {machine.condition}</p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteMachine}>
                  Delete Machine
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
