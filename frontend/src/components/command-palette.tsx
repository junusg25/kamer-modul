import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Home,
  Users,
  Wrench,
  Package,
  FileText,
  ClipboardList,
  TrendingUp,
  DollarSign,
  Target,
  Package2,
  Settings,
  Bell,
  Plus,
  Search,
  LogOut,
  LayoutDashboard,
  ShieldAlert,
  Calendar,
  BarChart3,
  Briefcase,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { apiService } from '@/services/api'

interface Command {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
  keywords?: string[]
  category: 'navigation' | 'actions' | 'settings' | 'search'
}

interface SearchResult {
  id: string
  type: 'customer' | 'ticket' | 'machine'
  name: string
  subtitle?: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // Keyboard shortcut handler
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Reset search when closing
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [open])

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      // Search customers, tickets, and machines in parallel
      const [customersRes, ticketsRes, machinesRes] = await Promise.all([
        apiService.getCustomers({ search: query, limit: 5 }).catch(() => ({ data: [] })),
        apiService.getRepairTickets({ search: query, limit: 5 }).catch(() => ({ data: [] })),
        apiService.getMachines({ search: query, limit: 5 }).catch(() => ({ data: [] })),
      ])

      console.log('Search results:', { customersRes, ticketsRes, machinesRes }) // Debug

      const results: SearchResult[] = []

      // Add customers
      if (customersRes.data && Array.isArray(customersRes.data)) {
        customersRes.data.forEach((customer: any) => {
          results.push({
            id: `customer-${customer.id}`,
            type: 'customer',
            name: customer.name || customer.company_name || 'Unknown',
            subtitle: customer.email || customer.phone || '',
          })
        })
      }

      // Add tickets
      if (ticketsRes.data && Array.isArray(ticketsRes.data)) {
        ticketsRes.data.forEach((ticket: any) => {
          results.push({
            id: `ticket-${ticket.id}`,
            type: 'ticket',
            name: `${ticket.ticket_number || 'N/A'} - ${ticket.customer_name || 'Unknown'}`,
            subtitle: ticket.description?.substring(0, 50) || ticket.machine_name || '',
          })
        })
      }

      // Add machines
      if (machinesRes.data && Array.isArray(machinesRes.data)) {
        machinesRes.data.forEach((machine: any) => {
          results.push({
            id: `machine-${machine.id}`,
            type: 'machine',
            name: machine.model_name || machine.manufacturer || 'Unknown',
            subtitle: `${machine.manufacturer || ''} ${machine.serial_number ? '- ' + machine.serial_number : ''}`.trim(),
          })
        })
      }

      console.log('Processed results:', results) // Debug
      setSearchResults(results)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  const handleNavigate = (path: string) => {
    navigate(path)
    setOpen(false)
  }

  const handleSearchResultClick = (result: SearchResult) => {
    const id = result.id.split('-')[1]
    if (result.type === 'customer') {
      navigate(`/customers/${id}`)
    } else if (result.type === 'ticket') {
      navigate(`/repair-tickets/${id}`)
    } else if (result.type === 'machine') {
      navigate(`/machines/${id}`)
    }
    setOpen(false)
  }

  const handleLogout = () => {
    logout()
    setOpen(false)
  }

  // Navigation commands - organized by category
  const navigationCommands: Command[] = [
    // Dashboard
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Home className="h-4 w-4" />,
      action: () => handleNavigate('/'),
      keywords: ['home', 'dashboard', 'overview'],
      category: 'navigation',
    },
    {
      id: 'my-work',
      label: 'My Work',
      icon: <Briefcase className="h-4 w-4" />,
      action: () => handleNavigate('/dashboard/my-work'),
      keywords: ['my work', 'tasks', 'assignments'],
      category: 'navigation',
    },
    
    // Customers
    {
      id: 'customers',
      label: 'Customers',
      icon: <Users className="h-4 w-4" />,
      action: () => handleNavigate('/customers'),
      keywords: ['customers', 'clients', 'contacts'],
      category: 'navigation',
    },
    
    // Machines
    {
      id: 'machines',
      label: 'Machines',
      icon: <Wrench className="h-4 w-4" />,
      action: () => handleNavigate('/machines'),
      keywords: ['machines', 'equipment', 'devices'],
      category: 'navigation',
    },
    
    // Inventory
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <Package className="h-4 w-4" />,
      action: () => handleNavigate('/inventory'),
      keywords: ['inventory', 'parts', 'stock', 'supplies'],
      category: 'navigation',
    },
    
    // Repair Tickets
    {
      id: 'repair-tickets',
      label: 'Repair Tickets',
      icon: <FileText className="h-4 w-4" />,
      action: () => handleNavigate('/repair-tickets'),
      keywords: ['repair tickets', 'tickets', 'service requests'],
      category: 'navigation',
    },
    
    // Work Orders
    {
      id: 'work-orders',
      label: 'Work Orders',
      icon: <ClipboardList className="h-4 w-4" />,
      action: () => handleNavigate('/work-orders'),
      keywords: ['work orders', 'jobs', 'repairs'],
      category: 'navigation',
    },
    
    // Warranty Tickets
    {
      id: 'warranty-tickets',
      label: 'Warranty Repair Tickets',
      icon: <ShieldAlert className="h-4 w-4" />,
      action: () => handleNavigate('/warranty-repair-tickets'),
      keywords: ['warranty', 'warranty tickets', 'warranty repairs'],
      category: 'navigation',
    },
    
    // Warranty Work Orders
    {
      id: 'warranty-work-orders',
      label: 'Warranty Work Orders',
      icon: <ShieldAlert className="h-4 w-4" />,
      action: () => handleNavigate('/warranty-work-orders'),
      keywords: ['warranty orders', 'warranty work'],
      category: 'navigation',
    },
    
    // Sales - Pipeline & Leads
    {
      id: 'pipeline-leads',
      label: 'Pipeline & Leads',
      icon: <TrendingUp className="h-4 w-4" />,
      action: () => handleNavigate('/pipeline-leads'),
      keywords: ['pipeline', 'leads', 'prospects', 'sales'],
      category: 'navigation',
    },
    
    // Quote Management
    {
      id: 'quotes',
      label: 'Quote Management',
      icon: <DollarSign className="h-4 w-4" />,
      action: () => handleNavigate('/quote-management'),
      keywords: ['quotes', 'quotations', 'estimates', 'proposals'],
      category: 'navigation',
    },
    
    // Sales Reports
    {
      id: 'sales-reports',
      label: 'Sales Reports',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => handleNavigate('/sales-reports'),
      keywords: ['sales reports', 'analytics', 'metrics', 'performance'],
      category: 'navigation',
    },
    
    // Sales Targets
    {
      id: 'sales-targets',
      label: 'Sales Targets',
      icon: <Target className="h-4 w-4" />,
      action: () => handleNavigate('/sales-targets'),
      keywords: ['targets', 'goals', 'objectives', 'kpi'],
      category: 'navigation',
    },
    
    // Rental Machines
    {
      id: 'rental-machines',
      label: 'Rental Machines',
      icon: <Package2 className="h-4 w-4" />,
      action: () => handleNavigate('/rental-machines'),
      keywords: ['rental machines', 'rental fleet', 'equipment rental'],
      category: 'navigation',
    },
    
    // Active Rentals
    {
      id: 'machine-rentals',
      label: 'Active Rentals',
      icon: <Calendar className="h-4 w-4" />,
      action: () => handleNavigate('/machine-rentals'),
      keywords: ['active rentals', 'rentals', 'rented'],
      category: 'navigation',
    },
    
    // Rental Analytics
    {
      id: 'rental-analytics',
      label: 'Rental Analytics',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => handleNavigate('/rental-analytics'),
      keywords: ['rental analytics', 'rental reports', 'rental metrics'],
      category: 'navigation',
    },
    
    // Dynamic Pricing
    {
      id: 'dynamic-pricing',
      label: 'Dynamic Pricing',
      icon: <DollarSign className="h-4 w-4" />,
      action: () => handleNavigate('/dynamic-pricing'),
      keywords: ['dynamic pricing', 'pricing', 'rates'],
      category: 'navigation',
    },
    
    // Notifications
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="h-4 w-4" />,
      action: () => handleNavigate('/notifications'),
      keywords: ['notifications', 'alerts', 'updates'],
      category: 'navigation',
    },
  ]

  // Quick action commands
  const actionCommands: Command[] = [
    {
      id: 'add-customer',
      label: 'Add Customer',
      icon: <Plus className="h-4 w-4" />,
      action: () => handleNavigate('/add-customer'),
      keywords: ['create customer', 'new customer', 'add customer'],
      category: 'actions',
    },
    {
      id: 'add-machine',
      label: 'Add Machine Model',
      icon: <Plus className="h-4 w-4" />,
      action: () => handleNavigate('/add-machine-model'),
      keywords: ['create machine', 'new machine', 'add machine'],
      category: 'actions',
    },
    {
      id: 'add-inventory',
      label: 'Add Inventory Item',
      icon: <Plus className="h-4 w-4" />,
      action: () => handleNavigate('/add-inventory-item'),
      keywords: ['create inventory', 'new inventory', 'add part'],
      category: 'actions',
    },
    {
      id: 'create-repair-ticket',
      label: 'Create Repair Ticket',
      icon: <Plus className="h-4 w-4" />,
      action: () => handleNavigate('/create-repair-ticket'),
      keywords: ['create ticket', 'new ticket', 'add ticket'],
      category: 'actions',
    },
    {
      id: 'create-warranty-ticket',
      label: 'Create Warranty Ticket',
      icon: <Plus className="h-4 w-4" />,
      action: () => handleNavigate('/create-warranty-repair-ticket'),
      keywords: ['create warranty', 'new warranty', 'warranty ticket'],
      category: 'actions',
    },
  ]

  // Settings commands
  const settingsCommands: Command[] = [
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      action: () => handleNavigate('/settings'),
      keywords: ['settings', 'preferences', 'configuration'],
      category: 'settings',
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: <LogOut className="h-4 w-4" />,
      action: handleLogout,
      keywords: ['logout', 'sign out', 'exit'],
      category: 'settings',
    },
  ]

  // Admin commands (only show for admin users)
  const adminCommands: Command[] = user?.role === 'admin' ? [
    {
      id: 'dashboard-admin',
      label: 'Admin Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      action: () => handleNavigate('/dashboard/admin'),
      keywords: ['admin', 'admin dashboard', 'administration'],
      category: 'navigation',
    },
    {
      id: 'admin-feedback',
      label: 'Admin Feedback',
      icon: <LayoutDashboard className="h-4 w-4" />,
      action: () => handleNavigate('/admin-feedback'),
      keywords: ['feedback', 'admin feedback', 'user feedback'],
      category: 'navigation',
    },
  ] : []

  // Manager commands (for managers and admins)
  const managerCommands: Command[] = (user?.role === 'manager' || user?.role === 'admin') ? [
    {
      id: 'dashboard-manager',
      label: 'Manager Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      action: () => handleNavigate('/dashboard/manager'),
      keywords: ['manager', 'manager dashboard', 'management'],
      category: 'navigation',
    },
  ] : []

  // Combine all commands
  const allCommands = [
    ...navigationCommands,
    ...adminCommands,
    ...managerCommands,
    ...actionCommands,
    ...settingsCommands,
  ]

  const getResultIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'customer':
        return <Users className="h-4 w-4" />
      case 'ticket':
        return <FileText className="h-4 w-4" />
      case 'machine':
        return <Wrench className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  // Determine if we should show commands or only search results
  const showCommands = searchQuery.length < 2 || searchResults.length === 0

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Type a command or search..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? (
            <div className="flex items-center justify-center gap-2 py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Searching...</span>
            </div>
          ) : (
            <span>No results found.</span>
          )}
        </CommandEmpty>

        {/* Search Results - Always shown when available, regardless of search filter */}
        {searchResults.length > 0 && (
          <>
            <CommandGroup heading="Search Results">
              {searchResults.map((result) => (
                <CommandItem
                  key={result.id}
                  // Use a value that won't be filtered out
                  value={`__search__${result.id}`}
                  onSelect={() => handleSearchResultClick(result)}
                  // Force match to always show this item
                  keywords={[searchQuery]}
                >
                  <div className="flex items-center gap-2 w-full">
                    {getResultIcon(result.type)}
                    <div className="flex-1">
                      <div className="font-medium">{result.name}</div>
                      {result.subtitle && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        
        {/* Commands - Only show when search is empty or no search results */}
        {showCommands && (
          <>
            <CommandGroup heading="Navigation">
              {allCommands
                .filter(cmd => cmd.category === 'navigation')
                .map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords?.join(' ')}`}
                    onSelect={cmd.action}
                  >
                    <div className="flex items-center gap-2">
                      {cmd.icon}
                      <span>{cmd.label}</span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Quick Actions">
              {allCommands
                .filter(cmd => cmd.category === 'actions')
                .map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords?.join(' ')}`}
                    onSelect={cmd.action}
                  >
                    <div className="flex items-center gap-2">
                      {cmd.icon}
                      <span>{cmd.label}</span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup heading="Settings">
              {allCommands
                .filter(cmd => cmd.category === 'settings')
                .map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.label} ${cmd.keywords?.join(' ')}`}
                    onSelect={cmd.action}
                  >
                    <div className="flex items-center gap-2">
                      {cmd.icon}
                      <span>{cmd.label}</span>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
