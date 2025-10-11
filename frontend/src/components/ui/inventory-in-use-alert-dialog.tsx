import React from 'react'
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
  title = 'Cannot Delete Inventory Item',
  description
}: InventoryInUseAlertDialogProps) {
  const defaultDescription = `${itemName ? `"${itemName}"` : 'This inventory item'} is currently used in ${workOrderCount} work order${workOrderCount > 1 ? 's' : ''} and cannot be deleted. Please remove it from all work orders before deleting.`
  
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description || defaultDescription}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>
            OK
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
