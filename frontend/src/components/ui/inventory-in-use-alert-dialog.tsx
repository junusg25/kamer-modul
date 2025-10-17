import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog'

interface InventoryInUseAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName?: string
  workOrderCount?: number
  title?: string
  description?: string
}

export function InventoryInUseAlertDialog({
  open,
  onOpenChange,
  itemName,
  workOrderCount = 0,
  title,
  description
}: InventoryInUseAlertDialogProps) {
  const { t } = useTranslation()
  const defaultTitle = t('inventory_cannot_delete_item')
  const defaultDescription = t('inventory_cannot_delete_description', { 
    itemName: itemName || t('inventory_this_item'),
    count: workOrderCount 
  })
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title || defaultTitle}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            {t('ok')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
