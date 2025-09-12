import { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
// Removed Command imports - using purchased_at dropdown instead
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../components/ui/popover'
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Search,
  User,
  Wrench,
  FileText,
  CheckCircle,
  Loader2,
  AlertTriangle,
  ChevronDown,
  Check,
  Calendar,
  Package,
  Building2,
  Euro,
  Phone,
  Mail,
  MapPin,
  Hash,
  Receipt,
  Printer,
  Shield
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { cn } from '../lib/utils'
import { formatDate } from '../lib/dateTime'

interface Customer {
  id: string
  customer_type: 'private' | 'company'
  name: string
  contact_person?: string
  email?: string
  phone?: string
  phone1?: string
  phone2?: string
  fax?: string
  street_address?: string
  city?: string
  postal_code?: string
  company_name?: string
  vat_number?: string
  owner_id?: number
  owner_name?: string
  ownership_notes?: string
  assigned_at?: string
  created_at?: string
  updated_at?: string
}

interface Machine {
  id: string
  machine_id: string
  customer_id: string
  manufacturer?: string
  model_name?: string
  serial_number?: string
  purchase_date?: string
  warranty_expiry_date?: string
}

interface MachineModel {
  id: string
  name: string
  manufacturer?: string
  catalogue_number?: string
  warranty_months?: number
}

// Removed Supplier interface - using dynamic purchased_at options instead

const STEPS = [
  { id: 'customer', label: 'Customer', icon: User, description: 'Select or create customer' },
  { id: 'machine', label: 'Machine', icon: Wrench, description: 'Choose machine for warranty repair' },
  { id: 'details', label: 'Problem Details', icon: FileText, description: 'Describe the warranty issue' },
  { id: 'review', label: 'Review & Submit', icon: CheckCircle, description: 'Confirm and create warranty ticket' }
]

export default function CreateWarrantyRepairTicket() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form data
  const [formData, setFormData] = useState({
    // Customer selection
    customerType: 'existing' as 'existing' | 'new',
    selectedCustomer: null as Customer | null,
    
    // New customer data
    newCustomer: {
      customer_type: 'private' as 'private' | 'company',
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      phone2: '',
      fax: '',
      company_name: '',
      vat_number: '',
      street_address: '',
      city: '',
      postal_code: '',
      owner_id: undefined,
      ownership_notes: ''
    },
    
    // Machine selection
    machineType: 'existing' as 'existing' | 'new',
    selectedMachine: null as Machine | null,
    
    // New machine data
    newMachine: {
      model_id: '',
      serial_number: '',
      purchase_date: '',
      purchased_at: '',
      receipt_number: '',
      sale_price: '',
      machine_condition: 'new',
      description: '',
      warranty_expiry_date: ''
    },
    
    // New machine model data
    newModel: {
      name: '',
      manufacturer: '',
      catalogue_number: '',
      warranty_months: 12,
      category_id: ''
    },
    
    // Ticket details
    ticketDetails: {
      problem_description: '',
      notes: '',
      additional_equipment: '',
      brought_by: '',
      priority: 'medium' as 'low' | 'medium' | 'high'
    }
  })
  
  // Data loading states
  const [customers, setCustomers] = useState<Customer[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [machineModels, setMachineModels] = useState<MachineModel[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false)
  const [isLoadingMachines, setIsLoadingMachines] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  
  // Dynamic purchased_at options
  const [purchasedAtOptions, setPurchasedAtOptions] = useState<string[]>(['AMS', 'Kamer.ba'])
  const [purchasedAtSearch, setPurchasedAtSearch] = useState('')
  const [purchasedAtPopoverOpen, setPurchasedAtPopoverOpen] = useState(false)
  
  // Dialog states
  const [showNewMachineDialog, setShowNewMachineDialog] = useState(false)
  const [showNewModelDialog, setShowNewModelDialog] = useState(false)
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
  const [isCreatingMachine, setIsCreatingMachine] = useState(false)
  const [isCreatingModel, setIsCreatingModel] = useState(false)
  
  // Popover states
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false)
  const [machinePopoverOpen, setMachinePopoverOpen] = useState(false)
  const [modelPopoverOpen, setModelPopoverOpen] = useState(false)
  // Removed supplierPopoverOpen - using purchasedAtPopoverOpen instead
  
  // Search states
  const [machineSearchTerm, setMachineSearchTerm] = useState('')
  

  useEffect(() => {
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (formData.selectedCustomer?.id) {
      fetchCustomerMachines(formData.selectedCustomer.id)
    }
  }, [formData.selectedCustomer])

  // Auto-calculate warranty expiry when purchase date or model changes
  useEffect(() => {
    if (formData.newMachine.purchase_date && formData.newMachine.model_id) {
      const warrantyExpiry = calculateWarrantyExpiry(formData.newMachine.purchase_date, formData.newMachine.model_id)
      setFormData(prev => ({
        ...prev,
        newMachine: { ...prev.newMachine, warranty_expiry_date: warrantyExpiry }
      }))
    }
  }, [formData.newMachine.purchase_date, formData.newMachine.model_id])

  const fetchInitialData = async () => {
    try {
      setIsLoadingCustomers(true)
      setIsLoadingModels(true)
      
      const [customersRes, modelsRes, usersRes] = await Promise.all([
        apiService.getCustomers({ limit: 100 }),
        apiService.getMachineModels({ limit: 100 }),
        apiService.getUsers({ limit: 100 })
      ])
      
      setCustomers((customersRes as any).data || [])
      setMachineModels((modelsRes as any).data || [])
      setUsers((usersRes as any).data || [])
      
      // Fetch purchased_at options
      await fetchPurchasedAtOptions()
    } catch (err) {
      console.error('Error fetching initial data:', err)
      setError('Failed to load form data')
    } finally {
      setIsLoadingCustomers(false)
      setIsLoadingModels(false)
    }
  }

  const fetchPurchasedAtOptions = async () => {
    try {
      // Fetch unique purchased_at values from assigned machines using API service
      const response = await apiService.request('/assigned-machines/purchased-at-options')
      const options = response.data || []
      // Combine predefined options with database options, removing duplicates
      const allOptions = [...new Set(['AMS', 'Kamer.ba', ...options])]
      setPurchasedAtOptions(allOptions)
    } catch (err) {
      console.error('Error fetching purchased_at options:', err)
      // Fallback to predefined options
      setPurchasedAtOptions(['AMS', 'Kamer.ba'])
    }
  }

  const filteredPurchasedAtOptions = purchasedAtOptions.filter(option =>
    option.toLowerCase().includes(purchasedAtSearch.toLowerCase())
  )

  // Calculate warranty expiry date
  const calculateWarrantyExpiry = (purchaseDate: string, modelId: string) => {
    if (!purchaseDate || !modelId) return ''
    const model = machineModels.find(m => m.id === modelId)
    if (!model || !model.warranty_months) return ''
    
    const date = new Date(purchaseDate)
    date.setMonth(date.getMonth() + model.warranty_months)
    return date.toISOString().split('T')[0]
  }

  const fetchCustomerMachines = async (customerId: string) => {
    try {
      setIsLoadingMachines(true)
      const response = await apiService.getCustomerMachines(customerId) as any
      setMachines(response.data || [])
    } catch (err) {
      console.error('Error fetching customer machines:', err)
    } finally {
      setIsLoadingMachines(false)
    }
  }

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCustomerTypeChange = (type: 'existing' | 'new') => {
    setFormData(prev => ({
      ...prev,
      customerType: type,
      selectedCustomer: type === 'existing' ? prev.selectedCustomer : null,
      newCustomer: type === 'new' ? prev.newCustomer : {
        customer_type: 'private',
        name: '',
        contact_person: '',
        email: '',
        phone: '',
        phone2: '',
        fax: '',
        company_name: '',
        vat_number: '',
        street_address: '',
        city: '',
        postal_code: '',
        owner_id: undefined,
        ownership_notes: ''
      }
    }))
  }

  const handleMachineTypeChange = (type: 'existing' | 'new') => {
    setFormData(prev => ({
      ...prev,
      machineType: type,
      selectedMachine: type === 'existing' ? prev.selectedMachine : null,
      newMachine: type === 'new' ? prev.newMachine : {
        model_id: '',
        serial_number: '',
        purchase_date: '',
        purchased_at: '',
        receipt_number: '',
        sale_price: '',
        machine_condition: 'new',
        description: '',
        warranty_expiry_date: ''
      }
    }))
  }

  const createNewCustomer = async () => {
    try {
      setIsCreatingCustomer(true)
      
      // Prepare customer data based on type
      const customerData = {
        ...formData.newCustomer,
        // For company customers, set name to company_name
        name: formData.newCustomer.customer_type === 'company' 
          ? formData.newCustomer.company_name 
          : formData.newCustomer.name
      }
      
      const response = await apiService.createCustomer(customerData) as any
      
      // Backend returns customer directly, not wrapped in data property
      const newCustomer = response.data || response
      
      if (!newCustomer || !newCustomer.id) {
        throw new Error('Invalid customer data received from server')
      }
      
      setCustomers(prev => [newCustomer, ...prev])
      setFormData(prev => ({
        ...prev,
        selectedCustomer: newCustomer,
        customerType: 'existing'
      }))
    } catch (err) {
      console.error('Error creating customer:', err)
      setError('Failed to create customer')
    } finally {
      setIsCreatingCustomer(false)
    }
  }

  const createNewModel = async () => {
    try {
      setIsCreatingModel(true)
      const response = await apiService.createMachineModel(formData.newModel) as any
      const newModel = response.data
      
      setMachineModels(prev => [newModel, ...prev])
      setFormData(prev => ({
        ...prev,
        newMachine: {
          ...prev.newMachine,
          model_id: newModel.id
        }
      }))
      setShowNewModelDialog(false)
    } catch (err) {
      console.error('Error creating machine model:', err)
      setError('Failed to create machine model')
    } finally {
      setIsCreatingModel(false)
    }
  }

  const createNewMachine = async () => {
    try {
      setIsCreatingMachine(true)
      
      // Create the assigned machine (backend handles serial creation automatically)
      const assignedMachineData = {
        customer_id: parseInt(formData.selectedCustomer!.id),
        serial_number: formData.newMachine.serial_number,
        model_id: parseInt(formData.newMachine.model_id),
        purchase_date: formData.newMachine.purchase_date,
        purchased_at: formData.newMachine.purchased_at,
        receipt_number: formData.newMachine.receipt_number,
        sale_price: formData.newMachine.sale_price ? parseFloat(formData.newMachine.sale_price) : null,
        machine_condition: formData.newMachine.machine_condition,
        description: formData.newMachine.description,
        warranty_expiry_date: formData.newMachine.warranty_expiry_date
      }
      
      console.log('Creating assigned machine with data:', assignedMachineData)
      
      const assignedResponse = await apiService.createAssignedMachine(assignedMachineData) as any
      const newAssignedMachine = assignedResponse.data
      
      // Add to machines list
      const newMachine: Machine = {
        id: newAssignedMachine.id,
        machine_id: newAssignedMachine.id, // Use assigned machine ID, not serial ID
        customer_id: formData.selectedCustomer!.id,
        manufacturer: machineModels.find(m => m.id === formData.newMachine.model_id)?.manufacturer,
        model_name: machineModels.find(m => m.id === formData.newMachine.model_id)?.name,
        serial_number: formData.newMachine.serial_number,
        purchase_date: formData.newMachine.purchase_date
      }
      
      setMachines(prev => [newMachine, ...prev])
      setFormData(prev => ({
        ...prev,
        selectedMachine: newMachine,
        machineType: 'existing'
      }))
      setShowNewMachineDialog(false)
    } catch (err) {
      console.error('Error creating machine:', err)
      setError(err instanceof Error ? err.message : 'Failed to create machine')
    } finally {
      setIsCreatingMachine(false)
    }
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      setError(null)
      
      console.log('Selected machine:', formData.selectedMachine)
      console.log('Machine ID being sent:', formData.selectedMachine!.id)
      
      const ticketData = {
        customer_id: formData.selectedCustomer!.id,
        machine_id: parseInt(formData.selectedMachine!.id), // Use id instead of machine_id
        problem_description: formData.ticketDetails.problem_description,
        notes: formData.ticketDetails.notes,
        additional_equipment: formData.ticketDetails.additional_equipment,
        brought_by: formData.ticketDetails.brought_by,
        priority: formData.ticketDetails.priority,
        submitted_by: '1' // TODO: Get from auth context
      }
      
      console.log('Warranty ticket data being sent:', ticketData)
      
      const response = await apiService.createWarrantyRepairTicket(ticketData) as any
      const newTicket = response.data
      
      // Navigate to the new warranty ticket detail page
      navigate(`/warranty-repair-tickets/${newTicket.id}`)
    } catch (err) {
      console.error('Error creating warranty repair ticket:', err)
      setError('Failed to create warranty repair ticket')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isStepValid = (step: number) => {
    switch (step) {
      case 0: // Customer
        if (formData.customerType === 'existing') {
          return !!formData.selectedCustomer
        } else {
          if (formData.newCustomer.customer_type === 'company') {
            return !!(formData.newCustomer.company_name && formData.newCustomer.contact_person && formData.newCustomer.email)
          } else {
            return !!(formData.newCustomer.name && formData.newCustomer.email)
          }
        }
      case 1: // Machine
        if (formData.machineType === 'existing') {
          return !!formData.selectedMachine
        } else {
          return !!(formData.newMachine.model_id && formData.newMachine.serial_number)
        }
      case 2: // Details
        return !!formData.ticketDetails.problem_description
      case 3: // Review
        return true
      default:
        return false
    }
  }

  const canProceed = isStepValid(currentStep)
  const canSubmit = isStepValid(0) && isStepValid(1) && isStepValid(2)

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderCustomerStep()
      case 1:
        return renderMachineStep()
      case 2:
        return renderDetailsStep()
      case 3:
        return renderReviewStep()
      default:
        return null
    }
  }

  const renderCustomerStep = () => (
    <div className="space-y-8">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-primary/10">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-2xl font-semibold">Select Customer</h3>
        <p className="text-muted-foreground">Choose an existing customer or create a new one</p>
      </div>

      {/* Customer Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            formData.customerType === 'existing' && "ring-2 ring-primary"
          )}
          onClick={() => handleCustomerTypeChange('existing')}
        >
          <CardContent className="p-6 text-center">
            <User className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <h4 className="font-semibold mb-2">Existing Customer</h4>
            <p className="text-sm text-muted-foreground">Select from your customer database</p>
          </CardContent>
        </Card>
        
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            formData.customerType === 'new' && "ring-2 ring-primary"
          )}
          onClick={() => handleCustomerTypeChange('new')}
        >
          <CardContent className="p-6 text-center">
            <Plus className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <h4 className="font-semibold mb-2">New Customer</h4>
            <p className="text-sm text-muted-foreground">Create a new customer profile</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Customer Selection/Creation */}
      {formData.customerType === 'existing' ? (
        <div className="space-y-4">
          <div>
            <Label className="text-base font-medium">Search & Select Customer</Label>
            <p className="text-sm text-muted-foreground mb-4">Find and select the customer for this warranty repair ticket</p>
          </div>
          
          {formData.selectedCustomer && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-primary">
                      {formData.selectedCustomer.customer_type === 'company' 
                        ? formData.selectedCustomer.company_name 
                        : formData.selectedCustomer.name}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {formData.selectedCustomer.customer_type === 'company' && formData.selectedCustomer.contact_person && (
                        <Badge variant="outline" className="text-xs">
                          <User className="w-3 h-3 mr-1" />
                          {formData.selectedCustomer.contact_person}
                        </Badge>
                      )}
                      {formData.selectedCustomer.customer_type === 'private' && formData.selectedCustomer.company_name && (
                        <Badge variant="outline" className="text-xs">
                          <Building2 className="w-3 h-3 mr-1" />
                          {formData.selectedCustomer.company_name}
                        </Badge>
                      )}
                      {formData.selectedCustomer.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {formData.selectedCustomer.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, selectedCustomer: null }))}
                    className="ml-auto"
                  >
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={customerPopoverOpen}
                className="w-full justify-between h-12"
              >
                {formData.selectedCustomer ? (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>
                      {formData.selectedCustomer.customer_type === 'company' 
                        ? formData.selectedCustomer.company_name 
                        : formData.selectedCustomer.name}
                    </span>
                    {formData.selectedCustomer.customer_type === 'company' && formData.selectedCustomer.contact_person && (
                      <Badge variant="secondary" className="ml-2">
                        {formData.selectedCustomer.contact_person}
                      </Badge>
                    )}
                    {formData.selectedCustomer.customer_type === 'private' && formData.selectedCustomer.company_name && (
                      <Badge variant="secondary" className="ml-2">
                        {formData.selectedCustomer.company_name}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Select customer...</span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <div className="border-b p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customers..."
                    className="pl-10"
                    onChange={(e) => {
                      // Simple search - we'll implement this if needed
                    }}
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {isLoadingCustomers ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Loading customers...</span>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    No customers found.
                  </div>
                ) : (
                <div className="p-1">
                  {customers.filter(customer => customer && customer.id).map((customer) => (
                    <div
                      key={customer.id}
                      onClick={() => {
                        console.log('Customer clicked:', customer.name)
                        setFormData(prev => ({ ...prev, selectedCustomer: customer }))
                        setCustomerPopoverOpen(false)
                      }}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                        formData.selectedCustomer?.id === customer.id && "bg-accent"
                      )}
                    >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            formData.selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">
                            {customer.customer_type === 'company' ? customer.company_name : customer.name}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {customer.customer_type === 'company' && customer.contact_person && (
                              <Badge variant="outline" className="text-xs">
                                <User className="w-3 h-3 mr-1" />
                                {customer.contact_person}
                              </Badge>
                            )}
                            {customer.customer_type === 'private' && customer.company_name && (
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="w-3 h-3 mr-1" />
                                {customer.company_name}
                              </Badge>
                            )}
                            {customer.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {customer.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium">Create New Customer</Label>
            <p className="text-sm text-muted-foreground mb-4">Enter customer information to create a new profile</p>
          </div>
          
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px bg-border flex-1" />
              <span className="text-sm text-muted-foreground px-2">Basic Information</span>
              <div className="h-px bg-border flex-1" />
            </div>
            
            {/* Customer Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer_type">Customer Type *</Label>
              <Select
                value={formData.newCustomer.customer_type}
                onValueChange={(value: 'private' | 'company') => setFormData(prev => ({
                  ...prev,
                  newCustomer: { ...prev.newCustomer, customer_type: value }
                }))}
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
              {formData.newCustomer.customer_type === 'company' ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="customer-company-name" className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Company Name *
                    </Label>
                    <Input
                      id="customer-company-name"
                      value={formData.newCustomer.company_name}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        newCustomer: { ...prev.newCustomer, company_name: e.target.value }
                      }))}
                      placeholder="Enter company name"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer-contact-person" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Contact Person *
                    </Label>
                    <Input
                      id="customer-contact-person"
                      value={formData.newCustomer.contact_person}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        newCustomer: { ...prev.newCustomer, contact_person: e.target.value }
                      }))}
                      placeholder="Enter contact person name"
                      className="h-11"
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="customer-name" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Full Name *
                  </Label>
                  <Input
                    id="customer-name"
                    value={formData.newCustomer.name}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      newCustomer: { ...prev.newCustomer, name: e.target.value }
                    }))}
                    placeholder="Enter customer name"
                    className="h-11"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="customer-email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address *
                </Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={formData.newCustomer.email}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, email: e.target.value }
                  }))}
                  placeholder="Enter email address"
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customer-phone1" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Primary Phone
                </Label>
                <Input
                  id="customer-phone"
                  value={formData.newCustomer.phone}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, phone: e.target.value }
                  }))}
                  placeholder="Enter phone number"
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customer-phone2" className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Secondary Phone
                </Label>
                <Input
                  id="customer-phone2"
                  value={formData.newCustomer.phone2}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, phone2: e.target.value }
                  }))}
                  placeholder="Enter secondary phone number"
                  className="h-11"
                />
              </div>
              
              {formData.newCustomer.customer_type === 'private' && (
                <div className="space-y-2">
                  <Label htmlFor="customer-company" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Company Name
                  </Label>
                  <Input
                    id="customer-company"
                    value={formData.newCustomer.company_name}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      newCustomer: { ...prev.newCustomer, company_name: e.target.value }
                    }))}
                    placeholder="Enter company name (optional)"
                    className="h-11"
                  />
                </div>
              )}
              
              {formData.newCustomer.customer_type === 'company' && (
                <div className="space-y-2">
                  <Label htmlFor="customer-vat" className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    VAT Number
                  </Label>
                  <Input
                    id="customer-vat"
                    value={formData.newCustomer.vat_number}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      newCustomer: { ...prev.newCustomer, vat_number: e.target.value }
                    }))}
                    placeholder="Enter VAT number"
                    className="h-11"
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Address Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px bg-border flex-1" />
              <span className="text-sm text-muted-foreground px-2">Address Information</span>
              <div className="h-px bg-border flex-1" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-street" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Street Address
                </Label>
                <Input
                  id="customer-street"
                  value={formData.newCustomer.street_address}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, street_address: e.target.value }
                  }))}
                  placeholder="Enter street address"
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customer-city" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  City
                </Label>
                <Input
                  id="customer-city"
                  value={formData.newCustomer.city}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, city: e.target.value }
                  }))}
                  placeholder="Enter city"
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customer-postal" className="flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Postal Code
                </Label>
                <Input
                  id="customer-postal"
                  value={formData.newCustomer.postal_code}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, postal_code: e.target.value }
                  }))}
                  placeholder="Enter postal code"
                  className="h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customer-fax" className="flex items-center gap-2">
                  <Printer className="w-4 h-4" />
                  Fax Number
                </Label>
                <Input
                  id="customer-fax"
                  value={formData.newCustomer.fax}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, fax: e.target.value }
                  }))}
                  placeholder="Enter fax number"
                  className="h-11"
                />
              </div>
            </div>
            
          </div>
          
          {/* Additional Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px bg-border flex-1" />
              <span className="text-sm text-muted-foreground px-2">Additional Information</span>
              <div className="h-px bg-border flex-1" />
            </div>
            
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-owner" className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Owner/Assigned To
                </Label>
                <Select
                  value={formData.newCustomer.owner_id || ""}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, owner_id: value || undefined }
                  }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.name || user.email || `User ${user.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="customer-notes" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Ownership Notes
                </Label>
                <Textarea
                  id="customer-notes"
                  value={formData.newCustomer.ownership_notes}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    newCustomer: { ...prev.newCustomer, ownership_notes: e.target.value }
                  }))}
                  placeholder="Additional notes about customer ownership or assignment"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
          </div>
          
          <Button 
            className="w-full h-12" 
            onClick={createNewCustomer}
            disabled={isCreatingCustomer || 
              (formData.newCustomer.customer_type === 'company' 
                ? (!formData.newCustomer.company_name || !formData.newCustomer.contact_person || !formData.newCustomer.email)
                : (!formData.newCustomer.name || !formData.newCustomer.email)
              )}
          >
            {isCreatingCustomer ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Customer...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Customer & Continue
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )

  const renderMachineStep = () => (
    <div className="space-y-8">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-primary/10">
          <Wrench className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-2xl font-semibold">Select Machine</h3>
        <p className="text-muted-foreground">Choose the machine that needs warranty repair</p>
      </div>

      {/* Customer Info */}
      {formData.selectedCustomer && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{formData.selectedCustomer.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formData.selectedCustomer.company_name && `${formData.selectedCustomer.company_name} • `}
                  {formData.selectedCustomer.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Machine Type Selection */}
      <div className="grid grid-cols-2 gap-4">
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            formData.machineType === 'existing' && "ring-2 ring-primary"
          )}
          onClick={() => handleMachineTypeChange('existing')}
        >
          <CardContent className="p-6 text-center">
            <Wrench className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <h4 className="font-semibold mb-2">Existing Machine</h4>
            <p className="text-sm text-muted-foreground">Select from customer's machines</p>
          </CardContent>
        </Card>
        
        <Card 
          className={cn(
            "cursor-pointer transition-all hover:shadow-md",
            formData.machineType === 'new' && "ring-2 ring-primary"
          )}
          onClick={() => handleMachineTypeChange('new')}
        >
          <CardContent className="p-6 text-center">
            <Plus className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
            <h4 className="font-semibold mb-2">New Machine</h4>
            <p className="text-sm text-muted-foreground">Add a new machine to customer</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Machine Selection/Creation */}
      {formData.machineType === 'existing' ? (
        <div className="space-y-4">
          {!formData.selectedCustomer ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>No Customer Selected</AlertTitle>
              <AlertDescription>
                Please select a customer first to view their machines.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div>
                <Label className="text-base font-medium">Select Machine</Label>
                <p className="text-sm text-muted-foreground mb-4">Choose the machine that needs warranty repair</p>
              </div>
              
              {formData.selectedMachine && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        <Wrench className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-primary">{formData.selectedMachine.model_name || 'Unknown Model'}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {formData.selectedMachine.serial_number && (
                            <span className="flex items-center gap-1">
                              <Hash className="w-3 h-3" />
                              {formData.selectedMachine.serial_number}
                            </span>
                          )}
                          {formData.selectedMachine.manufacturer && (
                            <Badge variant="outline" className="text-xs">
                              {formData.selectedMachine.manufacturer}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFormData(prev => ({ ...prev, selectedMachine: null }))}
                        className="ml-auto"
                      >
                        Change
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Popover open={machinePopoverOpen} onOpenChange={setMachinePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={machinePopoverOpen}
                    className="w-full justify-between h-12"
                    disabled={!formData.selectedCustomer}
                  >
                    {formData.selectedMachine ? (
                      <div className="flex items-center gap-2">
                        <Wrench className="w-4 h-4" />
                        <span>{formData.selectedMachine.model_name || 'Unknown Model'}</span>
                        {formData.selectedMachine.serial_number && (
                          <Badge variant="secondary" className="ml-2">
                            {formData.selectedMachine.serial_number}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">
                        {formData.selectedCustomer ? "Select machine..." : "Select customer first"}
                      </span>
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <div className="border-b p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search machines by name or serial..."
                        className="pl-10"
                        value={machineSearchTerm}
                        onChange={(e) => setMachineSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {isLoadingMachines ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading machines...</span>
                      </div>
                    ) : machines.length === 0 ? (
                      <div className="p-4 text-center">
                        <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground mb-3">
                          No machines found for this customer.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setMachinePopoverOpen(false)
                            handleMachineTypeChange('new')
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add New Machine
                        </Button>
                      </div>
                    ) : (() => {
                      const filteredMachines = machines.filter((machine) => {
                        if (!machineSearchTerm) return true
                        const searchLower = machineSearchTerm.toLowerCase()
                        return (
                          (machine.model_name && machine.model_name.toLowerCase().includes(searchLower)) ||
                          (machine.serial_number && machine.serial_number.toLowerCase().includes(searchLower)) ||
                          (machine.manufacturer && machine.manufacturer.toLowerCase().includes(searchLower))
                        )
                      })
                      
                      return filteredMachines.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          No machines match your search.
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredMachines.map((machine) => (
                          <div
                            key={machine.id}
                            onClick={() => {
                              console.log('Machine selected:', machine.model_name, machine.serial_number)
                              setFormData(prev => ({ ...prev, selectedMachine: machine }))
                              setMachinePopoverOpen(false)
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                              formData.selectedMachine?.id === machine.id && "bg-accent"
                            )}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                formData.selectedMachine?.id === machine.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                              <Wrench className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{machine.model_name || 'Unknown Model'}</p>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {machine.serial_number && (
                                  <span className="flex items-center gap-1">
                                    <Hash className="w-3 h-3" />
                                    {machine.serial_number}
                                  </span>
                                )}
                                {machine.manufacturer && (
                                  <Badge variant="outline" className="text-xs">
                                    {machine.manufacturer}
                                  </Badge>
                                )}
                              </div>
                              {machine.purchase_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Purchased: {formatDate(machine.purchase_date)}
                                </p>
                              )}
                            </div>
                          </div>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <Label className="text-base font-medium">Add New Machine</Label>
            <p className="text-sm text-muted-foreground mb-4">Enter the machine details below</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="machine-model" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Machine Model *
              </Label>
              <Popover open={modelPopoverOpen} onOpenChange={setModelPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={modelPopoverOpen}
                    className="w-full justify-between h-11"
                  >
                    {formData.newMachine.model_id ? (
                      machineModels.find(m => m.id === formData.newMachine.model_id)?.name || "Select model..."
                    ) : (
                      "Select model..."
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <div className="border-b p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search models..."
                        className="pl-10"
                        onChange={(e) => {
                          // Simple search - we'll implement this if needed
                        }}
                      />
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {isLoadingModels ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading models...</span>
                      </div>
                    ) : machineModels.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">
                        No models found.
                      </div>
                    ) : (
                      <div className="p-1">
                        {machineModels.map((model) => (
                          <div
                            key={model.id}
                            onClick={() => {
                              console.log('Model selected:', model.name)
                              setFormData(prev => ({
                                ...prev,
                                newMachine: { ...prev.newMachine, model_id: model.id }
                              }))
                              setModelPopoverOpen(false)
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                              formData.newMachine.model_id === model.id && "bg-accent"
                            )}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                formData.newMachine.model_id === model.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                              <Package className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{model.name}</p>
                              {model.manufacturer && (
                                <p className="text-sm text-muted-foreground">{model.manufacturer}</p>
                              )}
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
              <Label htmlFor="serial-number" className="flex items-center gap-2">
                <Hash className="w-4 h-4" />
                Serial Number *
              </Label>
              <Input
                id="serial-number"
                value={formData.newMachine.serial_number}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  newMachine: { ...prev.newMachine, serial_number: e.target.value }
                }))}
                placeholder="Enter serial number"
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="purchase-date" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Purchase Date
              </Label>
              <Input
                id="purchase-date"
                type="date"
                value={formData.newMachine.purchase_date}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  newMachine: { ...prev.newMachine, purchase_date: e.target.value }
                }))}
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="purchased-at" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Purchased At
              </Label>
              <Popover open={purchasedAtPopoverOpen} onOpenChange={setPurchasedAtPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={purchasedAtPopoverOpen}
                    className="w-full justify-between h-11"
                  >
                    {formData.newMachine.purchased_at || "Select where purchased..."}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <div className="border-b p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search or type new shop name..."
                        className="pl-10"
                        value={purchasedAtSearch}
                        onChange={(e) => setPurchasedAtSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {/* Manual entry option */}
                    {purchasedAtSearch && !filteredPurchasedAtOptions.includes(purchasedAtSearch) && (
                      <div className="p-1 border-b">
                        <div
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              newMachine: { ...prev.newMachine, purchased_at: purchasedAtSearch }
                            }))
                            setPurchasedAtPopoverOpen(false)
                          }}
                          className="flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
                        >
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100">
                            <span className="text-green-600 text-sm font-bold">+</span>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">Add "{purchasedAtSearch}"</p>
                            <p className="text-sm text-muted-foreground">Create new shop</p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Existing options */}
                    {filteredPurchasedAtOptions.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">No options found.</div>
                    ) : (
                      <div className="p-1">
                        {filteredPurchasedAtOptions.map((option) => (
                          <div
                            key={option}
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                newMachine: { ...prev.newMachine, purchased_at: option }
                              }))
                              setPurchasedAtPopoverOpen(false)
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                              formData.newMachine.purchased_at === option && "bg-accent"
                            )}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                formData.newMachine.purchased_at === option ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1">
                              <p className="font-medium">{option}</p>
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
              <Label htmlFor="receipt-number" className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Receipt Number
              </Label>
              <Input
                id="receipt-number"
                value={formData.newMachine.receipt_number}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  newMachine: { ...prev.newMachine, receipt_number: e.target.value }
                }))}
                placeholder="Enter receipt number"
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sale-price" className="flex items-center gap-2">
                <Euro className="w-4 h-4" />
                Sale Price
              </Label>
              <Input
                id="sale-price"
                type="number"
                step="0.01"
                value={formData.newMachine.sale_price}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  newMachine: { ...prev.newMachine, sale_price: e.target.value }
                }))}
                placeholder="Enter sale price"
                className="h-11"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="machine-condition" className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Machine Condition
              </Label>
              <Select
                value={formData.newMachine.machine_condition}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  newMachine: { ...prev.newMachine, machine_condition: value }
                }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select condition..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="warranty-expiry" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Warranty Expiry Date
              </Label>
              <Input
                id="warranty-expiry"
                type="date"
                value={formData.newMachine.warranty_expiry_date}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  newMachine: { ...prev.newMachine, warranty_expiry_date: e.target.value }
                }))}
                className="h-11"
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Description
              </Label>
              <Textarea
                id="description"
                value={formData.newMachine.description}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  newMachine: { ...prev.newMachine, description: e.target.value }
                }))}
                placeholder="Enter machine description or notes..."
                className="min-h-[80px]"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <Dialog open={showNewModelDialog} onOpenChange={setShowNewModelDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Model
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Create New Machine Model
                  </DialogTitle>
                  <DialogDescription>
                    Add a new machine model to the database.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="model-name">Model Name *</Label>
                      <Input
                        id="model-name"
                        value={formData.newModel.name}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          newModel: { ...prev.newModel, name: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manufacturer">Manufacturer</Label>
                      <Input
                        id="manufacturer"
                        value={formData.newModel.manufacturer}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          newModel: { ...prev.newModel, manufacturer: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="catalogue-number">Catalogue Number</Label>
                      <Input
                        id="catalogue-number"
                        value={formData.newModel.catalogue_number}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          newModel: { ...prev.newModel, catalogue_number: e.target.value }
                        }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="warranty-months">Warranty (months)</Label>
                      <Input
                        id="warranty-months"
                        type="number"
                        value={formData.newModel.warranty_months}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          newModel: { ...prev.newModel, warranty_months: parseInt(e.target.value) || 12 }
                        }))}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewModelDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={createNewModel} 
                    disabled={isCreatingModel || !formData.newModel.name}
                  >
                    {isCreatingModel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Model
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showNewMachineDialog} onOpenChange={setShowNewMachineDialog}>
              <DialogTrigger asChild>
                <Button 
                  className="flex-1" 
                  disabled={!formData.newMachine.model_id || !formData.newMachine.serial_number}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Machine
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5" />
                    Add New Machine
                  </DialogTitle>
                  <DialogDescription>
                    Add this machine to the customer's profile.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-3">Machine Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Model:</span>
                          <span>{machineModels.find(m => m.id === formData.newMachine.model_id)?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Serial:</span>
                          <span>{formData.newMachine.serial_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Customer:</span>
                          <span>{formData.selectedCustomer?.name}</span>
                        </div>
                        {formData.newMachine.purchase_date && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Purchase Date:</span>
                            <span>{formatDate(formData.newMachine.purchase_date)}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowNewMachineDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createNewMachine} disabled={isCreatingMachine}>
                    {isCreatingMachine && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add Machine
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
    </div>
  )

  const renderDetailsStep = () => (
    <div className="space-y-8">
      {/* Step Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-primary/10">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-2xl font-semibold">Warranty Problem Details</h3>
        <p className="text-muted-foreground">Describe the warranty issue and provide additional information</p>
      </div>

      {/* Machine Info */}
      {formData.selectedMachine && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Wrench className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{formData.selectedMachine.model_name || 'Unknown Model'}</p>
                <p className="text-sm text-muted-foreground">
                  {formData.selectedMachine.manufacturer && `${formData.selectedMachine.manufacturer} • `}
                  Serial: {formData.selectedMachine.serial_number || 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="problem-description" className="flex items-center gap-2 text-base font-medium">
            <AlertTriangle className="w-4 h-4" />
            Warranty Problem Description *
          </Label>
          <p className="text-sm text-muted-foreground mb-3">
            Provide a detailed description of the warranty issue or problem with the machine
          </p>
          <Textarea
            id="problem-description"
            value={formData.ticketDetails.problem_description}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              ticketDetails: { ...prev.ticketDetails, problem_description: e.target.value }
            }))}
            placeholder="Describe the warranty problem in detail... What symptoms are you experiencing? When did the issue start? Any error messages?"
            rows={5}
            className="resize-none"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="brought-by" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Brought By
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Who brought the machine for warranty service?
            </p>
            <Input
              id="brought-by"
              value={formData.ticketDetails.brought_by}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                ticketDetails: { ...prev.ticketDetails, brought_by: e.target.value }
              }))}
              placeholder="Enter name or contact person"
              className="h-11"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="priority" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Priority
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              How urgent is this warranty repair request?
            </p>
            <Select
              value={formData.ticketDetails.priority}
              onValueChange={(value: 'low' | 'medium' | 'high') => setFormData(prev => ({
                ...prev,
                ticketDetails: { ...prev.ticketDetails, priority: value }
              }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Low
                    </Badge>
                    <span>Low Priority</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                      Medium
                    </Badge>
                    <span>Medium Priority</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      High
                    </Badge>
                    <span>High Priority</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="additional-equipment" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Additional Equipment
            </Label>
            <p className="text-sm text-muted-foreground mb-3">
              Any additional items brought with the machine?
            </p>
            <Textarea
              id="additional-equipment"
              value={formData.ticketDetails.additional_equipment}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                ticketDetails: { ...prev.ticketDetails, additional_equipment: e.target.value }
              }))}
              placeholder="List any cables, accessories, or other items..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="notes" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Additional Notes
          </Label>
          <p className="text-sm text-muted-foreground mb-3">
            Any additional information, special instructions, or observations
          </p>
          <Textarea
            id="notes"
            value={formData.ticketDetails.notes}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              ticketDetails: { ...prev.ticketDetails, notes: e.target.value }
            }))}
            placeholder="Any special instructions, previous repair history, or other relevant information..."
            rows={4}
            className="resize-none"
          />
        </div>
      </div>
    </div>
  )

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Review & Submit Warranty Ticket</h3>
      </div>
      
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p>{formData.selectedCustomer?.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p>{formData.selectedCustomer?.email || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Phone</p>
                <p>{formData.selectedCustomer?.phone1 || formData.selectedCustomer?.phone || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Company</p>
                <p>{formData.selectedCustomer?.company_name || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Machine Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Model</p>
                <p>{formData.selectedMachine?.model_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Manufacturer</p>
                <p>{formData.selectedMachine?.manufacturer || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Serial Number</p>
                <p>{formData.selectedMachine?.serial_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Purchase Date</p>
                <p>{formData.selectedMachine?.purchase_date 
                  ? formatDate(formData.selectedMachine.purchase_date)
                  : 'N/A'
                }</p>
              </div>
              {formData.machineType === 'new' && formData.newMachine.purchased_at && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Purchased At</p>
                  <p>{formData.newMachine.purchased_at}</p>
                </div>
              )}
              {formData.machineType === 'new' && formData.newMachine.sale_price && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sale Price</p>
                  <p>{formData.newMachine.sale_price} KM</p>
                </div>
              )}
              {formData.machineType === 'new' && formData.newMachine.machine_condition && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Condition</p>
                  <p className="capitalize">{formData.newMachine.machine_condition}</p>
                </div>
              )}
              {formData.machineType === 'new' && formData.newMachine.warranty_expiry_date && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Warranty Expiry</p>
                  <p>{formatDate(formData.newMachine.warranty_expiry_date)}</p>
                </div>
              )}
              {formData.machineType === 'new' && formData.newMachine.receipt_number && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Receipt Number</p>
                  <p>{formData.newMachine.receipt_number}</p>
                </div>
              )}
              {formData.machineType === 'new' && formData.newMachine.description && (
                <div className="col-span-2">
                  <p className="text-sm font-medium text-muted-foreground">Description</p>
                  <p className="whitespace-pre-wrap">{formData.newMachine.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Warranty Problem Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Problem Description</p>
                <p className="whitespace-pre-wrap">{formData.ticketDetails.problem_description}</p>
              </div>
              {formData.ticketDetails.notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Notes</p>
                  <p className="whitespace-pre-wrap">{formData.ticketDetails.notes}</p>
                </div>
              )}
              {formData.ticketDetails.additional_equipment && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Additional Equipment</p>
                  <p className="whitespace-pre-wrap">{formData.ticketDetails.additional_equipment}</p>
                </div>
              )}
              {formData.ticketDetails.brought_by && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Brought By</p>
                  <p>{formData.ticketDetails.brought_by}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Priority</p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={
                      formData.ticketDetails.priority === 'high' 
                        ? "bg-red-50 text-red-700 border-red-200" 
                        : formData.ticketDetails.priority === 'medium'
                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }
                  >
                    {formData.ticketDetails.priority.charAt(0).toUpperCase() + formData.ticketDetails.priority.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate(-1)} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create Warranty Repair Ticket</h1>
              <p className="text-muted-foreground">
                Create a new warranty repair ticket for customer service
              </p>
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Progress Steps */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                const isActive = index === currentStep
                const isCompleted = index < currentStep
                const isAccessible = index <= currentStep || isCompleted
                
                return (
                  <div key={step.id} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all ${
                        isActive 
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-110' 
                          : isCompleted 
                          ? 'border-green-500 bg-green-500 text-white'
                          : isAccessible
                          ? 'border-muted-foreground bg-background text-muted-foreground hover:border-primary/50'
                          : 'border-muted bg-muted text-muted-foreground'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="h-6 w-6" />
                        ) : (
                          <Icon className="h-6 w-6" />
                        )}
                      </div>
                      <div className="mt-3 text-center">
                        <p className={`text-sm font-medium ${
                          isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                        }`}>
                          {step.label}
                        </p>
                        <p className={`text-xs mt-1 ${
                          isActive ? 'text-primary/70' : 'text-muted-foreground'
                        }`}>
                          {step.description}
                        </p>
                      </div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-6 ${
                        isCompleted ? 'bg-green-500' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card>
          <CardContent className="pt-6">
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="h-12 px-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </div>
            {currentStep === STEPS.length - 1 ? (
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="h-12 px-8"
                size="lg"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Shield className="mr-2 h-4 w-4" />
                Create Warranty Repair Ticket
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!canProceed}
                className="h-12 px-8"
                size="lg"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
