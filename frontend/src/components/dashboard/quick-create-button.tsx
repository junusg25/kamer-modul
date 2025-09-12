import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  User,
  FileText,
  ClipboardList,
  Calendar,
  Package,
  MessageSquare,
  ChevronDown,
  Wrench,
  TrendingUp
} from 'lucide-react'

interface QuickAction {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
  permission?: string
}

const quickActions: QuickAction[] = [
  {
    title: 'New Customer',
    description: 'Add a new customer to the system',
    icon: User,
    href: '/add-customer',
    color: 'text-orange-600',
    permission: 'customers:write'
  },
  {
    title: 'Create Repair Ticket',
    description: 'Create a new repair ticket',
    icon: FileText,
    href: '/create-repair-ticket',
    color: 'text-green-600',
    permission: 'repair_tickets:write'
  },
  {
    title: 'Create Warranty Ticket',
    description: 'Create a new warranty repair ticket',
    icon: ClipboardList,
    href: '/create-warranty-repair-ticket',
    color: 'text-purple-600',
    permission: 'repair_tickets:write'
  },
  {
    title: 'Add Inventory Item',
    description: 'Add new inventory items',
    icon: Package,
    href: '/add-inventory-item',
    color: 'text-indigo-600',
    permission: 'inventory:write'
  },
  {
    title: 'View Quotes',
    description: 'View and manage quotes',
    icon: MessageSquare,
    href: '/quote-management',
    color: 'text-pink-600',
    permission: 'quotes:read'
  },
  {
    title: 'Add Machine Model',
    description: 'Add a new machine model',
    icon: Calendar,
    href: '/add-machine-model',
    color: 'text-orange-600',
    permission: 'machines:write'
  },
  {
    title: 'Assign Machine',
    description: 'Assign a machine to a customer',
    icon: Wrench,
    href: '/machines',
    color: 'text-blue-600',
    permission: 'machines:assign'
  },
  {
    title: 'Create Lead',
    description: 'Create a new sales lead',
    icon: TrendingUp,
    href: '/pipeline-leads',
    color: 'text-green-600',
    permission: 'pipeline:write'
  }
]

export function QuickCreateButton() {
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const handleActionClick = (href: string) => {
    navigate(href)
    setIsOpen(false)
  }

  // Filter actions based on user permissions
  const availableActions = quickActions.filter(action => 
    !action.permission || hasPermission(action.permission)
  )

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Plus className="h-4 w-4" />
          <span className="ml-2">Click to create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {availableActions.length === 0 ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            No actions available for your role
          </div>
        ) : (
          availableActions.map((action, index) => {
          const Icon = action.icon
          return (
            <DropdownMenuItem
              key={index}
              onClick={() => handleActionClick(action.href)}
              className="flex items-center space-x-3 p-3 cursor-pointer"
            >
              <Icon className={`h-4 w-4 ${action.color}`} />
              <div className="flex-1">
                <p className="text-sm font-medium">{action.title}</p>
                <p className="text-xs text-muted-foreground">
                  {action.description}
                </p>
              </div>
            </DropdownMenuItem>
          )
        })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
