import React from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  CssBaseline,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  ThemeProvider,
  createTheme,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon as MuiListItemIcon,
  Tooltip,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Security as SecurityIcon,
  Build as BuildIcon,
  PrecisionManufacturing as MachineIcon,
  People as CustomerIcon,
  Inventory as InventoryIcon,
  Person as UserIcon,
  Groups2 as UsersIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Brightness4,
  Brightness7,
  AccountCircle,
  Logout,
} from '@mui/icons-material'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import NotificationBell from './NotificationBell'
import LanguageSwitcher from './LanguageSwitcher'

const drawerWidth = 240

export default function Layout({ onThemeToggle, mode }) {
  const { user, logout } = useAuth()
  const { translate } = useLanguage()
  
  const menuItems = [
    { text: translate('navigation.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { text: translate('navigation.warranty'), icon: <SecurityIcon />, path: '/warranty' },
    { text: translate('navigation.nonWarranty'), icon: <BuildIcon />, path: '/non-warranty' },
    { text: translate('navigation.machines'), icon: <MachineIcon />, path: '/machines' },
    { text: translate('navigation.customers'), icon: <CustomerIcon />, path: '/customers' },
    { text: translate('navigation.inventory'), icon: <InventoryIcon />, path: '/inventory' },
  ]
  const theme = useTheme()
  const { pathname } = useLocation()
  const [anchorEl, setAnchorEl] = React.useState(null)
  const [searchQuery, setSearchQuery] = React.useState('')

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget)
  }

  const handleProfileMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`
    }
  }

  const drawer = (
    <Box>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
          <BuildIcon />
        </Avatar>
      </Box>
      <Divider />
      <List sx={{ pt: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              component={Link}
              to={item.path}
              selected={pathname === item.path || 
                       (item.path === '/warranty' && (pathname.includes('/warranty-repair-tickets') || pathname.includes('/warranty-work-orders'))) ||
                       (item.path === '/non-warranty' && (pathname.includes('/repair-tickets') || pathname.includes('/work-orders')))}
              sx={{
                mx: 1,
                borderRadius: 2,
                minHeight: 48,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
        {user?.role === 'admin' && (
          <ListItem disablePadding>
            <ListItemButton
              component={Link}
              to="/users"
              selected={pathname === '/users'}
              sx={{
                mx: 1,
                borderRadius: 2,
                minHeight: 48,
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                <UsersIcon />
              </ListItemIcon>
              <ListItemText primary={translate('navigation.users')} />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: 'background.paper',
          color: 'text.primary',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        <Toolbar>
          <Box sx={{ flexGrow: 1 }} />
          <TextField
            size="small"
            placeholder={translate('navigation.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            sx={{ mr: 2, minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <NotificationBell />
          <LanguageSwitcher />
          <IconButton color="inherit" onClick={onThemeToggle} sx={{ mr: 1 }}>
            {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
          <IconButton
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </MenuItem>
            <MenuItem disabled>
              <Typography variant="body2" color="text.secondary">
                {translate('navigation.role')}: {user?.role}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={logout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              {translate('navigation.logout')}
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              backgroundColor: 'background.paper',
              borderRight: `1px solid ${theme.palette.divider}`,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}


