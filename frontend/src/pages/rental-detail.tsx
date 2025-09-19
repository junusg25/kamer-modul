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
import { ArrowLeft, Edit, Trash2, Calendar, User, MapPin, Wrench, DollarSign, Clock, AlertTriangle } from 'lucide-react'

interface RentalDetail {
  id: number
  rental_machine_id: number
  customer_id: number
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
  
  // Customer details
  customer_name: string
  customer_company?: string
  customer_email?: string
  customer_phone?: string
  customer_address?: string
  customer_city?: string
  customer_postal_code?: string
  
  // Machine details
  machine_serial: string
  machine_condition: string
  machine_location?: string
  machine_notes?: string
  machine_model_name: string
  machine_manufacturer: string
  machine_catalogue_number?: string
  machine_model_description?: string
  
  // Created by
  created_by_name?: string
}

export default function RentalDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rental, setRental] = useState<RentalDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchRentalDetail()
    }
  }, [id])

  const fetchRentalDetail = async () => {
    try {
      setLoading(true)
      const response = await apiService.getMachineRental(id!)
      setRental(response)
    } catch (error) {
      console.error('Error fetching rental detail:', error)
      setError('Failed to load rental details')
    } finally {
      setLoading(false)
    }
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

  const calculateRentalDuration = () => {
    if (!rental) return null
    
    const startDate = new Date(rental.rental_start_date)
    const endDate = rental.rental_end_date ? new Date(rental.rental_end_date) : new Date()
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  const isOverdue = () => {
    if (!rental || rental.rental_status === 'returned' || rental.rental_status === 'cancelled') return false
    
    const today = new Date()
    const dueDate = rental.rental_end_date ? new Date(rental.rental_end_date) : 
                   rental.planned_return_date ? new Date(rental.planned_return_date) : null
    
    return dueDate && today > dueDate
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading rental details...</p>
        </div>
      </div>
    )
  }

  if (error || !rental) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 mb-4">{error || 'Rental not found'}</p>
          <Button onClick={() => navigate('/machine-rentals')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rentals
          </Button>
        </div>
      </div>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="outline" onClick={() => navigate('/machine-rentals')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Rentals
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Rental Details</h1>
            <p className="text-gray-600">Rental ID: #{rental.id}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(rental.rental_status)}
          {isOverdue() && (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Overdue
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rental Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Rental Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Start Date</label>
                  <p className="text-lg">{formatDate(rental.rental_start_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">End Date</label>
                  <p className="text-lg">{rental.rental_end_date ? formatDate(rental.rental_end_date) : 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Planned Return</label>
                  <p className="text-lg">{rental.planned_return_date ? formatDate(rental.planned_return_date) : 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Actual Return</label>
                  <p className="text-lg">{rental.actual_return_date ? formatDate(rental.actual_return_date) : 'Not returned'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Duration</label>
                  <p className="text-lg">{calculateRentalDuration()} days</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Billing Period</label>
                  <p className="text-lg capitalize">{rental.billing_period}</p>
                </div>
              </div>
              
              {rental.rental_notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Notes</label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">{rental.rental_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Machine Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wrench className="mr-2 h-5 w-5" />
                Machine Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Machine</label>
                  <p className="text-lg font-medium">{rental.machine_manufacturer} {rental.machine_model_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Serial Number</label>
                  <p className="text-lg">{rental.machine_serial}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Condition</label>
                  <div className="mt-1">{getConditionBadge(rental.machine_condition)}</div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Location</label>
                  <p className="text-lg">{rental.machine_location || 'Not specified'}</p>
                </div>
                {rental.machine_catalogue_number && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Catalogue Number</label>
                    <p className="text-lg">{rental.machine_catalogue_number}</p>
                  </div>
                )}
              </div>
              
              {rental.machine_model_description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">{rental.machine_model_description}</p>
                </div>
              )}
              
              {rental.machine_notes && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Machine Notes</label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">{rental.machine_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2 h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Name</label>
                  <p className="text-lg font-medium">{rental.customer_name}</p>
                </div>
                {rental.customer_company && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Company</label>
                    <p className="text-lg">{rental.customer_company}</p>
                  </div>
                )}
                {rental.customer_email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-lg">{rental.customer_email}</p>
                  </div>
                )}
                {rental.customer_phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <p className="text-lg">{rental.customer_phone}</p>
                  </div>
                )}
                {rental.customer_address && (
                  <div className="col-span-2">
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p className="text-lg">{rental.customer_address}</p>
                    {rental.customer_city && (
                      <p className="text-lg">{rental.customer_city} {rental.customer_postal_code}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Pricing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="mr-2 h-5 w-5" />
                Pricing
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rental.price_per_day && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Price per Day</label>
                  <p className="text-lg font-medium">{formatCurrency(rental.price_per_day)}</p>
                </div>
              )}
              {rental.price_per_week && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Price per Week</label>
                  <p className="text-lg font-medium">{formatCurrency(rental.price_per_week)}</p>
                </div>
              )}
              {rental.price_per_month && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Price per Month</label>
                  <p className="text-lg font-medium">{formatCurrency(rental.price_per_month)}</p>
                </div>
              )}
              {rental.total_amount && (
                <div>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Amount</label>
                    <p className="text-xl font-bold text-primary">{formatCurrency(rental.total_amount)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Maintenance Reminder */}
          {rental.maintenance_reminder_date && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5" />
                  Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium text-gray-500">Reminder Date</label>
                  <p className="text-lg">{formatDate(rental.maintenance_reminder_date)}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Information */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Created</label>
                <p className="text-sm">{formatDateTime(rental.created_at)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Last Updated</label>
                <p className="text-sm">{formatDateTime(rental.updated_at)}</p>
              </div>
              {rental.created_by_name && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Created By</label>
                  <p className="text-sm">{rental.created_by_name}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          {user?.role !== 'sales' && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Rental
                </Button>
                <Button className="w-full" variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Rental
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      </div>
    </MainLayout>
  )
}
