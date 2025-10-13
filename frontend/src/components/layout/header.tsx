import React from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTheme } from '@/contexts/theme-context'
import { useAuth } from '@/contexts/auth-context'
import { SimpleNotificationDropdown } from '@/components/notifications/simple-notification-dropdown'
import {
  Search,
  Settings,
  Menu,
  Sun,
  Moon,
  LogOut,
  Command
} from 'lucide-react'

interface HeaderProps {
  className?: string
  onMenuClick?: () => void
}

export function Header({ className, onMenuClick }: HeaderProps) {
  const { theme, setTheme, actualTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else {
      setTheme('light')
    }
  }

  const getThemeIcon = () => {
    if (theme === 'dark') {
      return <Moon className="h-5 w-5" />
    } else {
      return <Sun className="h-5 w-5" />
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const openCommandPalette = () => {
    // Trigger Ctrl+K programmatically
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true
    })
    document.dispatchEvent(event)
  }

  return (
    <header className={cn("sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-background px-6", className)}>
      {/* Left side */}
      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        <div className="hidden md:block">
          <p className="text-sm text-muted-foreground">
            Welcome back, {user?.name || 'User'}
          </p>
        </div>
      </div>

      {/* Center - Command Palette Trigger */}
      <div className="flex-1 max-w-md mx-4">
        <button
          onClick={openCommandPalette}
          className="w-full flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search or jump to...</span>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />
            <span>K</span>
          </kbd>
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center space-x-2">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={cycleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {getThemeIcon()}
        </Button>

        {/* Notifications */}
        <SimpleNotificationDropdown />

        {/* Settings */}
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>

        {/* User Menu */}
        <div className="flex items-center space-x-2 pl-2 border-l">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar} alt={user?.name} />
            <AvatarFallback>
              {user?.name?.split(' ').map(n => n[0]).join('') || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:block">
            <p className="text-sm font-medium">{user?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role || 'User'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
