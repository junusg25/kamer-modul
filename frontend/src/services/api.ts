import { toast } from 'sonner'
import { API_BASE_URL } from '../config/api'

class ApiService {
  private logoutCallback: (() => void) | null = null

  // Method to set the logout callback from auth context
  setLogoutCallback(callback: () => void) {
    this.logoutCallback = callback
  }

  // Helper function to show session expired notification
  private showSessionExpiredNotification() {
    toast.error('Session Expired', {
      description: 'Your session has expired. Please log in again.',
      duration: 5000
    })
  }

  private getAuthHeaders() {
    const token = localStorage.getItem('token')
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    const config: RequestInit = {
      headers: this.getAuthHeaders(),
      ...options,
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        // Check for authentication errors
        if (response.status === 401 || response.status === 403) {
          // Token is expired or invalid, trigger automatic logout
          
          
          // Show session expired notification
          this.showSessionExpiredNotification()
          
          if (this.logoutCallback) {
            this.logoutCallback()
          }
          // Redirect to login page
          window.location.href = '/login'
          throw new Error('Session expired. Please log in again.')
        }

        const errorText = await response.text()
        let errorMessage = `HTTP error! status: ${response.status}`
        
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.message || errorMessage
        } catch {
          // If response is not JSON, use the text or default message
          errorMessage = errorText || errorMessage
        }
        
        throw new Error(errorMessage)
      }

      const responseText = await response.text()
      
      // Handle empty responses
      if (!responseText.trim()) {
        return {} as T
      }
      
