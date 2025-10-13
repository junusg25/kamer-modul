import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { debounce } from '@/utils/searchUtils';

interface SmartSearchProps {
  placeholder?: string;
  onSearch: (searchTerm: string) => void;
  onClear?: () => void;
  debounceMs?: number;
  className?: string;
  showClearButton?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function SmartSearch({
  placeholder = "Search...",
  onSearch,
  onClear,
  debounceMs = 300,
  className,
  showClearButton = true,
  autoFocus = false,
  disabled = false
}: SmartSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Handle search button click
  const handleSearchClick = () => {
    setIsSearching(true);
    onSearch(searchTerm);
    // Reset searching state after a short delay
    setTimeout(() => setIsSearching(false), 500);
  };

  // Handle clear search
  const handleClear = () => {
    setSearchTerm('');
    setIsSearching(false);
    onSearch('');
    onClear?.();
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchClick();
    }
  };

  // Handle Escape key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {showClearButton && searchTerm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-muted"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <Button
        onClick={handleSearchClick}
        disabled={disabled || isSearching}
        className="shrink-0"
      >
        {isSearching ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          'Search'
        )}
      </Button>
    </div>
  );
}

// Enhanced SmartSearch with search button (for pages that need explicit search)
export function SmartSearchWithButton({
  placeholder = "Search...",
  onSearch,
  onClear,
  debounceMs = 300,
  className,
  showClearButton = true,
  autoFocus = false,
  disabled = false,
  buttonText = "Search"
}: SmartSearchProps & { buttonText?: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      onSearch(term);
      setIsSearching(false);
    }, debounceMs),
    [onSearch, debounceMs]
  );

  // Handle search term changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setIsSearching(true);
    debouncedSearch(value);
  };

  // Handle search button click
  const handleSearchClick = () => {
    // Cancel debounce and search immediately
    debouncedSearch.cancel?.();
    onSearch(searchTerm);
    setIsSearching(false);
  };

  // Handle clear search
  const handleClear = () => {
    setSearchTerm('');
    setIsSearching(false);
    onSearch('');
    onClear?.();
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearchClick();
    }
  };

  // Handle Escape key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          disabled={disabled}
          className="pl-10 pr-10"
        />
        {showClearButton && searchTerm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2 p-0 hover:bg-muted"
            disabled={disabled}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        )}
      </div>
      <Button
        onClick={handleSearchClick}
        disabled={disabled || isSearching}
        className="shrink-0"
      >
        {buttonText}
      </Button>
    </div>
  );
}
