import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Plus,
  User,
  FileText,
  ClipboardList,
  Calendar,
  Package,
  MessageSquare,
  BarChart3
} from 'lucide-react'

interface QuickAction {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  color: string
}

const quickActions: QuickAction[] = [
  {
    title: 'New Customer',
    description: 'Add a new customer to the system',
    icon: User,
    href: '/add-customer',
    color: 'bg-orange-500 hover:bg-orange-600'
  },
  {
    title: 'Create Repair Ticket',
    description: 'Create a new repair ticket',
    icon: FileText,
    href: '/create-repair-ticket',
    color: 'bg-green-500 hover:bg-green-600'
  },
  {
    title: 'Create Warranty Ticket',
    description: 'Create a new warranty repair ticket',
    icon: ClipboardList,
    href: '/create-warranty-repair-ticket',
    color: 'bg-purple-500 hover:bg-purple-600'
  },
  {
    title: 'Add Machine Model',
    description: 'Add a new machine model',
    icon: Calendar,
    href: '/add-machine-model',
    color: 'bg-orange-500 hover:bg-orange-600'
  },
  {
    title: 'Add Inventory Item',
    description: 'Add new inventory items',
    icon: Package,
    href: '/add-inventory-item',
    color: 'bg-indigo-500 hover:bg-indigo-600'
  },
  {
    title: 'View Quotes',
    description: 'View and manage quotes',
    icon: MessageSquare,
    href: '/quotes',
    color: 'bg-pink-500 hover:bg-pink-600'
  }
]

export function QuickActions() {
  const navigate = useNavigate()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Quick Actions</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action, index) => {
            const Icon = action.icon
            return (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start space-y-2 hover:bg-accent"
                onClick={() => navigate(action.href)}
              >
                <div className="flex items-center space-x-2 w-full">
                  <div className={`p-2 rounded-md ${action.color} text-white`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">{action.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