      return JSON.parse(responseText)
    } catch (error) {
      console.error('API request failed:', error)
      
      // If it's a network error (backend not running), return mock data
      if (error instanceof TypeError && error.message.includes('fetch')) {
        
        return this.getMockData<T>(endpoint)
      }
      
      // Re-throw authentication errors
      if (error instanceof Error && error.message.includes('Session expired')) {
        throw error
      }
      
      throw error
    }
  }

  private getMockData<T>(endpoint: string): T {
    // Return mock data based on endpoint
    if (endpoint.includes('/customers')) {
      return {
        customers: [
          {
            id: '1',
            name: 'John Doe',
            email: 'john.doe@example.com',
            phone: '123-456-7890',
            address: '123 Main St, Anytown, USA',
            status: 'active',
            company: 'ABC Corp',
            location: 'New York',
            machines: 3,
            lastService: '2024-01-15'
          },
          {
            id: '2',
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            phone: '098-765-4321',
            address: '456 Oak Ave, Anytown, USA',
            status: 'lead',
            company: 'Tech Solutions',
            location: 'California',
            machines: 1,
            lastService: '2024-01-10'
          }
        ]
      } as T
    }
    
    // Sales Dashboard mock data
    if (endpoint.includes('/sales/metrics')) {
      return {
        totalRevenue: 125000,
        totalLeads: 45,
        conversionRate: 23.5,
        averageDealSize: 5500,
        monthlyGrowth: 12.3,
        quarterlyTarget: 150000,
        quarterlyProgress: 83.3
      } as T
    }
    
    if (endpoint.includes('/sales/opportunities')) {
      return {
        opportunities: [
          {
            id: '1',
            customer_name: 'ABC Manufacturing',
            potential_value: 15000,
            stage: 'proposal',
            probability: 75,
            expected_close_date: '2024-02-15',
            assigned_to: 'John Sales'
          },
          {
            id: '2',
            customer_name: 'TechCorp Solutions',
            potential_value: 8500,
            stage: 'negotiation',
            probability: 60,
            expected_close_date: '2024-02-28',
            assigned_to: 'Jane Manager'
          }
        ]
      } as T
    }
    
    if (endpoint.includes('/sales/team')) {
      return {
        team: [
          {
            id: '1',
            name: 'John Sales',
            email: 'john.sales@company.com',
            role: 'Sales Representative',
            performance: 95,
            deals_closed: 12,
            revenue_generated: 75000
          },
          {
            id: '2',
            name: 'Jane Manager',
            email: 'jane.manager@company.com',
            role: 'Sales Manager',
            performance: 88,
            deals_closed: 8,
            revenue_generated: 50000
          }
        ]
      } as T
    }
    
    if (endpoint.includes('/leads')) {
      return {
        leads: [
          {
            id: '1',
            customer_name: 'New Company Inc',
            company_name: 'New Company Inc',
            email: 'contact@newcompany.com',
            phone: '555-0123',
            source: 'Website',
            lead_quality: 'high',
            sales_stage: 'qualification',
            potential_value: 12000,
            assigned_to: 'John Sales',
            next_follow_up: '2024-01-20',
            created_at: '2024-01-15'
          },
          {
            id: '2',
            customer_name: 'Prospect Corp',
            company_name: 'Prospect Corp',
            email: 'info@prospect.com',
            phone: '555-0456',
            source: 'Referral',
            lead_quality: 'medium',
            sales_stage: 'proposal',
            potential_value: 8000,
            assigned_to: 'Jane Manager',
            next_follow_up: '2024-01-18',
            created_at: '2024-01-10'
          }
        ]
      } as T
    }
    
    if (endpoint.includes('/quotes')) {
      return {
        quotes: [
          {
            id: '1',
            quote_number: 'Q-2024-001',
            customer_id: '1',
            customer_name: 'ABC Manufacturing',
            status: 'sent',
            total_amount: 15000,
            valid_until: '2024-02-15',
            created_by: 'John Sales',
            created_at: '2024-01-15'
          },
          {
            id: '2',
            quote_number: 'Q-2024-002',
            customer_id: '2',
            customer_name: 'TechCorp Solutions',
            status: 'pending',
            total_amount: 8500,
            valid_until: '2024-02-28',
            created_by: 'Jane Manager',
            created_at: '2024-01-10'
          }
        ]
      } as T
    }
    
    // Return empty array for other endpoints
    return [] as T
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request('/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  // User methods
  async getUsers(params: { limit?: number; offset?: number } = {}) {
    const queryParams = new URLSearchParams()
    if (params.limit) queryParams.append('limit', params.limit.toString())
    if (params.offset) queryParams.append('offset', params.offset.toString())
    
    const queryString = queryParams.toString()
    const endpoint = queryString ? `/users?${queryString}` : '/users'
    
    return this.request(endpoint)
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    })
  }

  // Customer endpoints
  async getCustomers(params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    status?: string;
    owner_assigned?: string;
    owner_name?: string;
    customer_type?: string;
  }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.owner_assigned) queryParams.append('owner_assigned', params.owner_assigned)
    if (params?.owner_name) queryParams.append('owner_name', params.owner_name)
    if (params?.customer_type) queryParams.append('customer_type', params.customer_type)
    
    const query = queryParams.toString()
    return this.request(`/customers${query ? `?${query}` : ''}`)
  }

  async getCustomer(id: string) {
    return this.request(`/customers/${id}`)
  }

  async getCustomerMachines(customerId: string) {
    return this.request(`/machines/by-customer/${customerId}`)
  }

  async getCustomerWorkOrders(customerId: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.request(`/workOrders${query ? `?${query}&customer_id=${customerId}` : `?customer_id=${customerId}`}`)
  }

  async getCustomerWarrantyWorkOrders(customerId: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.request(`/warrantyWorkOrders${query ? `?${query}&customer_id=${customerId}` : `?customer_id=${customerId}`}`)
  }

  async createCustomer(customer: any) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    })
  }

  async updateCustomer(id: string, customer: any) {
    return this.request(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(customer),
    })
  }

  async deleteCustomer(id: string) {
    return this.request(`/customers/${id}`, {
      method: 'DELETE',
    })
  }

  // Machine endpoints
  async getMachines(params?: { page?: number; limit?: number; search?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    
    const query = queryParams.toString()
    return this.request(`/machines${query ? `?${query}` : ''}`)
  }

  async getMachineModels(params?: { page?: number; limit?: number; search?: string; category?: string; manufacturer?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.category) queryParams.append('category', params.category)
    if (params?.manufacturer) queryParams.append('manufacturer', params.manufacturer)
    
    const query = queryParams.toString()
    return this.request(`/machines/models${query ? `?${query}` : ''}`)
  }

  async getMachineModel(modelId: string, params?: { warranty_status?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.warranty_status) queryParams.append('warranty_status', params.warranty_status)
    
    const query = queryParams.toString()
    return this.request(`/machines/models/${modelId}${query ? `?${query}` : ''}`)
  }

  async getMachine(machineId: string) {
    return this.request(`/machines/${machineId}`)
  }

  async getMachineWorkOrders(machineId: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.request(`/workOrders${query ? `?${query}&machine_id=${machineId}` : `?machine_id=${machineId}`}`)
  }

  async getMachineWarrantyWorkOrders(machineId: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.request(`/warrantyWorkOrders${query ? `?${query}&machine_id=${machineId}` : `?machine_id=${machineId}`}`)
  }

  async createMachine(machine: any) {
    return this.request('/machines', {
      method: 'POST',
      body: JSON.stringify(machine),
    })
  }

  async updateMachine(id: string, machine: any) {
    return this.request(`/assigned-machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(machine),
    })
  }

  async deleteMachine(id: string) {
    return this.request(`/assigned-machines/${id}`, {
      method: 'DELETE',
    })
  }

  // Inventory endpoints
  async getInventory(params?: { page?: number; limit?: number; search?: string; category?: string; supplier?: string; stock_status?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.category) queryParams.append('category', params.category)
    if (params?.supplier) queryParams.append('supplier', params.supplier)
    if (params?.stock_status) queryParams.append('stock_status', params.stock_status)
    
    const query = queryParams.toString()
    return this.request(`/inventory${query ? `?${query}` : ''}`)
  }

  async getInventoryItem(id: string) {
    return this.request(`/inventory/${id}`)
  }

  async createInventoryItem(item: any) {
    return this.request('/inventory', {
      method: 'POST',
      body: JSON.stringify(item),
    })
  }

  async getInventoryCategories() {
    return this.request('/inventory-categories')
  }

  async createInventoryCategory(category: { name: string; description?: string }) {
    return this.request('/inventory-categories', {
      method: 'POST',
      body: JSON.stringify(category),
    })
  }


  async updateInventoryItem(id: string, item: any) {
    return this.request(`/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    })
  }

  async deleteInventoryItem(id: string) {
    return this.request(`/inventory/${id}`, {
      method: 'DELETE',
    })
  }

  async getInventoryWorkOrders(inventoryId: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.request(`/workOrders/by-inventory/${inventoryId}${query ? `?${query}` : ''}`)
  }

  async getInventoryWarrantyWorkOrders(inventoryId: string, params?: { page?: number; limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.request(`/warrantyWorkOrders/by-inventory/${inventoryId}${query ? `?${query}` : ''}`)
  }

  // Repair Ticket endpoints
  async getRepairTickets(params?: { page?: number; limit?: number; search?: string; status?: string; priority?: string; technician_id?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.priority) queryParams.append('priority', params.priority)
    if (params?.technician_id) queryParams.append('technician_id', params.technician_id)
    
    const query = queryParams.toString()
    return this.request(`/repairTickets${query ? `?${query}` : ''}`)
  }

  async getRepairTicket(id: string) {
    return this.request(`/repairTickets/${id}`)
  }

  async createRepairTicket(ticket: any) {
    return this.request('/repairTickets', {
      method: 'POST',
      body: JSON.stringify(ticket),
    })
  }

  async updateRepairTicket(id: string, ticket: any) {
    return this.request(`/repairTickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ticket),
    })
  }

  async deleteRepairTicket(id: string) {
    return this.request(`/repairTickets/${id}`, {
      method: 'DELETE',
    })
  }

  async convertRepairTicketToWorkOrder(id: string, data: any) {
    return this.request(`/repairTickets/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Work Order endpoints
  async getWorkOrders(params?: { page?: number; limit?: number; search?: string; status?: string; priority?: string; technician_id?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.priority) queryParams.append('priority', params.priority)
    if (params?.technician_id) queryParams.append('technician_id', params.technician_id)
    
    const query = queryParams.toString()
    return this.request(`/workOrders${query ? `?${query}` : ''}`)
  }

  async getWorkOrder(id: string) {
    return this.request(`/workOrders/${id}`)
  }

  async createWorkOrder(workOrder: any) {
    return this.request('/workOrders', {
      method: 'POST',
      body: JSON.stringify(workOrder),
    })
  }

  async updateWorkOrder(id: string, workOrder: any) {
    return this.request(`/workOrders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(workOrder),
    })
  }

  async deleteWorkOrder(id: string) {
    return this.request(`/workOrders/${id}`, {
      method: 'DELETE',
    })
  }

  // Work Order Notes endpoints
  async getWorkOrderNotes(workOrderId: string) {
    return this.request(`/workOrderNotes/${workOrderId}`)
  }

  async createWorkOrderNote(data: any) {
    return this.request('/workOrderNotes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Work Order Inventory endpoints
  async getWorkOrderInventory(workOrderId: string) {
    return this.request(`/workOrderInventory/${workOrderId}`)
  }

  async createWorkOrderInventory(data: any) {
    return this.request('/workOrderInventory', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async updateWorkOrderInventory(id: string, data: any) {
    return this.request(`/workOrderInventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }

  async deleteWorkOrderInventory(id: string) {
    return this.request(`/workOrderInventory/${id}`, {
      method: 'DELETE'
    })
  }

  // Quote endpoints

  async getQuote(id: string) {
    return this.request(`/quotes/${id}`)
  }

  async createQuote(quote: any) {
    return this.request('/quotes', {
      method: 'POST',
      body: JSON.stringify(quote),
    })
  }

  async updateQuote(id: string, quote: any) {
    return this.request(`/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(quote),
    })
  }

  async deleteQuote(id: string) {
    return this.request(`/quotes/${id}`, {
      method: 'DELETE',
    })
  }

  // Dashboard endpoints
  async getDashboardStats() {
    return this.request('/dashboard')
  }

  async getRecentActivity() {
    return this.request('/dashboard')
  }

  async getSidebarCounts() {
    return this.request('/dashboard/sidebar-counts')
  }

  // Warranty Repair Ticket endpoints
  async getWarrantyRepairTickets(params?: { page?: number; limit?: number; search?: string; status?: string; priority?: string; technician_id?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.priority) queryParams.append('priority', params.priority)
    if (params?.technician_id) queryParams.append('technician_id', params.technician_id)
    
    const query = queryParams.toString()
    return this.request(`/warrantyRepairTickets${query ? `?${query}` : ''}`)
  }

  async getWarrantyRepairTicket(id: string) {
    return this.request(`/warrantyRepairTickets/${id}`)
  }

  async createWarrantyRepairTicket(ticket: any) {
    return this.request('/warrantyRepairTickets', {
      method: 'POST',
      body: JSON.stringify(ticket),
    })
  }

  async updateWarrantyRepairTicket(id: string, ticket: any) {
    return this.request(`/warrantyRepairTickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(ticket),
    })
  }

  async deleteWarrantyRepairTicket(id: string) {
    return this.request(`/warrantyRepairTickets/${id}`, {
      method: 'DELETE',
    })
  }

  async convertWarrantyRepairTicketToWorkOrder(id: string, data: any) {
    return this.request(`/warrantyRepairTickets/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Warranty Work Order endpoints
  async getWarrantyWorkOrders(params?: { page?: number; limit?: number; search?: string; status?: string; priority?: string; technician_id?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.priority) queryParams.append('priority', params.priority)
    if (params?.technician_id) queryParams.append('technician_id', params.technician_id)
    
    const query = queryParams.toString()
    return this.request(`/warrantyWorkOrders${query ? `?${query}` : ''}`)
  }

  async getWarrantyWorkOrder(id: string) {
    return this.request(`/warrantyWorkOrders/${id}`)
  }

  async updateWarrantyWorkOrder(id: string, workOrder: any) {
    return this.request(`/warrantyWorkOrders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(workOrder),
    })
  }

  async deleteWarrantyWorkOrder(id: string) {
    return this.request(`/warrantyWorkOrders/${id}`, {
      method: 'DELETE',
    })
  }

  async getWarrantyWorkOrderNotes(id: string) {
    const response = await this.request(`/warrantyWorkOrders/${id}/notes`)
    // Convert the response format to match regular work order notes
    return { data: response.data || [] }
  }

  async createWarrantyWorkOrderNote(id: string, data: any) {
    return this.request(`/warrantyWorkOrders/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getWarrantyWorkOrderInventory(id: string) {
    return this.request(`/warrantyWorkOrders/${id}/inventory`)
  }

  async createWarrantyWorkOrderInventory(id: string, data: any) {
    return this.request(`/warrantyWorkOrders/${id}/inventory`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteWarrantyWorkOrderInventory(workOrderId: string, inventoryId: string) {
    return this.request(`/warrantyWorkOrders/${workOrderId}/inventory/${inventoryId}`, {
      method: 'DELETE'
    })
  }


  // Machine Model endpoints
  async createMachineModel(model: any) {
    return this.request('/machines/models', {
      method: 'POST',
      body: JSON.stringify(model),
    })
  }

  async updateMachineModel(id: string, model: any) {
    return this.request(`/machines/models/${id}`, {
      method: 'PUT',
      body: JSON.stringify(model),
    })
  }

  async deleteMachineModel(id: string) {
    return this.request(`/machines/models/${id}`, {
      method: 'DELETE',
    })
  }

  async getMachineCategories() {
    return this.request('/machine-categories')
  }

  async createMachineCategory(category: { name: string }) {
    return this.request('/machine-categories', {
      method: 'POST',
      body: JSON.stringify(category),
    })
  }

  // Machine Serial endpoints
  async createMachineSerial(modelId: number, serialNumber: string) {
    return this.request(`/machine-serials/model/${modelId}`, {
      method: 'POST',
      body: JSON.stringify({
        serial_numbers: [serialNumber]
      }),
    })
  }

  // Assigned Machine endpoints
  async createAssignedMachine(machine: any) {
    return this.request('/assigned-machines', {
      method: 'POST',
      body: JSON.stringify(machine),
    })
  }

  async getUnassignedSerials(modelId: number) {
    return this.request(`/machine-serials/unassigned/${modelId}`)
  }

  // Suppliers endpoints
  async getSuppliers(params?: { page?: number; limit?: number; search?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    
    const query = queryParams.toString()
    return this.request(`/suppliers${query ? `?${query}` : ''}`)
  }

  // Sales Dashboard endpoints
  async getSalesMetrics(params?: { time_period?: string; sales_person?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    if (params?.sales_person) queryParams.append('sales_person', params.sales_person)
    
    const query = queryParams.toString()
    return this.request(`/sales/metrics${query ? `?${query}` : ''}`)
  }

  async getSalesOpportunities(params?: { page?: number; limit?: number; search?: string; stage?: string; assigned_to?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.stage) queryParams.append('stage', params.stage)
    if (params?.assigned_to) queryParams.append('assigned_to', params.assigned_to)
    
    const query = queryParams.toString()
    return this.request(`/sales/opportunities${query ? `?${query}` : ''}`)
  }

  async getSalesTeam(targetType: 'monthly' | 'quarterly' | 'yearly' = 'monthly') {
    return this.request(`/sales/team?target_type=${targetType}`)
  }

  async getRecentSales(params?: { limit?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    
    const query = queryParams.toString()
    return this.request(`/sales/recent${query ? `?${query}` : ''}`)
  }

  // Lead Management endpoints
  async getLeads(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    stage?: string; 
    quality?: string; 
    assigned_to?: string;
    source?: string;
    created_by?: string;
  }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.stage) queryParams.append('status', params.stage)
    if (params?.quality) queryParams.append('quality', params.quality)
    if (params?.assigned_to) queryParams.append('assigned_to', params.assigned_to)
    if (params?.source) queryParams.append('source', params.source)
    if (params?.created_by) queryParams.append('created_by', params.created_by)
    
    const query = queryParams.toString()
    return this.request(`/leads${query ? `?${query}` : ''}`)
  }

  async getLeadFilterOptions() {
    return this.request('/leads/filter-options')
  }

  async getLead(id: string) {
    return this.request(`/leads/${id}`)
  }

  async createLead(lead: any) {
    return this.request('/leads', {
      method: 'POST',
      body: JSON.stringify(lead),
    })
  }

  async updateLead(id: string, lead: any) {
    return this.request(`/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(lead),
    })
  }

  async deleteLead(id: string) {
    return this.request(`/leads/${id}`, {
      method: 'DELETE',
    })
  }

  async getLeadStats() {
    return this.request('/leads/stats')
  }

  async getLeadsByStage(stage: string) {
    return this.request(`/leads/stage/${stage}`)
  }

  async getPipelineStats() {
    return this.request('/leads/pipeline-stats')
  }

  async updateLeadStage(id: string, stage: string, position?: number) {
    return this.request(`/leads/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, position }),
    })
  }

  // Lead Follow-ups endpoints
  async getLeadFollowUps(leadId: string) {
    return this.request(`/leads/${leadId}/follow-ups`)
  }

  async addLeadFollowUp(leadId: string, followUp: any) {
    return this.request(`/leads/${leadId}/follow-ups`, {
      method: 'POST',
      body: JSON.stringify(followUp),
    })
  }

  async updateFollowUpCompletion(leadId: string, followUpId: string, completed: boolean) {
    return this.request(`/leads/${leadId}/follow-ups/${followUpId}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    })
  }

  async getAllFollowUps() {
    return this.request('/leads/follow-ups/all')
  }

  async deleteFollowUp(leadId: string, followUpId: string) {
    return this.request(`/leads/${leadId}/follow-ups/${followUpId}`, {
      method: 'DELETE',
    })
  }

  async updateLeadFollowUp(leadId: string, followUpId: string, followUp: any) {
    return this.request(`/leads/${leadId}/follow-ups/${followUpId}`, {
      method: 'PUT',
      body: JSON.stringify(followUp),
    })
  }

  async deleteLeadFollowUp(leadId: string, followUpId: string) {
    return this.request(`/leads/${leadId}/follow-ups/${followUpId}`, {
      method: 'DELETE',
    })
  }

  // Quote Management endpoints (enhanced)
  async getQuotes(params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
    status?: string; 
    customer_id?: string;
    created_by?: string;
  }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.customer_id) queryParams.append('customer_id', params.customer_id)
    if (params?.created_by) queryParams.append('created_by', params.created_by)
    
    const query = queryParams.toString()
    return this.request(`/quotes${query ? `?${query}` : ''}`)
  }

  async getQuoteStats() {
    return this.request('/quotes/stats')
  }

  async updateQuoteStatus(id: string, status: string) {
    return this.request(`/quotes/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  async convertQuoteToOrder(id: string, data: any) {
    return this.request(`/quotes/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Quote Items endpoints
  async getQuoteItems(quoteId: string) {
    return this.request(`/quotes/${quoteId}/items`)
  }

  async addQuoteItem(quoteId: string, item: any) {
    return this.request(`/quotes/${quoteId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    })
  }

  async updateQuoteItem(quoteId: string, itemId: string, item: any) {
    return this.request(`/quotes/${quoteId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(item),
    })
  }

  async deleteQuoteItem(quoteId: string, itemId: string) {
    return this.request(`/quotes/${quoteId}/items/${itemId}`, {
      method: 'DELETE',
    })
  }

  // Quote Templates API
  async getQuoteTemplates(params?: { template_type?: string; is_active?: boolean }) {
    const queryParams = new URLSearchParams()
    if (params?.template_type) queryParams.append('template_type', params.template_type)
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString())
    const query = queryParams.toString()
    return this.request(`/quotes/templates${query ? `?${query}` : ''}`)
  }

  async getQuoteTemplate(id: string) {
    return this.request(`/quotes/templates/${id}`)
  }

  async createQuoteTemplate(template: any) {
    return this.request('/quotes/templates', {
      method: 'POST',
      body: JSON.stringify(template)
    })
  }

  async updateQuoteTemplate(id: string, template: any) {
    return this.request(`/quotes/templates/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(template)
    })
  }

  async deleteQuoteTemplate(id: string) {
    return this.request(`/quotes/templates/${id}`, {
      method: 'DELETE'
    })
  }

  async createQuoteFromTemplate(templateId: string, data: any) {
    return this.request(`/quotes/from-template/${templateId}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  // Quote Catalog API
  async getQuoteCatalogMachines(params?: { search?: string; category?: string; manufacturer?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)
    if (params?.category) queryParams.append('category', params.category)
    if (params?.manufacturer) queryParams.append('manufacturer', params.manufacturer)
    const query = queryParams.toString()
    return this.request(`/quotes/catalog/machines${query ? `?${query}` : ''}`)
  }

  async getQuoteCatalogParts(params?: { search?: string; category?: string; in_stock_only?: boolean }) {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.append('search', params.search)
    if (params?.category) queryParams.append('category', params.category)
    if (params?.in_stock_only !== undefined) queryParams.append('in_stock_only', params.in_stock_only.toString())
    const query = queryParams.toString()
    return this.request(`/quotes/catalog/parts${query ? `?${query}` : ''}`)
  }

  async getQuoteCatalogServices() {
    return this.request('/quotes/catalog/services')
  }

  // Quote Actions API
  async duplicateQuote(id: string) {
    return this.request(`/quotes/${id}/duplicate`, {
      method: 'POST'
    })
  }

  async downloadQuotePDF(id: string) {
    const response = await fetch(`${API_BASE_URL}/quotes/${id}/pdf`, {
      method: 'GET',
      headers: this.getAuthHeaders()
    })
    
    if (!response.ok) {
      throw new Error('Failed to download PDF')
    }
    
    // Get the blob and ensure it has the correct MIME type
    const blob = await response.blob()
    const pdfBlob = new Blob([blob], { type: 'application/pdf' })
    
    // Create download link
    const url = window.URL.createObjectURL(pdfBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quote-${id}.pdf`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    
    // Cleanup
    setTimeout(() => {
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    }, 100)
  }

  // Sales Reports endpoints
  async getSalesReports(params?: { 
    time_period?: string; 
    report_type?: string; 
    sales_person?: string;
  }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    if (params?.report_type) queryParams.append('report_type', params.report_type)
    if (params?.sales_person) queryParams.append('sales_person', params.sales_person)
    
    const query = queryParams.toString()
    return this.request(`/sales/reports${query ? `?${query}` : ''}`)
  }

  async getSalesTrends(params?: { time_period?: string; sales_person?: string; start_date?: string; end_date?: string; group_by?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    if (params?.sales_person) queryParams.append('sales_person', params.sales_person)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    if (params?.group_by) queryParams.append('group_by', params.group_by)
    
    const query = queryParams.toString()
    return this.request(`/sales/trends${query ? `?${query}` : ''}`)
  }

  async getTopCustomers(params?: { limit?: number; time_period?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    
    const query = queryParams.toString()
    return this.request(`/sales/top-customers${query ? `?${query}` : ''}`)
  }

  async getSalesForecast(params?: { months?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.months) queryParams.append('months', params.months.toString())
    
    const query = queryParams.toString()
    return this.request(`/sales/forecast${query ? `?${query}` : ''}`)
  }

  // Sales Users endpoints
  async getSalesUsers() {
    return this.request('/users/sales')
  }

  // Dashboard-specific endpoints
  async getMyRepairs(userId?: string) {
    // Use existing repair tickets endpoint with user filter
    const params = userId ? `?submitted_by=${userId}` : ''
    return this.request(`/repairTickets${params}`)
  }

  async getMySales(userId?: string) {
    // Use existing sales recent endpoint with user filter
    const params = userId ? `?sales_person=${userId}` : ''
    return this.request(`/sales/recent${params}`)
  }

  async getMyLeads(userId?: string) {
    // Use existing leads endpoint with user filter
    const params = userId ? `?assigned_to=${userId}` : ''
    return this.request(`/leads${params}`)
  }

  async getMostUsedParts(params?: { limit?: number; start_date?: string; end_date?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    
    const queryString = queryParams.toString()
    return this.request(`/analytics/most-used-parts${queryString ? `?${queryString}` : ''}`)
  }

  async getLeadSources(params?: { time_period?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    
    const queryString = queryParams.toString()
    return this.request(`/sales/lead-sources${queryString ? `?${queryString}` : ''}`)
  }

  // Rental Machines API
  async getRentalMachines(params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    status?: string;
    condition?: string;
    model_id?: string;
    manufacturer?: string;
  }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.condition) queryParams.append('condition', params.condition)
    if (params?.model_id) queryParams.append('model_id', params.model_id)
    if (params?.manufacturer) queryParams.append('manufacturer', params.manufacturer)
    
    const queryString = queryParams.toString()
    return this.request(`/rental-machines${queryString ? `?${queryString}` : ''}`)
  }

  async getRentalMachine(id: string) {
    return this.request(`/rental-machines/${id}`)
  }

  async createRentalMachine(machine: any) {
    return this.request('/rental-machines', {
      method: 'POST',
      body: JSON.stringify(machine)
    })
  }

  async updateRentalMachine(id: string, machine: any) {
    return this.request(`/rental-machines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(machine)
    })
  }

  async deleteRentalMachine(id: string) {
    return this.request(`/rental-machines/${id}`, {
      method: 'DELETE'
    })
  }

  async getAvailableRentalMachines(modelId?: string) {
    const queryParams = new URLSearchParams()
    if (modelId) queryParams.append('model_id', modelId)
    
    const queryString = queryParams.toString()
    return this.request(`/rental-machines/available/list${queryString ? `?${queryString}` : ''}`)
  }

  async getRentalMachineStats() {
    return this.request('/rental-machines/stats/overview')
  }

  // Machine Rentals API
  async getMachineRentals(params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    status?: string;
    customer_id?: string;
    rental_machine_id?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.search) queryParams.append('search', params.search)
    if (params?.status) queryParams.append('status', params.status)
    if (params?.customer_id) queryParams.append('customer_id', params.customer_id)
    if (params?.rental_machine_id) queryParams.append('rental_machine_id', params.rental_machine_id)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    
    const queryString = queryParams.toString()
    return this.request(`/machine-rentals${queryString ? `?${queryString}` : ''}`)
  }

  async getMachineRental(id: string) {
    return this.request(`/machine-rentals/${id}`)
  }

  async createMachineRental(rental: any) {
    return this.request('/machine-rentals', {
      method: 'POST',
      body: JSON.stringify(rental)
    })
  }

  async updateMachineRental(id: string, rental: any) {
    return this.request(`/machine-rentals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(rental)
    })
  }

  async deleteMachineRental(id: string) {
    return this.request(`/machine-rentals/${id}`, {
      method: 'DELETE'
    })
  }

  async getMachineRentalStats() {
    return this.request('/machine-rentals/stats/overview')
  }

  async getOverdueRentals() {
    return this.request('/machine-rentals/overdue/list')
  }

  // Enhanced Status Management API
  async getRentalMachineStatuses() {
    return this.request('/rental-machines/statuses')
  }

  async getRentalMachineTransitionRules() {
    return this.request('/rental-machines/transition-rules')
  }

  async updateRentalMachineStatus(id: string, status: string, reason?: string, notes?: string) {
    return this.request(`/rental-machines/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, reason, notes })
    })
  }

  async getRentalMachineStatusHistory(id: string, limit?: number) {
    const queryParams = new URLSearchParams()
    if (limit) queryParams.append('limit', limit.toString())
    
    const queryString = queryParams.toString()
    return this.request(`/rental-machines/${id}/status-history${queryString ? `?${queryString}` : ''}`)
  }

  async getRentalMachineStatusStatistics() {
    return this.request('/rental-machines/status-statistics')
  }

  async processAutoTransitions() {
    return this.request('/rental-machines/process-auto-transitions', {
      method: 'POST'
    })
  }

  // Rental Analytics API
  async getRentalAnalyticsOverview(dateRange = '30d') {
    return this.request(`/rental-analytics/overview?dateRange=${dateRange}`)
  }

  async getRentalFleetStats() {
    return this.request('/rental-analytics/fleet')
  }

  async getRentalRevenueStats(dateRange = '30d') {
    return this.request(`/rental-analytics/revenue?dateRange=${dateRange}`)
  }

  async getRentalUtilizationStats(dateRange = '30d') {
    return this.request(`/rental-analytics/utilization?dateRange=${dateRange}`)
  }

  async getRentalCustomerStats(dateRange = '30d') {
    return this.request(`/rental-analytics/customers?dateRange=${dateRange}`)
  }

  async getRentalStatusStats() {
    return this.request('/rental-analytics/status')
  }

  async getRentalOverdueStats() {
    return this.request('/rental-analytics/overdue')
  }

  async getRentalTrends(dateRange = '30d', groupBy = 'day') {
    return this.request(`/rental-analytics/trends?dateRange=${dateRange}&groupBy=${groupBy}`)
  }

  async getRentalMachinePerformance(dateRange = '30d') {
    return this.request(`/rental-analytics/machine-performance?dateRange=${dateRange}`)
  }

  async getRentalDurationAnalytics(dateRange = '30d') {
    return this.request(`/rental-analytics/duration?dateRange=${dateRange}`)
  }

  async getRentalBillingAnalytics(dateRange = '30d') {
    return this.request(`/rental-analytics/billing?dateRange=${dateRange}`)
  }

  async getRentalRealTimeDashboard() {
    return this.request('/rental-analytics/realtime')
  }

  // Dynamic Pricing API
  async calculateDynamicPricing(rentalMachineId: string, startDate: string, endDate: string, customerId?: string) {
    return this.request('/dynamic-pricing/calculate', {
      method: 'POST',
      body: JSON.stringify({
        rental_machine_id: rentalMachineId,
        start_date: startDate,
        end_date: endDate,
        customer_id: customerId
      })
    })
  }

  async getAllBasePricing() {
    return this.request('/dynamic-pricing/base')
  }

  async getBasePricing(rentalMachineId: string) {
    return this.request(`/dynamic-pricing/base/${rentalMachineId}`)
  }

  async setBasePricing(rentalMachineId: string, pricingData: any) {
    return this.request(`/dynamic-pricing/base/${rentalMachineId}`, {
      method: 'PUT',
      body: JSON.stringify(pricingData)
    })
  }

  async getPricingRules() {
    return this.request('/dynamic-pricing/rules')
  }

  async createPricingRule(ruleData: any) {
    return this.request('/dynamic-pricing/rules', {
      method: 'POST',
      body: JSON.stringify(ruleData)
    })
  }

  async updatePricingRule(ruleId: string, ruleData: any) {
    return this.request(`/dynamic-pricing/rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(ruleData)
    })
  }

  async deletePricingRule(ruleId: string) {
    return this.request(`/dynamic-pricing/rules/${ruleId}`, {
      method: 'DELETE'
    })
  }

  async getCustomerTiers() {
    return this.request('/dynamic-pricing/customer-tiers')
  }

  async createCustomerTier(tierData: any) {
    return this.request('/dynamic-pricing/customer-tiers', {
      method: 'POST',
      body: JSON.stringify(tierData)
    })
  }

  async updateCustomerTier(tierId: string, tierData: any) {
    return this.request(`/dynamic-pricing/customer-tiers/${tierId}`, {
      method: 'PUT',
      body: JSON.stringify(tierData)
    })
  }

  async deleteCustomerTier(tierId: string) {
    return this.request(`/dynamic-pricing/customer-tiers/${tierId}`, {
      method: 'DELETE'
    })
  }

  async assignCustomerTier(customerId: string, tierId: string, expiresAt?: string) {
    return this.request('/dynamic-pricing/customer-tiers/assign', {
      method: 'POST',
      body: JSON.stringify({
        customer_id: customerId,
        tier_id: tierId,
        expires_at: expiresAt
      })
    })
  }

  async getCustomerTier(customerId: string) {
    return this.request(`/dynamic-pricing/customer-tiers/${customerId}`)
  }

  async updateDemandTracking(demandData: any) {
    return this.request('/dynamic-pricing/demand-tracking', {
      method: 'POST',
      body: JSON.stringify(demandData)
    })
  }

  async getDemandAnalytics(dateRange = '30d') {
    return this.request(`/dynamic-pricing/demand-analytics?dateRange=${dateRange}`)
  }

  async getPricingHistory(rentalMachineId: string, limit = 50) {
    return this.request(`/dynamic-pricing/history/${rentalMachineId}?limit=${limit}`)
  }

  async runPricingSimulation(rentalMachineId: string, scenarios: any[]) {
    return this.request('/dynamic-pricing/simulation', {
      method: 'POST',
      body: JSON.stringify({
        rental_machine_id: rentalMachineId,
        scenarios: scenarios
      })
    })
  }

  async autoAssignCustomerTiers() {
    return this.request('/dynamic-pricing/auto-assign-tiers', {
      method: 'POST'
    })
  }

  // ==================== SALES TARGETS MANAGEMENT ====================

  async getSalesTargets(params?: {
    user_id?: string
    target_type?: string
    is_active?: boolean
  }) {
    const queryParams = new URLSearchParams()
    if (params?.user_id) queryParams.append('user_id', params.user_id)
    if (params?.target_type) queryParams.append('target_type', params.target_type)
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString())
    
    const queryString = queryParams.toString()
    return this.request(`/sales/targets${queryString ? `?${queryString}` : ''}`)
  }

  async getMyPerformance() {
    return this.request('/sales/my-performance')
  }

  async getUserTargets(userId: string, params?: {
    target_type?: string
    is_active?: boolean
  }) {
    const queryParams = new URLSearchParams()
    if (params?.target_type) queryParams.append('target_type', params.target_type)
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString())
    
    const queryString = queryParams.toString()
    return this.request(`/sales/targets/user/${userId}${queryString ? `?${queryString}` : ''}`)
  }

  async createSalesTarget(targetData: {
    user_id: number
    target_type: 'monthly' | 'quarterly' | 'yearly'
    target_amount: number
    target_period_start: string
    target_period_end: string
    description?: string
  }) {
    return this.request('/sales/targets', {
      method: 'POST',
      body: JSON.stringify(targetData)
    })
  }

  async updateSalesTarget(targetId: string, updates: {
    target_amount?: number
    target_period_start?: string
    target_period_end?: string
    description?: string
    is_active?: boolean
  }) {
    return this.request(`/sales/targets/${targetId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
  }

  async deleteSalesTarget(targetId: string) {
    return this.request(`/sales/targets/${targetId}`, {
      method: 'DELETE'
    })
  }

  async getCurrentTargets(userId?: string) {
    const queryParams = new URLSearchParams()
    if (userId) queryParams.append('user_id', userId)
    
    const queryString = queryParams.toString()
    return this.request(`/sales/targets/current${queryString ? `?${queryString}` : ''}`)
  }

  // Permissions Management
  async getAvailablePermissions() {
    return this.request('/permissions/available')
  }

  async getUserPermissions(userId: string) {
    return this.request(`/permissions/user/${userId}`)
  }

  async getUserPermissionAudit(userId: string, params?: { limit?: number; offset?: number }) {
    const queryParams = new URLSearchParams()
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.offset) queryParams.append('offset', params.offset.toString())
    const query = queryParams.toString()
    return this.request(`/permissions/audit/${userId}${query ? `?${query}` : ''}`)
  }

  async grantPermission(data: {
    user_id: number
    permission_key: string
    expires_at?: string
    reason?: string
  }) {
    return this.request('/permissions/grant', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async revokePermission(data: {
    user_id: number
    permission_key: string
    reason?: string
  }) {
    return this.request('/permissions/revoke', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getUsersWithOverrides() {
    return this.request('/permissions/users-with-overrides')
  }

  async deletePermissionOverride(permissionId: string) {
    return this.request(`/permissions/${permissionId}`, {
      method: 'DELETE'
    })
  }

  // Table Preferences API
  async getAllTablePreferences() {
    return this.request('/table-preferences')
  }

  async getTablePreference(tableKey: string) {
    return this.request(`/table-preferences/${tableKey}`)
  }

  async saveTablePreference(tableKey: string, visibleColumns: string[]) {
    return this.request(`/table-preferences/${tableKey}`, {
      method: 'PUT',
      body: JSON.stringify({ visible_columns: visibleColumns })
    })
  }

  async deleteTablePreference(tableKey: string) {
    return this.request(`/table-preferences/${tableKey}`, {
      method: 'DELETE'
    })
  }

  async saveBulkTablePreferences(preferences: Array<{ table_key: string; visible_columns: string[] }>) {
    return this.request('/table-preferences/bulk', {
      method: 'POST',
      body: JSON.stringify({ preferences })
    })
  }

  // Action Logs API
  async getAllActionLogs(params?: {
    user_id?: string
    action_type?: string
    entity_type?: string
    start_date?: string
    end_date?: string
    search?: string
    page?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })
    }
    return this.request(`/action-logs?${queryParams.toString()}`)
  }

  async getUserActionLogs(userId: string, params?: {
    action_type?: string
    entity_type?: string
    start_date?: string
    end_date?: string
    page?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })
    }
    return this.request(`/action-logs/user/${userId}?${queryParams.toString()}`)
  }

  async getActionLogStats(params?: {
    start_date?: string
    end_date?: string
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })
    }
    return this.request(`/action-logs/stats?${queryParams.toString()}`)
  }

  async getEntityActionLogs(entityType: string, entityId: string, params?: {
    page?: number
    limit?: number
  }) {
    const queryParams = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString())
        }
      })
    }
    return this.request(`/action-logs/entity/${entityType}/${entityId}?${queryParams.toString()}`)
  }

  // Manager Dashboard API
  async getManagerOverview(params?: { time_period?: string; start_date?: string; end_date?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    const queryString = queryParams.toString()
    return this.request(`/manager-dashboard/overview${queryString ? `?${queryString}` : ''}`)
  }

  async getManagerTeamWorkload(params?: { time_period?: string; start_date?: string; end_date?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    const queryString = queryParams.toString()
    return this.request(`/manager-dashboard/team-workload${queryString ? `?${queryString}` : ''}`)
  }

  async getManagerPriorityWorkOrders() {
    return this.request('/manager-dashboard/priority-work-orders')
  }

  async getManagerRecentActivity() {
    return this.request('/manager-dashboard/recent-activity')
  }

  async getManagerSalesOverview(params?: { time_period?: string; start_date?: string; end_date?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    const queryString = queryParams.toString()
    return this.request(`/manager-dashboard/sales-overview${queryString ? `?${queryString}` : ''}`)
  }

  async getManagerSalesTeam(params?: { time_period?: string; start_date?: string; end_date?: string }) {
    const queryParams = new URLSearchParams()
    if (params?.time_period) queryParams.append('time_period', params.time_period)
    if (params?.start_date) queryParams.append('start_date', params.start_date)
    if (params?.end_date) queryParams.append('end_date', params.end_date)
    const queryString = queryParams.toString()
    return this.request(`/manager-dashboard/sales-team${queryString ? `?${queryString}` : ''}`)
  }

  async getManagerRevenueTrends(period: string = 'month') {
    return this.request(`/manager-dashboard/revenue-trends?period=${period}`)
  }

  async getManagerTopOpportunities() {
    return this.request('/manager-dashboard/top-opportunities')
  }

  async getManagerInventoryAlerts() {
    return this.request('/manager-dashboard/inventory-alerts')
  }
}

export const apiService = new ApiService()
export default apiService
