const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface TrackingData {
  tracking_number: string;
  email: string;
}

interface RegisterData {
  email: string;
  password: string;
  customer_id: number;
}

interface LoginData {
  email: string;
  password: string;
}

interface ChangePasswordData {
  current_password: string;
  new_password: string;
}

class CustomerPortalAPI {
  private getHeaders(includeAuth: boolean = false): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('customer_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse(response: Response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        status: 'fail',
        message: 'An error occurred'
      }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  // ==================== GUEST TRACKING ====================
  async trackItem(data: TrackingData) {
    const response = await fetch(`${API_BASE_URL}/customer-portal/track`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // ==================== AUTHENTICATION ====================
  async register(data: RegisterData) {
    const response = await fetch(`${API_BASE_URL}/customer-portal/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async login(data: LoginData) {
    const response = await fetch(`${API_BASE_URL}/customer-portal/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse(response);
    
    // Store token in localStorage
    if (result.data?.token) {
      localStorage.setItem('customer_token', result.data.token);
      localStorage.setItem('customer_user', JSON.stringify(result.data.user));
    }
    
    return result;
  }

  async logout() {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_user');
  }

  async getMe() {
    const response = await fetch(`${API_BASE_URL}/customer-portal/auth/me`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    return this.handleResponse(response);
  }

  async changePassword(data: ChangePasswordData) {
    const response = await fetch(`${API_BASE_URL}/customer-portal/auth/change-password`, {
      method: 'POST',
      headers: this.getHeaders(true),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // ==================== AUTHENTICATED USER ====================
  async getMyItems() {
    const response = await fetch(`${API_BASE_URL}/customer-portal/my-items`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    return this.handleResponse(response);
  }

  async getItemDetail(type: string, id: string) {
    const response = await fetch(`${API_BASE_URL}/customer-portal/my-items/${type}/${id}`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    return this.handleResponse(response);
  }

  async getWorkOrderDetail(id: string) {
    return this.getItemDetail('work_order', id);
  }

  async getRepairTicketDetail(id: string) {
    return this.getItemDetail('repair_ticket', id);
  }

  async getQuoteDetail(id: string) {
    return this.getItemDetail('quote', id);
  }

  async getWarrantyTicketDetail(id: string) {
    return this.getItemDetail('warranty_ticket', id);
  }

  async getWarrantyWorkOrderDetail(id: string) {
    return this.getItemDetail('warranty_work_order', id);
  }

  // ==================== MACHINES ====================
  async getMyMachines() {
    const response = await fetch(`${API_BASE_URL}/customer-portal/my-machines`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    return this.handleResponse(response);
  }

  async getMachineDetail(id: string) {
    const response = await fetch(`${API_BASE_URL}/customer-portal/my-machines/${id}`, {
      method: 'GET',
      headers: this.getHeaders(true),
    });
    return this.handleResponse(response);
  }

  // ==================== HELPER METHODS ====================
  isAuthenticated(): boolean {
    return !!localStorage.getItem('customer_token');
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('customer_user');
    return userStr ? JSON.parse(userStr) : null;
  }
}

export const apiService = new CustomerPortalAPI();

