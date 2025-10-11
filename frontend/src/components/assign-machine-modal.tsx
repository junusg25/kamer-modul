import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { Loader2, Calendar, User, Package, Check, Search, ChevronDown } from 'lucide-react'
import { apiService } from '@/services/api'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/dateTime'
import { formatCurrency } from '@/lib/currency'

interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  company_name?: string
}


interface AssignMachineModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  modelId: string
  modelName: string
  warrantyMonths: number
}

export function AssignMachineModal({
  isOpen,
  onClose,
  onSuccess,
  modelId,
  modelName,
  warrantyMonths
}: AssignMachineModalProps) {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Form state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [serialNumber, setSerialNumber] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [salePrice, setSalePrice] = useState('')
  const [receiptNumber, setReceiptNumber] = useState('')
  const [machineCondition, setMachineCondition] = useState('new')
  const [description, setDescription] = useState('')
  const [purchasedAt, setPurchasedAt] = useState('')
  
  // Search states
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false)
  const [purchasedAtSearch, setPurchasedAtSearch] = useState('')
  const [purchasedAtPopoverOpen, setPurchasedAtPopoverOpen] = useState(false)

  // Calculate warranty expiry date
  const calculateWarrantyExpiry = (purchaseDate: string) => {
    if (!purchaseDate) return ''
    const date = new Date(purchaseDate)
    date.setMonth(date.getMonth() + warrantyMonths)
    return date.toISOString().split('T')[0]
  }

  const warrantyExpiryDate = calculateWarrantyExpiry(purchaseDate)

  // Predefined purchased_at options
  const [purchasedAtOptions, setPurchasedAtOptions] = useState<string[]>(['AMS', 'Kamer.ba'])
  const [customPurchasedAt, setCustomPurchasedAt] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchCustomers()
      fetchPurchasedAtOptions()
    }
  }, [isOpen])

  const fetchCustomers = async () => {
    setIsLoading(true)
    setError('')
    
    try {
      const customersResponse = await apiService.getCustomers()
      const customersData = customersResponse.data || customersResponse
      setCustomers(Array.isArray(customersData) ? customersData : [])
    } catch (err) {
      setError('Failed to load customers')
      console.error('Error fetching customers:', err)
    } finally {
      setIsLoading(false)
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

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (customer.email && customer.email.toLowerCase().includes(customerSearch.toLowerCase())) ||
    (customer.company_name && customer.company_name.toLowerCase().includes(customerSearch.toLowerCase()))
  )

  const filteredPurchasedAtOptions = purchasedAtOptions.filter(option =>
    option.toLowerCase().includes(purchasedAtSearch.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedCustomer || !serialNumber.trim()) {
      setError('Please select a customer and enter a serial number')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const assignmentData = {
        serial_number: serialNumber.trim(),
        model_id: parseInt(modelId),
        customer_id: parseInt(selectedCustomer.id),
        purchase_date: purchaseDate,
        warranty_expiry_date: warrantyExpiryDate,
        sale_price: salePrice ? parseFloat(salePrice) : undefined,
        receipt_number: receiptNumber || undefined,
        machine_condition: machineCondition,
        description: description || undefined,
        purchased_at: purchasedAt || undefined,
        sold_by_user_id: user?.id ? parseInt(user.id) : undefined,
        added_by_user_id: user?.id ? parseInt(user.id) : undefined,
        is_sale: !!salePrice,
        sale_date: purchaseDate
      }

      await apiService.createAssignedMachine(assignmentData)
      
      onSuccess()
      onClose()
      resetForm()
    } catch (err) {
      setError('Failed to assign machine')
      console.error('Error assigning machine:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setSelectedCustomer(null)
    setSerialNumber('')
    setPurchaseDate(new Date().toISOString().split('T')[0])
    setSalePrice('')
    setReceiptNumber('')
    setMachineCondition('new')
    setDescription('')
    setPurchasedAt('')
    setCustomPurchasedAt('')
    setCustomerSearch('')
    setCustomerPopoverOpen(false)
    setPurchasedAtSearch('')
    setPurchasedAtPopoverOpen(false)
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="assign-machine-description">
        <DialogHeader>
          <DialogTitle>Assign Machine - {modelName}</DialogTitle>
          <DialogDescription id="assign-machine-description">
            Assign a serial number of this model to a customer.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading data...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Customer Selection */}
            <div className="space-y-2">
              <Label htmlFor="customer">Customer *</Label>
              <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerPopoverOpen}
                    className="w-full justify-between"
                    disabled={isSubmitting}
                  >
                    {selectedCustomer ? (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>{selectedCustomer.name}</span>
                        {selectedCustomer.company_name && (
                          <Badge variant="secondary">{selectedCustomer.company_name}</Badge>
                        )}
                      </div>
                    ) : (
                      "Select customer..."
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <div className="border-b p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search customers..."
                        className="pl-10"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Loading customers...</span>
                      </div>
                    ) : filteredCustomers.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">No customers found.</div>
                    ) : (
                      <div className="p-1">
                        {filteredCustomers.map((customer) => (
                          <div
                            key={customer.id}
                            onClick={() => {
                              setSelectedCustomer(customer)
                              setCustomerPopoverOpen(false)
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                              selectedCustomer?.id === customer.id && "bg-accent"
                            )}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{customer.name}</p>
                              {customer.company_name && (
                                <p className="text-sm text-muted-foreground">{customer.company_name}</p>
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

            {/* Serial Number Input */}
            <div className="space-y-2">
              <Label htmlFor="serialNumber">Serial Number *</Label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="serialNumber"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting}
                  placeholder="Enter serial number..."
                  required
                />
              </div>
            </div>

            {/* Purchase Date */}
            <div className="space-y-2">
              <Label htmlFor="purchaseDate">Purchase Date *</Label>
              <DatePicker
                value={purchaseDate}
                onChange={(value) => setPurchaseDate(value)}
                placeholder="Select purchase date"
                disabled={isSubmitting}
              />
            </div>

            {/* Machine Condition */}
            <div className="space-y-2">
              <Label htmlFor="condition">Machine Condition</Label>
              <Select value={machineCondition} onValueChange={setMachineCondition} disabled={isSubmitting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="refurbished">Refurbished</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sale Price */}
            <div className="space-y-2">
              <Label htmlFor="salePrice">Sale Price (KM)</Label>
              <Input
                id="salePrice"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                disabled={isSubmitting}
                placeholder="0.00 KM"
              />
            </div>

            {/* Receipt Number */}
            <div className="space-y-2">
              <Label htmlFor="receiptNumber">Receipt Number</Label>
              <Input
                id="receiptNumber"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                disabled={isSubmitting}
                placeholder="Enter receipt number..."
              />
            </div>

            {/* Purchased At */}
            <div className="space-y-2">
              <Label htmlFor="purchasedAt">Purchased At</Label>
              <Popover open={purchasedAtPopoverOpen} onOpenChange={setPurchasedAtPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={purchasedAtPopoverOpen}
                    className="w-full justify-between"
                    disabled={isSubmitting}
                  >
                    {purchasedAt ? (
                      <span>{purchasedAt}</span>
                    ) : (
                      "Select where purchased..."
                    )}
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
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
                            setPurchasedAt(purchasedAtSearch)
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
                              setPurchasedAt(option)
                              setPurchasedAtPopoverOpen(false)
                            }}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors",
                              purchasedAt === option && "bg-accent"
                            )}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4",
                                purchasedAt === option ? "opacity-100" : "opacity-0"
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

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isSubmitting}
                placeholder="Enter description..."
              />
            </div>

            {/* Warranty Information */}
            {warrantyExpiryDate && (
              <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
                <div className="flex items-center space-x-2">
                  <Check className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-800">Warranty Information</span>
                </div>
                <div className="mt-1 text-sm text-orange-700">
                  <div>Warranty Period: {warrantyMonths} months</div>
                  <div>Warranty Expires: {formatDate(warrantyExpiryDate)}</div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedCustomer || !serialNumber.trim()}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Machine'
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
