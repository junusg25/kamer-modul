import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import {
  Package,
  Wrench,
  Settings,
  LogOut,
  User,
  Search
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const navigationItems: NavigationItem[] = [
  {
    name: 'My Items',
    href: '/dashboard',
    icon: Package,
  },
  {
    name: 'My Machines',
    href: '/machines',
    icon: Wrench,
  },
  {
    name: 'Track Item',
    href: '/',
    icon: Search,
  },
]

const bottomNavigationItems: NavigationItem[] = [
  {
    name: 'Profile',
    href: '/profile',
    icon: User,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function Sidebar({ className }: SidebarProps) {
  const location = useLocation()

  const isActiveRoute = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname === href
  }

  const handleLogout = () => {
    localStorage.removeItem('customer_token')
    localStorage.removeItem('customer_user')
    window.location.href = '/'
  }

  return (
    <div className={cn('flex h-full w-64 flex-col bg-card border-r customer-portal-sidebar', className)}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b px-4">
        <Link to="/dashboard" className="flex items-center space-x-2">
          <img 
            src="/kamer-ba-logo-v1.jpg" 
            alt="Kamer Ba Logo" 
            className="h-8 w-auto"
          />
          <span className="text-lg font-semibold text-foreground">Customer Portal</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = isActiveRoute(item.href)
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors customer-portal-nav-item',
                isActive ? 'active' : ''
              )}
            >
              <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
              {item.badge && (
                <span className="ml-auto rounded-full bg-primary px-2 py-1 text-xs text-primary-foreground">
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t p-4 space-y-1">
        {bottomNavigationItems.map((item) => {
          const Icon = item.icon
          const isActive = isActiveRoute(item.href)
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors customer-portal-nav-item',
                isActive ? 'active' : ''
              )}
            >
              <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}
        
        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="group flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogOut className="mr-3 h-4 w-4 flex-shrink-0" />
          <span className="truncate">Sign Out</span>
        </button>
      </div>
    </div>
  )
}
