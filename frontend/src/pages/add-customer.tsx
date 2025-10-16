import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { apiService } from '../services/api'
import { toast } from 'sonner'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Save,
  X
} from 'lucide-react'

interface CustomerFormData {
  customer_type: 'private' | 'company'
  name: string
  contact_person?: string
  email: string
  phone: string
  phone2?: string
  fax?: string
  street_address?: string
  city?: string
  postal_code?: string
  company_name?: string
  vat_number?: string
  owner_id?: number
  ownership_notes?: string
  status?: 'active' | 'inactive' | 'pending'
}

export default function AddCustomerPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<CustomerFormData>({
    customer_type: 'private',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    phone2: '',
    fax: '',
    street_address: '',
    city: '',
    postal_code: '',
    company_name: '',
    vat_number: '',
    owner_id: undefined,
    ownership_notes: '',
    status: 'active'
  })

  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true)
        const response = await apiService.getUsers()
        setUsers(response.data || [])
      } catch (error) {
        console.error('Error fetching users:', error)
        toast.error(t('pages.customers.failed_to_load_users'))
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [])

  const handleInputChange = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'owner_id' ? (value === 'none' ? undefined : parseInt(value)) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setIsSubmitting(true)
      
      // Prepare data for API based on customer type
      let customerData: any = { ...formData }
      
      if (formData.customer_type === 'company') {
        // For company customers, use company_name as the main name field
        customerData.name = formData.company_name
        // Remove empty contact_person if not provided
        if (!customerData.contact_person) {
          delete customerData.contact_person
        }
      } else {
        // For private customers, use the name field as is
        // Remove empty company_name if not provided
        if (!customerData.company_name) {
          delete customerData.company_name
        }
        // Remove contact_person for private customers
        delete customerData.contact_person
      }
      
      // Remove empty strings and undefined values
      customerData = Object.fromEntries(
        Object.entries(customerData).filter(([_, value]) => value !== '' && value !== undefined)
      )
      
      
      await apiService.createCustomer(customerData)
      toast.success(t('pages.customers.customer_created_successfully'))
      
      // Navigate back to customers page
      navigate('/customers')
    } catch (error) {
      console.error('Error creating customer:', error)
      toast.error(t('pages.customers.failed_to_create_customer'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate('/customers')
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
              <h1 className="text-3xl font-bold tracking-tight">{t('pages.customers.add_new_customer')}</h1>
              <p className="text-muted-foreground">
                {t('pages.customers.add_new_customer_description')}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="mr-2 h-4 w-4" />
              {t('cancel')}
            </Button>
            <Button 
              type="submit" 
              form="customer-form"
              disabled={isSubmitting}
            >
              <Save className="mr-2 h-4 w-4" />
              {isSubmitting ? t('pages.customers.creating') : t('pages.customers.create_customer')}
            </Button>
          </div>
        </div>

        {/* Form */}
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.customers.customer_type')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="customer_type">{t('pages.customers.customer_type_required')}</Label>
                <Select
                  value={formData.customer_type}
                  onValueChange={(value: 'private' | 'company') => handleInputChange('customer_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('pages.customers.select_customer_type')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">{t('pages.customers.private_personnel')}</SelectItem>
                    <SelectItem value="company">{t('pages.customers.company')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>{t('pages.customers.basic_information')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.customer_type === 'private' ? (
                  <div className="space-y-2">
                    <Label htmlFor="name">{t('pages.customers.full_name_required')}</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder={t('pages.customers.enter_full_name')}
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">{t('pages.customers.company_name_required')}</Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="company_name"
                          value={formData.company_name || ''}
                          onChange={(e) => handleInputChange('company_name', e.target.value)}
                          placeholder={t('pages.customers.enter_company_name')}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_person">{t('pages.customers.contact_person_required')}</Label>
                      <Input
                        id="contact_person"
                        value={formData.contact_person || ''}
                        onChange={(e) => handleInputChange('contact_person', e.target.value)}
                        placeholder={t('pages.customers.enter_contact_person')}
                        required
                      />
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">{t('pages.customers.email_address_required')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder={t('pages.customers.enter_email_address')}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('pages.customers.phone_number')}</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder={t('pages.customers.enter_phone_number')}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {/* Show company name field for private customers (optional) */}
                {formData.customer_type === 'private' && (
                  <div className="space-y-2">
                    <Label htmlFor='company_name'>{t('pages.customers.company_name_optional')}</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="company_name"
                        value={formData.company_name || ''}
                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                        placeholder={t('pages.customers.enter_company_name_if_applicable')}
                        className="pl-10"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor='vat_number'>{t('pages.customers.vat_number')}</Label>
                  <Input
                    id="vat_number"
                    value={formData.vat_number || ''}
                    onChange={(e) => handleInputChange('vat_number', e.target.value)}
                    placeholder={t('pages.customers.enter_vat_number')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>{t('pages.customers.address_information')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor='street_address'>{t('pages.customers.street_address')}</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="street_address"
                      value={formData.street_address || ''}
                      onChange={(e) => handleInputChange('street_address', e.target.value)}
                      placeholder={t('pages.customers.enter_street_address')}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor='city'>{t('pages.customers.city')}</Label>
                    <Input
                      id="city"
                      value={formData.city || ''}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder={t('pages.customers.enter_city')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor='postal_code'>{t('pages.customers.postal_code')}</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code || ''}
                      onChange={(e) => handleInputChange('postal_code', e.target.value)}
                      placeholder={t('pages.customers.enter_postal_code')}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor='phone2'>{t('pages.customers.secondary_phone')}</Label>
                    <Input
                      id="phone2"
                      value={formData.phone2 || ''}
                      onChange={(e) => handleInputChange('phone2', e.target.value)}
                      placeholder={t('pages.customers.enter_secondary_phone')}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor='fax'>{t('pages.customers.fax')}</Label>
                    <Input
                      id="fax"
                      value={formData.fax || ''}
                      onChange={(e) => handleInputChange('fax', e.target.value)}
                      placeholder={t('pages.customers.enter_fax_number')}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Assignment & Status */}
          <Card>
            <CardHeader>
              <CardTitle>{t('pages.customers.assignment_status')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor='status'>{t('tables.headers.status')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('pages.customers.select_status')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='active'>{t('status.active')}</SelectItem>
                      <SelectItem value='inactive'>{t('status.inactive')}</SelectItem>
                      <SelectItem value='pending'>{t('status.pending')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor='owner_id'>{t('tables.headers.assigned_to')}</Label>
                  <Select
                    value={formData.owner_id?.toString() || 'none'}
                    onValueChange={(value) => handleInputChange('owner_id', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingUsers ? t('pages.customers.loading_users') : t('pages.customers.select_owner')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='none'>{t('pages.customers.no_owner')}</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor='ownership_notes'>{t('pages.customers.ownership_notes')}</Label>
                  <Input
                    id="ownership_notes"
                    value={formData.ownership_notes || ''}
                    onChange={(e) => handleInputChange('ownership_notes', e.target.value)}
                    placeholder={t('pages.customers.enter_ownership_notes')}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </MainLayout>
  )
}
