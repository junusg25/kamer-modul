import { Button } from './button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
  pageSize: number
  onPageChange: (page: number) => void
  itemName?: string
}

export function Pagination({
  currentPage,
  totalPages,
  totalCount,
  pageSize,
  onPageChange,
  itemName = 'items'
}: PaginationProps) {
  if (totalPages <= 1) return null

  const startItem = ((currentPage - 1) * pageSize) + 1
  const endItem = Math.min(currentPage * pageSize, totalCount)

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = []
    const maxPagesToShow = 7 // Show up to 7 page buttons

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      if (currentPage <= 3) {
        // Near the start
        for (let i = 2; i <= Math.min(5, totalPages - 1); i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      } else if (currentPage >= totalPages - 2) {
        // Near the end
        pages.push('...')
        for (let i = Math.max(totalPages - 4, 2); i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        // In the middle
        pages.push('...')
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i)
        }
        pages.push('...')
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="flex items-center justify-between px-2 py-4">
      <div className="text-sm text-muted-foreground">
        Showing {startItem} to {endItem} of {totalCount} {itemName}
      </div>
      
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <div className="flex items-center space-x-1">
          {getPageNumbers().map((page, index) => {
            if (page === '...') {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                  ...
                </span>
              )
            }

            return (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => onPageChange(page as number)}
                className="min-w-[2.5rem]"
              >
                {page}
              </Button>
            )
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}

