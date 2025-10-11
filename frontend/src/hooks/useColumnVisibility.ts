import { useState, useEffect, useCallback } from 'react'
import apiService from '../services/api'

/**
 * Smart column visibility hook with hybrid storage
 * 
 * Strategy:
 * 1. Load from localStorage immediately (instant render)
 * 2. Fetch from database in background
 * 3. Merge: database takes precedence if it exists
 * 4. On change: save to both localStorage AND database
 * 5. Fallback: if database fails, localStorage still works
 * 
 * @param tableKey - Unique identifier for the table (e.g., 'customers', 'work_orders')
 * @param defaultColumns - Array of default visible column keys
 * @returns Object with visibleColumns, toggleColumn, setVisibleColumns, resetColumns, isColumn visible
 */
export function useColumnVisibility(tableKey: string, defaultColumns: string[]) {
  const [visibleColumns, setVisibleColumnsState] = useState<string[]>(() => {
    // Load from localStorage immediately for instant render
    const localStorageKey = `table_columns_${tableKey}`
    const saved = localStorage.getItem(localStorageKey)
    return saved ? JSON.parse(saved) : defaultColumns
  })

  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  // Fetch from database on mount
  useEffect(() => {
    const fetchFromDatabase = async () => {
      try {
        const response = await apiService.getTablePreference(tableKey) as any
        
        if (response.status === 'success' && response.data) {
          const dbColumns = response.data.visible_columns
          
          // Database data exists - use it
          if (Array.isArray(dbColumns) && dbColumns.length > 0) {
            setVisibleColumnsState(dbColumns)
            
            // Also update localStorage to keep them in sync
            const localStorageKey = `table_columns_${tableKey}`
            localStorage.setItem(localStorageKey, JSON.stringify(dbColumns))
          }
        }
      } catch (error: any) {
        // If 404 or error, that's fine - use localStorage/defaults
        if (error.status !== 404) {
          
        }
      } finally {
        setIsLoading(false)
      }
    }

    fetchFromDatabase()
  }, [tableKey])

  // Save to both localStorage and database
  const savePreferences = useCallback(async (columns: string[]) => {
    const localStorageKey = `table_columns_${tableKey}`
    
    // Save to localStorage immediately (instant)
    localStorage.setItem(localStorageKey, JSON.stringify(columns))
    
    // Save to database in background (don't block UI)
    setIsSyncing(true)
    try {
      await apiService.saveTablePreference(tableKey, columns)
    } catch (error) {
      console.error(`Failed to sync table preferences for ${tableKey}:`, error)
      // Don't show error to user - localStorage still works
    } finally {
      setIsSyncing(false)
    }
  }, [tableKey])

  // Set visible columns (used internally and can be exposed)
  const setVisibleColumns = useCallback((columns: string[]) => {
    setVisibleColumnsState(columns)
    savePreferences(columns)
  }, [savePreferences])

  // Toggle a single column
  const toggleColumn = useCallback((columnKey: string) => {
    setVisibleColumnsState((prev) => {
      const newColumns = prev.includes(columnKey)
        ? prev.filter((c) => c !== columnKey)
        : [...prev, columnKey]
      
      savePreferences(newColumns)
      return newColumns
    })
  }, [savePreferences])

  // Check if a column is visible
  const isColumnVisible = useCallback((columnKey: string) => {
    return visibleColumns.includes(columnKey)
  }, [visibleColumns])

  // Reset to default columns
  const resetColumns = useCallback(async () => {
    const localStorageKey = `table_columns_${tableKey}`
    
    // Update state
    setVisibleColumnsState(defaultColumns)
    
    // Remove from localStorage
    localStorage.removeItem(localStorageKey)
    
    // Delete from database
    setIsSyncing(true)
    try {
      await apiService.deleteTablePreference(tableKey)
    } catch (error) {
      console.error(`Failed to reset table preferences for ${tableKey}:`, error)
      // Don't show error - localStorage is already cleared
    } finally {
      setIsSyncing(false)
    }
  }, [tableKey, defaultColumns])

  // Show all columns
  const showAllColumns = useCallback(() => {
    setVisibleColumns(defaultColumns)
  }, [defaultColumns, setVisibleColumns])

  // Hide all columns (keep at least one for usability)
  const hideAllColumns = useCallback(() => {
    // Keep the first column visible (usually ID or name)
    const firstColumn = defaultColumns[0]
    setVisibleColumns([firstColumn])
  }, [defaultColumns, setVisibleColumns])

  return {
    visibleColumns,
    setVisibleColumns,
    toggleColumn,
    isColumnVisible,
    resetColumns,
    showAllColumns,
    hideAllColumns,
    isLoading,
    isSyncing,
    defaultColumns
  }
}

/**
 * Column definition type
 */
export type ColumnDefinition = {
  key: string
  label: string
}

/**
 * Helper function to define columns for a table
 * 
 * @example
 * const columns = defineColumns([
 *   { key: 'name', label: 'Customer Name' },
 *   { key: 'email', label: 'Email' },
 *   { key: 'phone', label: 'Phone' }
 * ])
 */
export function defineColumns(columns: ColumnDefinition[]): ColumnDefinition[] {
  return columns
}

/**
 * Helper function to get default column keys
 * 
 * @example
 * const defaultColumns = getDefaultColumnKeys(columns)
 */
export function getDefaultColumnKeys(columns: ColumnDefinition[]): string[] {
  return columns.map((col) => col.key)
}
