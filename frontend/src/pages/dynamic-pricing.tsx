import React, { useState, useEffect } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'
import { Textarea } from '../components/ui/textarea'
import { apiService } from '../services/api'
import { formatCurrency } from '../lib/currency'
import { formatDate } from '../lib/dateTime'
import { 
  DollarSign, 
  Settings, 
  Users, 
  TrendingUp, 
  Calculator,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  Target,
  Clock
} from 'lucide-react'

interface PricingRule {
  id: number
  name: string
  description: string
  rule_type: string
  is_active: boolean
  priority: number
  conditions: any
  adjustments: any
  created_by_name?: string
}

interface CustomerTier {
  id: number
  name: string
  description: string
  discount_percentage: number
  minimum_rentals: number
  minimum_total_spent: number
  is_active: boolean
}

interface BasePricing {
  id: number
  rental_machine_id: number
  base_price_daily: number
  base_price_weekly?: number
  base_price_monthly?: number
  minimum_rental_days: number
  maximum_rental_days?: number
  currency: string
  machine_name: string
  manufacturer: string
  serial_number: string
}

export default function DynamicPricing() {
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([])
  const [customerTiers, setCustomerTiers] = useState<CustomerTier[]>([])
  const [basePricing, setBasePricing] = useState<BasePricing[]>([])
  const [rentalMachines, setRentalMachines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false)
  const [isPricingDialogOpen, setIsPricingDialogOpen] = useState(false)
  const [isSimulationDialogOpen, setIsSimulationDialogOpen] = useState(false)
  const [isTierDialogOpen, setIsTierDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null)
  const [editingPricing, setEditingPricing] = useState<BasePricing | null>(null)
  const [editingTier, setEditingTier] = useState<CustomerTier | null>(null)

  // Form states
  const [ruleForm, setRuleForm] = useState({
    name: '',
    description: '',
    rule_type: 'demand',
    is_active: true,
    priority: 1,
    conditions: {},
    adjustments: {}
  })

  const [pricingForm, setPricingForm] = useState({
    rental_machine_id: '',
    base_price_daily: '',
    base_price_weekly: '',
    base_price_monthly: '',
    minimum_rental_days: '1',
    maximum_rental_days: '',
    currency: 'KM'
  })

  const [simulationForm, setSimulationForm] = useState({
    rental_machine_id: '',
    scenarios: [
      { name: 'Standard', start_date: '', end_date: '', customer_id: '' },
      { name: 'High Demand', start_date: '', end_date: '', customer_id: '' }
    ]
  })

  const [tierForm, setTierForm] = useState({
    name: '',
    description: '',
    discount_percentage: '',
    minimum_rentals: '0',
    minimum_total_spent: '0',
    is_active: true
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [rules, tiers, pricing, machines] = await Promise.all([
        apiService.getPricingRules(),
        apiService.getCustomerTiers(),
        fetchBasePricing(),
        fetchRentalMachines()
      ])
      
      setPricingRules(rules || [])
      setCustomerTiers(tiers || [])
      setBasePricing(pricing || [])
      setRentalMachines(Array.isArray(machines) ? machines : [])
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load pricing data')
    } finally {
      setLoading(false)
    }
  }

  const fetchBasePricing = async () => {
    try {
      const response = await apiService.getAllBasePricing()
      return response || []
    } catch (error) {
      console.error('Error fetching base pricing:', error)
      return []
    }
  }

  const fetchRentalMachines = async () => {
    try {
      const response = await apiService.getRentalMachines()
      
      // Handle different response formats
      if (Array.isArray(response)) {
        return response
      } else if (response && Array.isArray(response.data)) {
        return response.data
      } else if (response && Array.isArray(response.rental_machines)) {
        return response.rental_machines
      } else if (response && Array.isArray(response.machines)) {
        return response.machines
      } else {
        console.warn('Unexpected response format for rental machines:', response)
        return []
      }
    } catch (error) {
      console.error('Error fetching rental machines:', error)
      return []
    }
  }

  const handleCreateRule = async () => {
    try {
      await apiService.createPricingRule(ruleForm)
      setIsRuleDialogOpen(false)
      resetRuleForm()
      fetchData()
    } catch (error) {
      console.error('Error creating pricing rule:', error)
      setError('Failed to create pricing rule')
    }
  }

  const handleUpdateRule = async () => {
    if (!editingRule) return
    
    try {
      await apiService.updatePricingRule(editingRule.id.toString(), ruleForm)
      setIsRuleDialogOpen(false)
      setEditingRule(null)
      resetRuleForm()
      fetchData()
    } catch (error) {
      console.error('Error updating pricing rule:', error)
      setError('Failed to update pricing rule')
    }
  }

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return
    
    try {
      await apiService.deletePricingRule(ruleId.toString())
      fetchData()
    } catch (error) {
      console.error('Error deleting pricing rule:', error)
      setError('Failed to delete pricing rule')
    }
  }

  const handleCreatePricing = async () => {
    if (!pricingForm.rental_machine_id || !pricingForm.base_price_daily) {
      setError('Please select a machine and enter a daily price')
      return
    }
    
    try {
      // Convert empty strings to null for optional fields
      const cleanedData = {
        ...pricingForm,
        base_price_weekly: pricingForm.base_price_weekly || null,
        base_price_monthly: pricingForm.base_price_monthly || null,
        minimum_rental_days: pricingForm.minimum_rental_days || null,
        maximum_rental_days: pricingForm.maximum_rental_days || null,
        currency: pricingForm.currency || 'KM'
      }
      
      await apiService.setBasePricing(cleanedData.rental_machine_id, cleanedData)
      setIsPricingDialogOpen(false)
      resetPricingForm()
      fetchData()
    } catch (error) {
      console.error('Error creating base pricing:', error)
      if (error.message && error.message.includes('Validation failed')) {
        // Try to get specific validation errors from the response
        try {
          const errorData = JSON.parse(error.message)
          if (errorData.errors && errorData.errors.length > 0) {
            const errorMessages = errorData.errors.map((err: any) => err.msg).join(', ')
            setError(`Validation failed: ${errorMessages}`)
          } else {
            setError('Please check all required fields are filled correctly')
          }
        } catch {
          setError('Please check all required fields are filled correctly')
        }
      } else {
        setError('Failed to create base pricing')
      }
    }
  }

  const handleUpdatePricing = async () => {
    if (!editingPricing) return
    
    try {
      // Convert empty strings to null for optional fields
      const cleanedData = {
        ...pricingForm,
        base_price_weekly: pricingForm.base_price_weekly || null,
        base_price_monthly: pricingForm.base_price_monthly || null,
        minimum_rental_days: pricingForm.minimum_rental_days || null,
        maximum_rental_days: pricingForm.maximum_rental_days || null,
        currency: pricingForm.currency || 'KM'
      }
      
      await apiService.setBasePricing(editingPricing.rental_machine_id.toString(), cleanedData)
      setIsPricingDialogOpen(false)
      setEditingPricing(null)
      resetPricingForm()
      fetchData()
    } catch (error) {
      console.error('Error updating base pricing:', error)
      if (error.message && error.message.includes('Validation failed')) {
        setError('Please check all required fields are filled correctly')
      } else {
        setError('Failed to update base pricing')
      }
    }
  }

  const handleRunSimulation = async () => {
    try {
      const results = await apiService.runPricingSimulation(
        simulationForm.rental_machine_id,
        simulationForm.scenarios
      )
      console.log('Simulation results:', results)
      // Display results in a dialog or table
    } catch (error) {
      console.error('Error running simulation:', error)
      setError('Failed to run pricing simulation')
    }
  }

  const handleCreateTier = async () => {
    try {
      await apiService.createCustomerTier(tierForm)
      setIsTierDialogOpen(false)
      resetTierForm()
      fetchData()
    } catch (error) {
      console.error('Error creating customer tier:', error)
      setError('Failed to create customer tier')
    }
  }

  const handleUpdateTier = async () => {
    if (!editingTier) return
    
    try {
      await apiService.updateCustomerTier(editingTier.id.toString(), tierForm)
      setIsTierDialogOpen(false)
      setEditingTier(null)
      resetTierForm()
      fetchData()
    } catch (error) {
      console.error('Error updating customer tier:', error)
      setError('Failed to update customer tier')
    }
  }

  const handleDeleteTier = async (tierId: number) => {
    if (!confirm('Are you sure you want to delete this customer tier?')) return
    
    try {
      await apiService.deleteCustomerTier(tierId.toString())
      fetchData()
    } catch (error) {
      console.error('Error deleting customer tier:', error)
      setError('Failed to delete customer tier')
    }
  }

  const handleDeletePricing = async (pricingId: number) => {
    if (!confirm('Are you sure you want to delete this base pricing?')) return
    
    try {
      // Note: We'll need to add a delete endpoint for base pricing
      // For now, we'll just show an error message
      setError('Delete functionality for base pricing not yet implemented')
    } catch (error) {
      console.error('Error deleting base pricing:', error)
      setError('Failed to delete base pricing')
    }
  }

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      description: '',
      rule_type: 'demand',
      is_active: true,
      priority: 1,
      conditions: {},
      adjustments: {}
    })
  }

  const resetPricingForm = () => {
    setPricingForm({
      rental_machine_id: '',
      base_price_daily: '',
      base_price_weekly: '',
      base_price_monthly: '',
      minimum_rental_days: '1',
      maximum_rental_days: '',
      currency: 'KM'
    })
  }

  const resetTierForm = () => {
    setTierForm({
      name: '',
      description: '',
      discount_percentage: '',
      minimum_rentals: '0',
      minimum_total_spent: '0',
      is_active: true
    })
  }

  const openEditRule = (rule: PricingRule) => {
    setEditingRule(rule)
    setRuleForm({
      name: rule.name,
      description: rule.description,
      rule_type: rule.rule_type,
      is_active: rule.is_active,
      priority: rule.priority,
      conditions: rule.conditions,
      adjustments: rule.adjustments
    })
    setIsRuleDialogOpen(true)
  }

  const openEditPricing = (pricing: BasePricing) => {
    setEditingPricing(pricing)
    setPricingForm({
      rental_machine_id: pricing.rental_machine_id.toString(),
      base_price_daily: pricing.base_price_daily.toString(),
      base_price_weekly: pricing.base_price_weekly?.toString() || '',
      base_price_monthly: pricing.base_price_monthly?.toString() || '',
      minimum_rental_days: pricing.minimum_rental_days.toString(),
      maximum_rental_days: pricing.maximum_rental_days?.toString() || '',
      currency: pricing.currency
    })
    setIsPricingDialogOpen(true)
  }

  const openEditTier = (tier: CustomerTier) => {
    setEditingTier(tier)
    setTierForm({
      name: tier.name,
      description: tier.description,
      discount_percentage: tier.discount_percentage.toString(),
      minimum_rentals: tier.minimum_rentals.toString(),
      minimum_total_spent: tier.minimum_total_spent.toString(),
      is_active: tier.is_active
    })
    setIsTierDialogOpen(true)
  }

  const getRuleTypeColor = (type: string) => {
    const colors = {
      demand: 'bg-blue-100 text-blue-800',
      seasonal: 'bg-green-100 text-green-800',
      availability: 'bg-yellow-100 text-yellow-800',
      customer_tier: 'bg-purple-100 text-purple-800',
      duration: 'bg-orange-100 text-orange-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading pricing data...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dynamic Pricing</h1>
            <p className="text-gray-600 mt-1">Manage pricing rules, customer tiers, and base pricing</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button onClick={() => setIsSimulationDialogOpen(true)} variant="outline">
              <Calculator className="h-4 w-4 mr-2" />
              Pricing Simulation
            </Button>
            <Button onClick={fetchData} variant="outline">
              <TrendingUp className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <Tabs defaultValue="rules" className="space-y-6">
          <TabsList>
            <TabsTrigger value="rules">Pricing Rules</TabsTrigger>
            <TabsTrigger value="tiers">Customer Tiers</TabsTrigger>
            <TabsTrigger value="pricing">Base Pricing</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Pricing Rules Tab */}
          <TabsContent value="rules" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pricing Rules</CardTitle>
                <Button onClick={() => setIsRuleDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pricingRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{rule.name}</div>
                            <div className="text-sm text-gray-500">{rule.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRuleTypeColor(rule.rule_type)}>
                            {rule.rule_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{rule.priority}</TableCell>
                        <TableCell>
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditRule(rule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteRule(rule.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Customer Tiers Tab */}
          <TabsContent value="tiers" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Customer Pricing Tiers</CardTitle>
                <Button onClick={() => setIsTierDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tier
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier Name</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Min Rentals</TableHead>
                      <TableHead>Min Spent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerTiers.map((tier) => (
                      <TableRow key={tier.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{tier.name}</div>
                            <div className="text-sm text-gray-500">{tier.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-green-600">
                            {tier.discount_percentage}%
                          </span>
                        </TableCell>
                        <TableCell>{tier.minimum_rentals}</TableCell>
                        <TableCell>{formatCurrency(tier.minimum_total_spent)}</TableCell>
                        <TableCell>
                          <Badge variant={tier.is_active ? 'default' : 'secondary'}>
                            {tier.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditTier(tier)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteTier(tier.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Base Pricing Tab */}
          <TabsContent value="pricing" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Machine Base Pricing</CardTitle>
                <Button onClick={() => setIsPricingDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Base Pricing
                </Button>
              </CardHeader>
              <CardContent>
                {basePricing.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Base Pricing Set</h3>
                    <p className="text-gray-600 mb-4">
                      Base pricing is the foundation of the dynamic pricing system. Set base prices for each rental machine.
                    </p>
                    <Button onClick={() => setIsPricingDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Base Pricing
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Machine</TableHead>
                        <TableHead>Daily Price</TableHead>
                        <TableHead>Weekly Price</TableHead>
                        <TableHead>Monthly Price</TableHead>
                        <TableHead>Min Days</TableHead>
                        <TableHead>Max Days</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {basePricing.map((pricing) => (
                        <TableRow key={pricing.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{pricing.manufacturer} {pricing.machine_name}</div>
                              <div className="text-sm text-gray-500">{pricing.serial_number}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold">{formatCurrency(pricing.base_price_daily)}</span>
                          </TableCell>
                          <TableCell>
                            {pricing.base_price_weekly ? formatCurrency(pricing.base_price_weekly) : '-'}
                          </TableCell>
                          <TableCell>
                            {pricing.base_price_monthly ? formatCurrency(pricing.base_price_monthly) : '-'}
                          </TableCell>
                          <TableCell>{pricing.minimum_rental_days}</TableCell>
                          <TableCell>{pricing.maximum_rental_days || '∞'}</TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditPricing(pricing)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeletePricing(pricing.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pricingRules.filter(r => r.is_active).length}</div>
                  <p className="text-xs text-muted-foreground">
                    {pricingRules.length} total rules
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Customer Tiers</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{customerTiers.filter(t => t.is_active).length}</div>
                  <p className="text-xs text-muted-foreground">
                    Active pricing tiers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Priced Machines</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{basePricing.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Machines with base pricing
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Pricing Rule Dialog */}
        <Dialog open={isRuleDialogOpen} onOpenChange={setIsRuleDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? 'Edit Pricing Rule' : 'Create Pricing Rule'}
              </DialogTitle>
              <DialogDescription>
                Configure pricing rules that automatically adjust rental prices based on conditions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Rule Name</Label>
                  <Input
                    id="name"
                    value={ruleForm.name}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter rule name"
                  />
                </div>
                <div>
                  <Label htmlFor="rule_type">Rule Type</Label>
                  <Select value={ruleForm.rule_type} onValueChange={(value) => setRuleForm(prev => ({ ...prev, rule_type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demand">Demand-based</SelectItem>
                      <SelectItem value="seasonal">Seasonal</SelectItem>
                      <SelectItem value="availability">Availability</SelectItem>
                      <SelectItem value="customer_tier">Customer Tier</SelectItem>
                      <SelectItem value="duration">Duration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={ruleForm.description}
                  onChange={(e) => setRuleForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter rule description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={ruleForm.priority}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) }))}
                    min="1"
                    max="10"
                  />
                </div>
                <div className="flex items-center space-x-2 mt-6">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={ruleForm.is_active}
                    onChange={(e) => setRuleForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsRuleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingRule ? handleUpdateRule : handleCreateRule}>
                  {editingRule ? 'Update' : 'Create'} Rule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Base Pricing Dialog */}
        <Dialog open={isPricingDialogOpen} onOpenChange={setIsPricingDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPricing ? 'Edit Base Pricing' : 'Add Base Pricing'}
              </DialogTitle>
              <DialogDescription>
                {editingPricing 
                  ? `Configure base pricing for ${editingPricing.manufacturer} ${editingPricing.machine_name}`
                  : 'Set base pricing for a rental machine. This is the foundation price before any dynamic adjustments.'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {!editingPricing && (
                <div>
                  <Label htmlFor="rental_machine_id">Rental Machine</Label>
                  <Select 
                    value={pricingForm.rental_machine_id} 
                    onValueChange={(value) => setPricingForm(prev => ({ ...prev, rental_machine_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a rental machine" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(rentalMachines) && rentalMachines.length > 0 ? (
                        rentalMachines.map((machine) => (
                          <SelectItem key={machine.id} value={machine.id.toString()}>
                            {machine.manufacturer} {machine.model_name} - {machine.serial_number}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-machines" disabled>
                          No rental machines available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_price_daily">Daily Price *</Label>
                  <Input
                    id="base_price_daily"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingForm.base_price_daily}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, base_price_daily: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="base_price_weekly">Weekly Price</Label>
                  <Input
                    id="base_price_weekly"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingForm.base_price_weekly}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, base_price_weekly: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="base_price_monthly">Monthly Price</Label>
                  <Input
                    id="base_price_monthly"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingForm.base_price_monthly}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, base_price_monthly: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={pricingForm.currency} onValueChange={(value) => setPricingForm(prev => ({ ...prev, currency: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KM">KM</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minimum_rental_days">Minimum Rental Days</Label>
                  <Input
                    id="minimum_rental_days"
                    type="number"
                    min="1"
                    value={pricingForm.minimum_rental_days}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, minimum_rental_days: e.target.value }))}
                    placeholder="1"
                  />
                </div>
                <div>
                  <Label htmlFor="maximum_rental_days">Maximum Rental Days</Label>
                  <Input
                    id="maximum_rental_days"
                    type="number"
                    min="1"
                    value={pricingForm.maximum_rental_days}
                    onChange={(e) => setPricingForm(prev => ({ ...prev, maximum_rental_days: e.target.value }))}
                    placeholder="Leave empty for no limit"
                  />
                </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">How Base Pricing Works:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Base pricing is the foundation for all dynamic pricing calculations</li>
                  <li>• Pricing rules (demand, seasonal, etc.) are applied as multipliers to base prices</li>
                  <li>• Customer tier discounts are applied as percentage reductions</li>
                  <li>• Final price = Base Price × Rule Multipliers × (1 - Customer Discount)</li>
                </ul>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsPricingDialogOpen(false)
                  setEditingPricing(null)
                  resetPricingForm()
                }}>
                  Cancel
                </Button>
                <Button onClick={editingPricing ? handleUpdatePricing : handleCreatePricing}>
                  {editingPricing ? 'Update' : 'Create'} Pricing
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pricing Simulation Dialog */}
        <Dialog open={isSimulationDialogOpen} onOpenChange={setIsSimulationDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Pricing Simulation</DialogTitle>
              <DialogDescription>
                Test different pricing scenarios to see how rules affect final prices.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="rental_machine_id">Rental Machine ID</Label>
                <Input
                  id="rental_machine_id"
                  value={simulationForm.rental_machine_id}
                  onChange={(e) => setSimulationForm(prev => ({ ...prev, rental_machine_id: e.target.value }))}
                  placeholder="Enter machine ID"
                />
              </div>
              <div className="space-y-2">
                <Label>Scenarios</Label>
                {simulationForm.scenarios.map((scenario, index) => (
                  <div key={index} className="grid grid-cols-4 gap-2 p-3 border rounded">
                    <Input
                      placeholder="Scenario name"
                      value={scenario.name}
                      onChange={(e) => {
                        const newScenarios = [...simulationForm.scenarios]
                        newScenarios[index].name = e.target.value
                        setSimulationForm(prev => ({ ...prev, scenarios: newScenarios }))
                      }}
                    />
                    <Input
                      type="date"
                      value={scenario.start_date}
                      onChange={(e) => {
                        const newScenarios = [...simulationForm.scenarios]
                        newScenarios[index].start_date = e.target.value
                        setSimulationForm(prev => ({ ...prev, scenarios: newScenarios }))
                      }}
                    />
                    <Input
                      type="date"
                      value={scenario.end_date}
                      onChange={(e) => {
                        const newScenarios = [...simulationForm.scenarios]
                        newScenarios[index].end_date = e.target.value
                        setSimulationForm(prev => ({ ...prev, scenarios: newScenarios }))
                      }}
                    />
                    <Input
                      placeholder="Customer ID (optional)"
                      value={scenario.customer_id}
                      onChange={(e) => {
                        const newScenarios = [...simulationForm.scenarios]
                        newScenarios[index].customer_id = e.target.value
                        setSimulationForm(prev => ({ ...prev, scenarios: newScenarios }))
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsSimulationDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRunSimulation}>
                  Run Simulation
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Customer Tier Dialog */}
        <Dialog open={isTierDialogOpen} onOpenChange={setIsTierDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTier ? 'Edit Customer Tier' : 'Create Customer Tier'}
              </DialogTitle>
              <DialogDescription>
                Configure customer pricing tiers with discount levels and qualification requirements.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tier_name">Tier Name</Label>
                  <Input
                    id="tier_name"
                    value={tierForm.name}
                    onChange={(e) => setTierForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter tier name"
                  />
                </div>
                <div>
                  <Label htmlFor="discount_percentage">Discount Percentage</Label>
                  <Input
                    id="discount_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={tierForm.discount_percentage}
                    onChange={(e) => setTierForm(prev => ({ ...prev, discount_percentage: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="tier_description">Description</Label>
                <Textarea
                  id="tier_description"
                  value={tierForm.description}
                  onChange={(e) => setTierForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter tier description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minimum_rentals">Minimum Rentals</Label>
                  <Input
                    id="minimum_rentals"
                    type="number"
                    min="0"
                    value={tierForm.minimum_rentals}
                    onChange={(e) => setTierForm(prev => ({ ...prev, minimum_rentals: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="minimum_total_spent">Minimum Total Spent</Label>
                  <Input
                    id="minimum_total_spent"
                    type="number"
                    step="0.01"
                    min="0"
                    value={tierForm.minimum_total_spent}
                    onChange={(e) => setTierForm(prev => ({ ...prev, minimum_total_spent: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="tier_is_active"
                  checked={tierForm.is_active}
                  onChange={(e) => setTierForm(prev => ({ ...prev, is_active: e.target.checked }))}
                />
                <Label htmlFor="tier_is_active">Active</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsTierDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={editingTier ? handleUpdateTier : handleCreateTier}>
                  {editingTier ? 'Update' : 'Create'} Tier
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
