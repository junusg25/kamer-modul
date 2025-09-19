import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible'
import { useAuth } from '../../contexts/auth-context'
import { useFeedback } from '../../contexts/feedback-context'
import apiService from '../../services/api'
import {
  Home,
  Users,
  Wrench,
  Package,
  FileText,
  Bell,
  BarChart3,
  DollarSign,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Award,
  TrendingUp,
  MessageSquare,
  Truck,
  Calendar
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

interface SidebarCounts {
  repair_tickets: number
  warranty_repair_tickets: number
  non_warranty_total: number
  warranty_total: number
}

interface NavigationChild {
  name: string
  href: string
  icon: any
  badge: string | null
}

interface NavigationItem {
  name: string
  href?: string
  icon: any
  badge: string | null
  type: 'single' | 'dropdown' | 'label'
  children?: NavigationChild[]
}

const getNavigationItems = (counts: SidebarCounts | null, userRole?: string, unreadFeedbackCount: number = 0): NavigationItem[] => {
  const baseItems: NavigationItem[] = [
  // General Section
  { name: 'General', href: '#', icon: null, badge: null, type: 'label' },
  { 
    name: userRole === 'admin' ? 'Admin Dashboard' : 'My Work', 
    href: userRole === 'admin' ? '/dashboard/admin' : '/dashboard/my-work', 
    icon: Home, 
    badge: null, 
    type: 'single' 
  },
  { name: 'Overview', href: '/dashboard/overview', icon: BarChart3, badge: null, type: 'single' },
  { name: 'Customers', href: '/customers', icon: Users, badge: null, type: 'single' },
  { name: 'Machines', href: '/machines', icon: Wrench, badge: null, type: 'single' },
  { name: 'Inventory', href: '/inventory', icon: Package, badge: null, type: 'single' },
  
  // Repairs Management Section
  { name: 'Repairs Management', href: '#', icon: null, badge: null, type: 'label' },
  { 
    name: 'Non-Warranty', 
    icon: AlertTriangle, 
    badge: counts?.non_warranty_total ? counts.non_warranty_total.toString() : null, 
    type: 'dropdown',
    children: [
      { 
        name: 'Repair Tickets', 
        href: '/repair-tickets', 
        icon: FileText, 
        badge: counts?.repair_tickets ? counts.repair_tickets.toString() : null 
      },
      { 
        name: 'Work Orders', 
        href: '/work-orders', 
        icon: ClipboardList, 
        badge: null 
      }
    ]
  },
  { 
    name: 'Warranty', 
    icon: Award, 
    badge: counts?.warranty_total ? counts.warranty_total.toString() : null, 
    type: 'dropdown',
    children: [
      { 
        name: 'Warranty Repair Tickets', 
        href: '/warranty-repair-tickets', 
        icon: FileText, 
        badge: counts?.warranty_repair_tickets ? counts.warranty_repair_tickets.toString() : null 
      },
      { 
        name: 'Warranty Work Orders', 
        href: '/warranty-work-orders', 
        icon: ClipboardList, 
        badge: null 
      }
    ]
  },
  
  // Sales Management Section
  { name: 'Sales Management', href: '#', icon: null, badge: null, type: 'label' },
  { 
    name: 'Pipeline & Leads', 
    href: '/pipeline-leads', 
    icon: TrendingUp, 
    badge: null, 
    type: 'single' 
  },
  { 
    name: 'Quote Management', 
    href: '/quote-management', 
    icon: FileText, 
    badge: null, 
    type: 'single' 
  },
  { 
    name: 'Sales Reports', 
    href: '/sales-reports', 
    icon: BarChart3, 
    badge: null, 
    type: 'single' 
  },
  
  // Rental Management Section
  { name: 'Rental Management', href: '#', icon: null, badge: null, type: 'label' },
  { 
    name: 'Rental Fleet', 
    href: '/rental-machines', 
    icon: Truck, 
    badge: null, 
    type: 'single' 
  },
  { 
    name: 'Active Rentals', 
    href: '/machine-rentals', 
    icon: Calendar, 
    badge: null, 
    type: 'single' 
  },
  { 
    name: 'Rental Analytics', 
    href: '/rental-analytics', 
    icon: BarChart3, 
    badge: null, 
    type: 'single' 
  },
  { 
    name: 'Dynamic Pricing', 
    href: '/dynamic-pricing', 
    icon: DollarSign, 
    badge: null, 
    type: 'single' 
  },
  
  // Admin Section
  ...(userRole === 'admin' ? [
    { name: 'Admin', href: '#', icon: null, badge: null, type: 'label' },
    { 
      name: 'User Feedback', 
      href: '/admin-feedback', 
      icon: MessageSquare, 
      badge: unreadFeedbackCount > 0 ? unreadFeedbackCount.toString() : null, 
      type: 'single' 
    }
  ] : []),
  
  ]

  // Filter out sales management items for technicians
  if (userRole === 'technician') {
    return baseItems.filter(item => 
      !['Pipeline & Leads', 'Quote Management', 'Sales Reports', 'Sales Management'].includes(item.name)
    )
  }

  return baseItems
}


export function Sidebar({ className }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { unreadFeedbackCount } = useFeedback()
  const [openDropdowns, setOpenDropdowns] = useState<string[]>([])
  const [sidebarCounts, setSidebarCounts] = useState<SidebarCounts | null>(null)
  // Fetch sidebar counts
  const fetchSidebarCounts = useCallback(async () => {
    try {
      const response = await apiService.getSidebarCounts()
      setSidebarCounts((response as any).data)
    } catch (error) {
      console.error('Failed to fetch sidebar counts:', error)
      // Set default counts on error
      setSidebarCounts({
        repair_tickets: 0,
        warranty_repair_tickets: 0,
        non_warranty_total: 0,
        warranty_total: 0
      })
    }
  }, [])

  useEffect(() => {
    fetchSidebarCounts()
  }, [fetchSidebarCounts])


  // Auto-open dropdowns when on child pages
  React.useEffect(() => {
    const navigationItems = getNavigationItems(sidebarCounts, user?.role, unreadFeedbackCount)
    const autoOpenDropdowns: string[] = []
    
    navigationItems.forEach(item => {
      if (item.type === 'dropdown' && item.children) {
        const hasActiveChild = item.children.some(child => location.pathname === child.href)
        if (hasActiveChild) {
          autoOpenDropdowns.push(item.name)
        }
      }
    })
    
    setOpenDropdowns(prev => {
      const newOpenDropdowns = [...new Set([...prev, ...autoOpenDropdowns])]
      return newOpenDropdowns
    })
  }, [location.pathname, sidebarCounts, user?.role, unreadFeedbackCount])

  const toggleDropdown = (itemName: string) => {
    setOpenDropdowns(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }


  const isDropdownOpen = (itemName: string) => openDropdowns.includes(itemName)

  const isActiveRoute = (href: string) => location.pathname === href

  const isParentActive = (children: any[]) => {
    return children.some(child => isActiveRoute(child.href))
  }

  return (
    <div className={cn("flex h-full w-64 flex-col bg-card border-r sidebar", className)}>
      {/* Logo */}
      <div className="flex h-12 items-center border-b px-4 py-2">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg overflow-hidden bg-white flex items-center justify-center border">
            <img 
              src="/kamer-ba-logo-v1.jpg" 
              alt="Kamer.ba Logo" 
              className="h-6 w-6 object-contain"
            />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Kamer.ba</h1>
            <p className="text-xs text-muted-foreground">Repair Management</p>
          </div>
        </div>
      </div>

      {/* Spacing between logo and navigation */}
      <div className="h-2"></div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-1">
        {getNavigationItems(sidebarCounts, user?.role, unreadFeedbackCount).map((item) => {
          if (item.type === 'label') {
            return (
              <div key={item.name} className="px-2 py-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {item.name}
                </h3>
              </div>
            )
          }

          if (item.type === 'single') {
            return (
              <Button
                key={item.name}
                variant={isActiveRoute(item.href!) ? "secondary" : "ghost"}
                className="w-full justify-start h-8 px-2 text-sm"
                onClick={() => navigate(item.href!)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span className="flex-1 text-left">{item.name}</span>
                {item.badge && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {item.badge}
                  </Badge>
                )}
              </Button>
            )
          }

          if (item.type === 'dropdown') {
            const isOpen = isDropdownOpen(item.name)
            const isActive = isParentActive(item.children!)
            
            return (
              <Collapsible
                key={item.name}
                open={isOpen}
                onOpenChange={() => toggleDropdown(item.name)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className="w-full justify-start h-8 px-2 text-sm"
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    <span className="flex-1 text-left">{item.name}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="ml-auto mr-2 text-xs">
                        {item.badge}
                      </Badge>
                    )}
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 ml-3 mt-1">
                  {item.children!.map((child) => (
                    <Button
                      key={child.name}
                      variant={isActiveRoute(child.href) ? "secondary" : "ghost"}
                      className="w-full justify-start h-7 px-2 text-xs"
                      onClick={() => {
                        navigate(child.href)
                        // Keep dropdown open when navigating to child
                        if (!isDropdownOpen(item.name)) {
                          setOpenDropdowns(prev => [...prev, item.name])
                        }
                      }}
                    >
                      <child.icon className="mr-2 h-3 w-3" />
                      <span className="flex-1 text-left">{child.name}</span>
                      {child.badge && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {child.badge}
                        </Badge>
                      )}
                    </Button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )
          }

          return null
        })}
      </nav>
    </div>
  )
}
