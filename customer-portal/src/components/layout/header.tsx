import React from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { Search, User } from 'lucide-react'

interface HeaderProps {
  className?: string
  onMenuClick?: () => void
}

export function Header({ className, onMenuClick }: HeaderProps) {
  const navigate = useNavigate()
  const customerUser = JSON.parse(localStorage.getItem('customer_user') || '{}')

  const handleLogout = () => {
    localStorage.removeItem('customer_token')
    localStorage.removeItem('customer_user')
    navigate('/')
  }

  return (
    <header className={cn('flex h-16 items-center justify-between border-b bg-card px-6 customer-portal-header', className)}>
      {/* Left side */}
      <div className="flex items-center space-x-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="rounded-md p-2 hover:bg-accent md:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
        
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search items..."
            className="w-64 rounded-md border bg-background pl-10 pr-4 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-4">
        {/* User Menu */}
        <div className="flex items-center space-x-3">
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-foreground">
              {customerUser.name || 'Customer'}
            </p>
            <p className="text-xs text-muted-foreground">
              {customerUser.email || 'customer@example.com'}
            </p>
          </div>
          
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <User className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      </div>
    </header>
  )
}
