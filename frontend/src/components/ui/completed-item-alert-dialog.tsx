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

interface CompletedItemAlertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemName?: string
  itemType?: string
  title?: string
  description?: string
}

export function CompletedItemAlertDialog({
  open,
  onOpenChange,
  itemName,
  itemType = 'item',
  title = 'Cannot Delete Completed Item',
  description
}: CompletedItemAlertDialogProps) {
  const defaultDescription = `${itemName ? `"${itemName}"` : `This ${itemType}`} is completed and cannot be deleted. Please contact your administrator if you need to remove this ${itemType}.`
  
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
