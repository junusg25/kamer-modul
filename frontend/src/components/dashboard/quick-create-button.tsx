import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { useTranslation } from 'react-i18next'
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

const getQuickActions = (t: any): QuickAction[] => [
  {
    title: t('quick_create_new_customer'),
    description: t('quick_create_new_customer_description'),
    icon: User,
    href: '/add-customer',
    color: 'text-orange-600',
    permission: 'customers:write'
  },
  {
    title: t('quick_create_repair_ticket'),
    description: t('quick_create_repair_ticket_description'),
    icon: FileText,
    href: '/create-repair-ticket',
    color: 'text-green-600',
    permission: 'repair_tickets:write'
  },
  {
    title: t('quick_create_warranty_ticket'),
    description: t('quick_create_warranty_ticket_description'),
    icon: ClipboardList,
    href: '/create-warranty-repair-ticket',
    color: 'text-purple-600',
    permission: 'repair_tickets:write'
  },
  {
    title: t('quick_create_add_inventory'),
    description: t('quick_create_add_inventory_description'),
    icon: Package,
    href: '/add-inventory-item',
    color: 'text-indigo-600',
    permission: 'inventory:write'
  },
  {
    title: t('quick_create_view_quotes'),
    description: t('quick_create_view_quotes_description'),
    icon: MessageSquare,
    href: '/quote-management',
    color: 'text-pink-600',
    permission: 'quotes:read'
  },
  {
    title: t('quick_create_add_machine_model'),
    description: t('quick_create_add_machine_model_description'),
    icon: Calendar,
    href: '/add-machine-model',
    color: 'text-orange-600',
    permission: 'machines:write'
  },
  {
    title: t('quick_create_assign_machine'),
    description: t('quick_create_assign_machine_description'),
    icon: Wrench,
    href: '/machines',
    color: 'text-blue-600',
    permission: 'machines:assign'
  },
  {
    title: t('quick_create_create_lead'),
    description: t('quick_create_create_lead_description'),
    icon: TrendingUp,
    href: '/pipeline-leads',
    color: 'text-green-600',
    permission: 'pipeline:write'
  }
]

export function QuickCreateButton() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  const handleActionClick = (href: string) => {
    navigate(href)
    setIsOpen(false)
  }

  // Filter actions based on user permissions
  const quickActions = getQuickActions(t)
  const availableActions = quickActions.filter(action => 
    !action.permission || hasPermission(action.permission)
  )

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start">
          <Plus className="h-4 w-4" />
          <span className="ml-2">{t('quick_create_button')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {availableActions.length === 0 ? (
          <div className="p-3 text-center text-sm text-muted-foreground">
            {t('quick_create_no_actions')}
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
