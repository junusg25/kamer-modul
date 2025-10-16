import { useState } from 'react'
import { Button } from './button'
import { Checkbox } from './checkbox'
import { Label } from './label'
import { Input } from './input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Columns3, RotateCcw, Eye, EyeOff, Loader2 } from 'lucide-react'
import { ScrollArea } from './scroll-area'
import { useTranslation } from 'react-i18next'

interface ColumnDefinition {
  key: string
  label: string
}

interface ColumnVisibilityDropdownProps {
  columns: ColumnDefinition[]
  visibleColumns: string[]
  onToggleColumn: (columnKey: string) => void
  onShowAll: () => void
  onHideAll: () => void
  onReset: () => void
  isSyncing?: boolean
}

export function ColumnVisibilityDropdown({
  columns,
  visibleColumns,
  onToggleColumn,
  onShowAll,
  onHideAll,
  onReset,
  isSyncing = false
}: ColumnVisibilityDropdownProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  // Filter columns based on search query
  const filteredColumns = columns.filter((col) =>
    col.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const visibleCount = visibleColumns.length
  const totalCount = columns.length

  const handleToggle = (columnKey: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleColumn(columnKey)
  }

  const handleShowAll = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onShowAll()
  }

  const handleHideAll = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onHideAll()
  }

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onReset()
    setSearchQuery('')
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Columns3 className="h-4 w-4 mr-2" />
          {t('columns')}
          {isSyncing && <Loader2 className="h-3 w-3 ml-2 animate-spin" />}
          {!isSyncing && (
            <span className="ml-2 text-xs text-muted-foreground">
              ({visibleCount}/{totalCount})
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[280px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{t('column_visibility')}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {visibleCount} {t('of')} {totalCount}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Search input for many columns */}
        {columns.length > 8 && (
          <>
            <div className="px-2 py-2">
              <Input
                placeholder={t('search_columns')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Quick actions */}
        <div className="px-2 py-1 flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleShowAll}
          >
            <Eye className="h-3 w-3 mr-1" />
            {t('show_all')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 flex-1 text-xs"
            onClick={handleHideAll}
          >
            <EyeOff className="h-3 w-3 mr-1" />
            {t('hide_all')}
          </Button>
        </div>
        <DropdownMenuSeparator />

        {/* Column list */}
        <ScrollArea className="h-[300px]">
          <div className="px-2 py-1 space-y-1">
            {filteredColumns.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4">
                {t('no_columns_found')}
              </div>
            ) : (
              filteredColumns.map((column) => {
                const isVisible = visibleColumns.includes(column.key)
                return (
                  <div
                    key={column.key}
                    className="flex items-center space-x-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer"
                    onClick={(e) => handleToggle(column.key, e)}
                  >
                    <Checkbox
                      id={`column-${column.key}`}
                      checked={isVisible}
                      onCheckedChange={() => onToggleColumn(column.key)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Label
                      htmlFor={`column-${column.key}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {column.label}
                    </Label>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>

        {/* Reset button */}
        <DropdownMenuSeparator />
        <div className="px-2 py-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8"
            onClick={handleReset}
          >
            <RotateCcw className="h-3 w-3 mr-2" />
            {t('reset_to_default')}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
