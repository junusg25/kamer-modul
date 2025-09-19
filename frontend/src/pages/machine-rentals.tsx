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
import { DatePickerInput } from '../components/ui/date-picker'
import { Plus, Search, Filter, Eye, Edit, Trash2, Calendar, Truck, Calculator } from 'lucide-react'
import apiService from '../services/api'
import { formatDate, formatDateTime, parseEuropeanDate, formatDateForInput } from '../lib/dateTime'
import { formatCurrency } from '../lib/currency'
import { useAuth } from '../contexts/auth-context'

interface MachineRental {
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
  created_by_name?: string
  customer_name: string
  customer_company?: string
  customer_email?: string
  customer_phone?: string
  machine_serial: string
  machine_condition: string
  machine_model_name: string
  machine_manufacturer: string
  created_at: string
  updated_at: string
}

interface Customer {
  id: string
  name: string
  company_name?: string
}

interface RentalMachine {
  id: string
  serial_number: string
  model_name: string
  manufacturer: string
  rental_status: string
  rental_end_date?: string
  planned_return_date?: string
  current_rental_status?: string
  current_customer_name?: string
}

export default function MachineRentals() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rentals, setRentals] = useState<MachineRental[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [availableMachines, setAvailableMachines] = useState<RentalMachine[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: 'all',
    customer_id: 'all',
    rental_machine_id: 'all',
    start_date: '',
    end_date: ''
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
  const [editingRental, setEditingRental] = useState<MachineRental | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [rentalToDelete, setRentalToDelete] = useState<MachineRental | null>(null)
  const [isCalculatingPricing, setIsCalculatingPricing] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    rental_machine_id: '',
    customer_id: '',
    rental_start_date: '',
    rental_end_date: '',
    planned_return_date: '',
    rental_status: 'active' as const,
    price_per_day: '',
    price_per_week: '',
    price_per_month: '',
    billing_period: 'monthly' as const,
    total_amount: '',
    maintenance_reminder_date: '',
    rental_notes: ''
  })

  useEffect(() => {
    fetchMachineRentals()
    fetchCustomers()
    fetchAvailableMachines()
  }, [pagination.page, searchTerm, filters])

  // Reset form when create dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      resetForm()
    }
  }, [isCreateDialogOpen])

  const fetchMachineRentals = async () => {
    try {
      setLoading(true)
      const response = await apiService.getMachineRentals({
        page: pagination.page,
        limit: pagination.limit,
        search: searchTerm,
        ...filters
      })
      setRentals(response.rentals || [])
      setPagination(response.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 })
    } catch (error) {
      console.error('Error fetching machine rentals:', error)
      setRentals([])
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 })
    } finally {
      setLoading(false)
    }
  }

  const fetchCustomers = async () => {
    try {
      const response = await apiService.getCustomers()
      // Handle different response formats
      if (Array.isArray(response)) {
        setCustomers(response)
      } else if (response && Array.isArray(response.customers)) {
        setCustomers(response.customers)
      } else if (response && Array.isArray(response.data)) {
        setCustomers(response.data)
      } else {
        setCustomers([])
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
      setCustomers([])
    }
  }

  const fetchAvailableMachines = async () => {
    try {
      const response = await apiService.getAvailableRentalMachines()
      // Handle different response formats
      if (Array.isArray(response)) {
        setAvailableMachines(response)
      } else if (response && Array.isArray(response.data)) {
        setAvailableMachines(response.data)
      } else {
        setAvailableMachines([])
      }
    } catch (error) {
      console.error('Error fetching available machines:', error)
      setAvailableMachines([])
    }
  }

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    fetchMachineRentals()
  }

  const handleFilterChange = (filterType: string, value: string) => {
    // Convert "all" to empty string for API filtering
    let filterValue = value === 'all' ? '' : value
    
    // Convert European date format (dd.mm.yyyy) to ISO format (yyyy-mm-dd) for API
    if ((filterType === 'start_date' || filterType === 'end_date') && filterValue && filterValue.includes('.')) {
      const date = parseEuropeanDate(filterValue)
      if (date) {
        filterValue = formatDateForInput(date)
      }
    }
    
    setFilters(prev => ({ ...prev, [filterType]: filterValue }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const handleClearFilters = () => {
    setFilters({
      status: 'all',
      customer_id: 'all',
      rental_machine_id: 'all',
      start_date: '',
      end_date: ''
    })
    setSearchTerm('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const convertFormDataForAPI = (data: any) => {
    const converted = { ...data }
    
    // Convert European date format to ISO format for API
    if (converted.rental_start_date && converted.rental_start_date.includes('.')) {
      const date = parseEuropeanDate(converted.rental_start_date)
      if (date) converted.rental_start_date = formatDateForInput(date)
    }
    if (converted.rental_end_date && converted.rental_end_date.includes('.')) {
      const date = parseEuropeanDate(converted.rental_end_date)
      if (date) converted.rental_end_date = formatDateForInput(date)
    }
    if (converted.planned_return_date && converted.planned_return_date.includes('.')) {
      const date = parseEuropeanDate(converted.planned_return_date)
      if (date) converted.planned_return_date = formatDateForInput(date)
    }
    if (converted.maintenance_reminder_date && converted.maintenance_reminder_date.includes('.')) {
      const date = parseEuropeanDate(converted.maintenance_reminder_date)
      if (date) converted.maintenance_reminder_date = formatDateForInput(date)
    }
    
    // Convert empty strings to null for optional fields
    if (converted.rental_end_date === '') converted.rental_end_date = null
    if (converted.planned_return_date === '') converted.planned_return_date = null
    if (converted.maintenance_reminder_date === '') converted.maintenance_reminder_date = null
    if (converted.rental_notes === '') converted.rental_notes = null
    
    return converted
  }

  const handleCreateRental = async () => {
    try {
      const rentalData = convertFormDataForAPI({
        ...formData,
        price_per_day: formData.price_per_day ? parseFloat(formData.price_per_day) : undefined,
        price_per_week: formData.price_per_week ? parseFloat(formData.price_per_week) : undefined,
        price_per_month: formData.price_per_month ? parseFloat(formData.price_per_month) : undefined,
        total_amount: formData.total_amount ? parseFloat(formData.total_amount) : undefined
      })
      await apiService.createMachineRental(rentalData)
      setIsCreateDialogOpen(false)
      resetForm()
      fetchMachineRentals()
      fetchAvailableMachines() // Refresh available machines
    } catch (error) {
      console.error('Error creating machine rental:', error)
    }
  }

  const handleEditRental = async () => {
    if (!editingRental) return
    
    try {
      const rentalData = convertFormDataForAPI({
        ...formData,
        price_per_day: formData.price_per_day ? parseFloat(formData.price_per_day) : undefined,
        price_per_week: formData.price_per_week ? parseFloat(formData.price_per_week) : undefined,
        price_per_month: formData.price_per_month ? parseFloat(formData.price_per_month) : undefined,
        total_amount: formData.total_amount ? parseFloat(formData.total_amount) : undefined
      })
      await apiService.updateMachineRental(editingRental.id, rentalData)
      setIsEditDialogOpen(false)
      setEditingRental(null)
      resetForm()
      fetchMachineRentals()
      fetchAvailableMachines() // Refresh available machines
    } catch (error) {
      console.error('Error updating machine rental:', error)
    }
  }

  const handleDeleteRental = async () => {
    if (!rentalToDelete) return
    
    try {
      await apiService.deleteMachineRental(rentalToDelete.id)
      setDeleteDialogOpen(false)
      setRentalToDelete(null)
      fetchMachineRentals()
      fetchAvailableMachines() // Refresh available machines
    } catch (error) {
      console.error('Error deleting machine rental:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      rental_machine_id: '',
      customer_id: '',
      rental_start_date: '',
      rental_end_date: '',
      planned_return_date: '',
      rental_status: 'active',
      price_per_day: '',
      price_per_week: '',
      price_per_month: '',
      billing_period: 'monthly',
      total_amount: '',
      maintenance_reminder_date: '',
      rental_notes: ''
    })
  }

  const openEditDialog = (rental: MachineRental) => {
    setEditingRental(rental)
    setFormData({
      rental_machine_id: rental.rental_machine_id,
      customer_id: rental.customer_id,
      rental_start_date: rental.rental_start_date ? formatDate(rental.rental_start_date) : '',
      rental_end_date: rental.rental_end_date ? formatDate(rental.rental_end_date) : '',
      planned_return_date: rental.planned_return_date ? formatDate(rental.planned_return_date) : '',
      rental_status: rental.rental_status,
      price_per_day: rental.price_per_day?.toString() || '',
      price_per_week: rental.price_per_week?.toString() || '',
      price_per_month: rental.price_per_month?.toString() || '',
      billing_period: rental.billing_period,
      total_amount: rental.total_amount?.toString() || '',
      maintenance_reminder_date: rental.maintenance_reminder_date ? formatDate(rental.maintenance_reminder_date) : '',
      rental_notes: rental.rental_notes || ''
    })
    setIsEditDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default' as const, label: 'Active' },
      reserved: { variant: 'secondary' as const, label: 'Reserved' },
      returned: { variant: 'secondary' as const, label: 'Returned' },
      overdue: { variant: 'destructive' as const, label: 'Overdue' },
      cancelled: { variant: 'outline' as const, label: 'Cancelled' }
    }
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getActiveFiltersCount = () => {
    return Object.values(filters).filter(value => value !== '').length
  }

  const calculateDynamicPricing = async () => {
    if (!formData.rental_machine_id || !formData.customer_id || !formData.rental_start_date) {
      setError('Please select machine, customer, and start date first')
      return
    }

    setIsCalculatingPricing(true)
    try {
      // Convert European date to ISO format for API
      const startDate = formData.rental_start_date.includes('.') 
        ? formatDateForInput(parseEuropeanDate(formData.rental_start_date)!)
        : formData.rental_start_date
      
      const endDate = formData.rental_end_date && formData.rental_end_date.includes('.')
        ? formatDateForInput(parseEuropeanDate(formData.rental_end_date)!)
        : formData.rental_end_date

      const pricing = await apiService.calculateDynamicPricing({
        rental_machine_id: parseInt(formData.rental_machine_id),
        start_date: startDate,
        end_date: endDate || null,
        customer_id: parseInt(formData.customer_id)
      })

      // Apply the calculated pricing to the form
      setFormData(prev => ({
        ...prev,
        price_per_day: pricing.daily_price?.toString() || '',
        price_per_week: pricing.weekly_price?.toString() || '',
        price_per_month: pricing.monthly_price?.toString() || ''
      }))

      // Show success message
      setError(null)
    } catch (error) {
      console.error('Error calculating dynamic pricing:', error)
      setError('Failed to calculate dynamic pricing. Using manual pricing.')
    } finally {
      setIsCalculatingPricing(false)
    }
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Active Rentals</h1>
            <p className="text-muted-foreground">
              Manage machine rentals and track rental status
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Rental
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Machine Rental</DialogTitle>
                <DialogDescription>
                  Create a new rental agreement for a customer.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customer_id">Customer</Label>
                    <Select value={formData.customer_id} onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(customers) && customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.name} {customer.company_name && `(${customer.company_name})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="rental_machine_id">Rental Machine</Label>
                    <Select value={formData.rental_machine_id} onValueChange={(value) => {
                      const selectedMachine = availableMachines.find(m => m.id.toString() === value)
                      const isRented = selectedMachine?.current_rental_status === 'active' || selectedMachine?.current_rental_status === 'reserved'
                      
                      setFormData(prev => ({ 
                        ...prev, 
                        rental_machine_id: value,
                        rental_status: isRented ? 'reserved' : 'active'
                      }))
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select machine" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(availableMachines) && availableMachines.map((machine) => {
                          const isRented = machine.current_rental_status === 'active' || machine.current_rental_status === 'reserved'
                          const returnDate = machine.rental_end_date || machine.planned_return_date
                          const returnDateText = returnDate ? ` (returns ${formatDate(returnDate)})` : ''
                          
                          return (
                            <SelectItem key={machine.id} value={machine.id.toString()}>
                              {machine.manufacturer} {machine.model_name} - {machine.serial_number}
                              {isRented && ` (rented${returnDateText})`}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="rental_start_date">Start Date</Label>
                    <DatePickerInput
                      name="rental_start_date"
                      value={formData.rental_start_date}
                      onChange={(value) => setFormData(prev => ({ ...prev, rental_start_date: value }))}
                      placeholder="Select start date"
                    />
                    {(() => {
                      const selectedMachine = availableMachines.find(m => m.id.toString() === formData.rental_machine_id)
                      const isRented = selectedMachine?.current_rental_status === 'active' || selectedMachine?.current_rental_status === 'reserved'
                      const returnDate = selectedMachine?.rental_end_date || selectedMachine?.planned_return_date
                      
                      if (isRented && returnDate) {
                        return (
                          <p className="text-sm text-amber-600 mt-1">
                            ⚠️ This machine is currently rented. Start date must be on or after {formatDate(returnDate)}
                          </p>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <div>
                    <Label htmlFor="rental_end_date">End Date</Label>
                    <DatePickerInput
                      name="rental_end_date"
                      value={formData.rental_end_date}
                      onChange={(value) => setFormData(prev => ({ ...prev, rental_end_date: value }))}
                      placeholder="Select end date"
                    />
                  </div>
                  <div>
                    <Label htmlFor="planned_return_date">Planned Return</Label>
                    <DatePickerInput
                      name="planned_return_date"
                      value={formData.planned_return_date}
                      onChange={(value) => setFormData(prev => ({ ...prev, planned_return_date: value }))}
                      placeholder="Select planned return date"
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Pricing</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={calculateDynamicPricing}
                      disabled={isCalculatingPricing}
                    >
                      <Calculator className="mr-2 h-4 w-4" />
                      {isCalculatingPricing ? 'Calculating...' : 'Calculate Dynamic Pricing'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="price_per_day">Price per Day</Label>
                      <Input
                        id="price_per_day"
                        type="number"
                        step="0.01"
                        value={formData.price_per_day}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_per_day: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="price_per_week">Price per Week</Label>
                      <Input
                        id="price_per_week"
                        type="number"
                        step="0.01"
                        value={formData.price_per_week}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_per_week: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="price_per_month">Price per Month</Label>
                      <Input
                        id="price_per_month"
                        type="number"
                        step="0.01"
                        value={formData.price_per_month}
                        onChange={(e) => setFormData(prev => ({ ...prev, price_per_month: e.target.value }))}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="billing_period">Billing Period</Label>
                    <Select value={formData.billing_period} onValueChange={(value: any) => setFormData(prev => ({ ...prev, billing_period: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="total_amount">Total Amount</Label>
                    <Input
                      id="total_amount"
                      type="number"
                      step="0.01"
                      value={formData.total_amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, total_amount: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="rental_notes">Notes</Label>
                  <Textarea
                    id="rental_notes"
                    value={formData.rental_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, rental_notes: e.target.value }))}
                    placeholder="Enter rental notes"
                  />
                </div>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRental}>
                    Create Rental
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              <div>
                <Label>Search</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Search rentals..."
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
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer</Label>
                <Select value={filters.customer_id} onValueChange={(value) => handleFilterChange('customer_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    {Array.isArray(customers) && customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id.toString()}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date From</Label>
                <DatePickerInput
                  name="start_date_filter"
                  value={filters.start_date}
                  onChange={(value) => handleFilterChange('start_date', value)}
                  placeholder="Select start date"
                />
              </div>
              <div>
                <Label>End Date To</Label>
                <DatePickerInput
                  name="end_date_filter"
                  value={filters.end_date}
                  onChange={(value) => handleFilterChange('end_date', value)}
                  placeholder="Select end date"
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={handleClearFilters} className="w-full">
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rentals Table */}
        <Card>
          <CardHeader>
            <CardTitle>Machine Rentals ({pagination.total})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Machine</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rentals.map((rental) => (
                    <TableRow key={rental.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rental.customer_name}</div>
                          {rental.customer_company && (
                            <div className="text-sm text-muted-foreground">{rental.customer_company}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{rental.machine_manufacturer} {rental.machine_model_name}</div>
                          <div className="text-sm text-muted-foreground">SN: {rental.machine_serial}</div>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(rental.rental_start_date)}</TableCell>
                      <TableCell>{rental.rental_end_date ? formatDate(rental.rental_end_date) : '-'}</TableCell>
                      <TableCell>{getStatusBadge(rental.rental_status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{rental.billing_period}</div>
                          {rental.price_per_day && <div>${rental.price_per_day}/day</div>}
                          {rental.price_per_week && <div>${rental.price_per_week}/week</div>}
                          {rental.price_per_month && <div>${rental.price_per_month}/month</div>}
                        </div>
                      </TableCell>
                      <TableCell>{rental.total_amount ? formatCurrency(rental.total_amount) : '-'}</TableCell>
                      <TableCell>{formatDateTime(rental.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/machine-rentals/${rental.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {user?.role !== 'sales' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(rental)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setRentalToDelete(rental)
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
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Machine Rental</DialogTitle>
              <DialogDescription>
                Update the details of this rental agreement.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_customer_id">Customer</Label>
                  <Select value={formData.customer_id} onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(customers) && customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id.toString()}>
                          {customer.name} {customer.company_name && `(${customer.company_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_rental_status">Status</Label>
                  <Select value={formData.rental_status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, rental_status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_rental_start_date">Start Date</Label>
                  <DatePickerInput
                    name="edit_rental_start_date"
                    value={formData.rental_start_date}
                    onChange={(value) => setFormData(prev => ({ ...prev, rental_start_date: value }))}
                    placeholder="Select start date"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_rental_end_date">End Date</Label>
                  <DatePickerInput
                    name="edit_rental_end_date"
                    value={formData.rental_end_date}
                    onChange={(value) => setFormData(prev => ({ ...prev, rental_end_date: value }))}
                    placeholder="Select end date"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_planned_return_date">Planned Return</Label>
                  <DatePickerInput
                    name="edit_planned_return_date"
                    value={formData.planned_return_date}
                    onChange={(value) => setFormData(prev => ({ ...prev, planned_return_date: value }))}
                    placeholder="Select planned return date"
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Pricing</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={calculateDynamicPricing}
                    disabled={isCalculatingPricing}
                  >
                    <Calculator className="mr-2 h-4 w-4" />
                    {isCalculatingPricing ? 'Calculating...' : 'Recalculate Pricing'}
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit_price_per_day">Price per Day</Label>
                    <Input
                      id="edit_price_per_day"
                      type="number"
                      step="0.01"
                      value={formData.price_per_day}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_per_day: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_price_per_week">Price per Week</Label>
                    <Input
                      id="edit_price_per_week"
                      type="number"
                      step="0.01"
                      value={formData.price_per_week}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_per_week: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_price_per_month">Price per Month</Label>
                    <Input
                      id="edit_price_per_month"
                      type="number"
                      step="0.01"
                      value={formData.price_per_month}
                      onChange={(e) => setFormData(prev => ({ ...prev, price_per_month: e.target.value }))}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_billing_period">Billing Period</Label>
                  <Select value={formData.billing_period} onValueChange={(value: any) => setFormData(prev => ({ ...prev, billing_period: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_total_amount">Total Amount</Label>
                  <Input
                    id="edit_total_amount"
                    type="number"
                    step="0.01"
                    value={formData.total_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, total_amount: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit_rental_notes">Notes</Label>
                <Textarea
                  id="edit_rental_notes"
                  value={formData.rental_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, rental_notes: e.target.value }))}
                />
              </div>
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditRental}>
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
              <DialogTitle>Delete Machine Rental</DialogTitle>
              <DialogDescription>
                This action cannot be undone. The rental agreement will be permanently removed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p>
                Are you sure you want to delete this machine rental? This action cannot be undone.
              </p>
              {rentalToDelete && (
                <div className="bg-muted p-4 rounded-lg">
                  <p><strong>Customer:</strong> {rentalToDelete.customer_name}</p>
                  <p><strong>Machine:</strong> {rentalToDelete.machine_manufacturer} {rentalToDelete.machine_model_name}</p>
                  <p><strong>Serial:</strong> {rentalToDelete.machine_serial}</p>
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDeleteRental}>
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
