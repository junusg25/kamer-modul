import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, User, Mail, Phone, Building, MapPin } from 'lucide-react'
import { apiService } from '@/services/api'
import { toast } from 'sonner'

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

interface CustomerFormProps {
  onCustomerCreated?: () => void
  trigger?: React.ReactNode
}

export function CustomerForm({ onCustomerCreated, trigger }: CustomerFormProps) {
  const [open, setOpen] = React.useState(false)
  const [users, setUsers] = React.useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = React.useState(false)
  const [formData, setFormData] = React.useState<CustomerFormData>({
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

  const handleInputChange = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'owner_id' ? (value === '' ? undefined : parseInt(value)) : value
    }))
  }

  // Fetch users when dialog opens
  React.useEffect(() => {
    if (open) {
      const fetchUsers = async () => {
        try {
          setLoadingUsers(true)
          const response = await apiService.getUsers()
          setUsers(response.data || [])
        } catch (error) {
          console.error('Error fetching users:', error)
          toast.error('Failed to load users')
        } finally {
          setLoadingUsers(false)
        }
      }
      fetchUsers()
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
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
      toast.success('Customer created successfully!')
      
      setOpen(false)
      // Reset form
      setFormData({
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
      
      // Notify parent component
      if (onCustomerCreated) {
        onCustomerCreated()
      }
    } catch (error) {
      console.error('Error creating customer:', error)
      toast.error('Failed to create customer. Please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Add New Customer</span>
          </DialogTitle>
          <DialogDescription>
            Create a new customer profile with their contact information and company details.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="customer_type">Customer Type *</Label>
            <Select
              value={formData.customer_type}
              onValueChange={(value: 'private' | 'company') => handleInputChange('customer_type', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private Personnel</SelectItem>
                <SelectItem value="company">Company</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.customer_type === 'private' ? (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Enter full name"
                      required
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="company_name">Company Name *</Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="company_name"
                          value={formData.company_name || ''}
                          onChange={(e) => handleInputChange('company_name', e.target.value)}
                          placeholder="Enter company name"
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_person">Contact Person *</Label>
                      <Input
                        id="contact_person"
                        value={formData.contact_person || ''}
                        onChange={(e) => handleInputChange('contact_person', e.target.value)}
                        placeholder="Enter contact person name"
                        required
                      />
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="Enter email address"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="Enter phone number"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                {/* Show company name field for private customers (optional) */}
                {formData.customer_type === 'private' && (
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name (Optional)</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="company_name"
                        value={formData.company_name || ''}
                        onChange={(e) => handleInputChange('company_name', e.target.value)}
                        placeholder="Enter company name (if applicable)"
                        className="pl-10"
                      />
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="vat_number">VAT Number</Label>
                  <Input
                    id="vat_number"
                    value={formData.vat_number || ''}
                    onChange={(e) => handleInputChange('vat_number', e.target.value)}
                    placeholder="Enter VAT number"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Address Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Address Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street_address">Street Address</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="street_address"
                      value={formData.street_address || ''}
                      onChange={(e) => handleInputChange('street_address', e.target.value)}
                      placeholder="Enter street address"
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city || ''}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code || ''}
                      onChange={(e) => handleInputChange('postal_code', e.target.value)}
                      placeholder="Postal code"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone2">Secondary Phone</Label>
                    <Input
                      id="phone2"
                      value={formData.phone2 || ''}
                      onChange={(e) => handleInputChange('phone2', e.target.value)}
                      placeholder="Secondary phone number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fax">Fax</Label>
                    <Input
                      id="fax"
                      value={formData.fax || ''}
                      onChange={(e) => handleInputChange('fax', e.target.value)}
                      placeholder="Fax number"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="owner_id">Owner</Label>
                  <Select
                    value={formData.owner_id?.toString() || 'none'}
                    onValueChange={(value) => handleInputChange('owner_id', value === 'none' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select owner"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No owner</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id.toString()}>
                          {user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ownership_notes">Ownership Notes</Label>
                  <Input
                    id="ownership_notes"
                    value={formData.ownership_notes || ''}
                    onChange={(e) => handleInputChange('ownership_notes', e.target.value)}
                    placeholder="Enter ownership notes"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Create Customer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
