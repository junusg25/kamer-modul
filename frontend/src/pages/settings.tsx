import React, { useState } from 'react'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Switch } from '../components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Separator } from '../components/ui/separator'
import { 
  Users, 
  Shield, 
  Settings as SettingsIcon, 
  Mail, 
  Bell, 
  Database, 
  Palette, 
  Globe, 
  Lock, 
  BarChart3,
  Upload,
  Download,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  User,
  Key,
  Eye,
  EyeOff
} from 'lucide-react'

export default function Settings() {
  const [activeTab, setActiveTab] = useState('users')
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage system configuration, users, and preferences
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Config
            </Button>
            <Button size="sm">
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              System
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid gap-6">
              {/* User Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Management
                  </CardTitle>
                  <CardDescription>
                    Manage system users, roles, and access permissions
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Add New User */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium">Add New User</h3>
                      <p className="text-sm text-muted-foreground">Create a new user account</p>
                    </div>
                    <Button>
                      <User className="h-4 w-4 mr-2" />
                      Add User
                    </Button>
                  </div>

                  <Separator />

                  {/* Users List */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Current Users</h3>
                    <div className="space-y-3">
                      {[
                        { id: '1', name: 'John Doe', email: 'john@company.com', role: 'Admin', status: 'Active', lastLogin: '2 hours ago' },
                        { id: '2', name: 'Sarah Smith', email: 'sarah@company.com', role: 'Technician', status: 'Active', lastLogin: '1 day ago' },
                        { id: '3', name: 'Mike Johnson', email: 'mike@company.com', role: 'Sales', status: 'Inactive', lastLogin: '1 week ago' },
                        { id: '4', name: 'Lisa Brown', email: 'lisa@company.com', role: 'Manager', status: 'Active', lastLogin: '30 minutes ago' }
                      ].map((user) => (
                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{user.name}</p>
                                <Badge variant={user.status === 'Active' ? 'default' : 'secondary'}>
                                  {user.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                              <p className="text-xs text-muted-foreground">Last login: {user.lastLogin}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{user.role}</Badge>
                            <Button variant="outline" size="sm">Edit</Button>
                            <Button variant="outline" size="sm">Reset Password</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Role Permissions
                  </CardTitle>
                  <CardDescription>
                    Configure permissions for different user roles
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Role Selection */}
                  <div className="space-y-2">
                    <Label>Select Role</Label>
                    <Select defaultValue="admin">
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrator</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Separator />

                  {/* Permission Categories */}
                  <div className="space-y-6">
                    {[
                      {
                        category: 'Customer Management',
                        permissions: [
                          { name: 'View Customers', description: 'View customer list and details' },
                          { name: 'Create Customers', description: 'Add new customers' },
                          { name: 'Edit Customers', description: 'Modify customer information' },
                          { name: 'Delete Customers', description: 'Remove customers' }
                        ]
                      },
                      {
                        category: 'Work Orders',
                        permissions: [
                          { name: 'View Work Orders', description: 'View work order list and details' },
                          { name: 'Create Work Orders', description: 'Create new work orders' },
                          { name: 'Edit Work Orders', description: 'Modify work order information' },
                          { name: 'Delete Work Orders', description: 'Remove work orders' },
                          { name: 'Assign Technicians', description: 'Assign work orders to technicians' }
                        ]
                      },
                      {
                        category: 'Inventory',
                        permissions: [
                          { name: 'View Inventory', description: 'View inventory items' },
                          { name: 'Manage Inventory', description: 'Add, edit, delete inventory items' },
                          { name: 'Stock Management', description: 'Update stock levels' }
                        ]
                      },
                      {
                        category: 'Reports & Analytics',
                        permissions: [
                          { name: 'View Reports', description: 'Access reporting dashboard' },
                          { name: 'Export Data', description: 'Export data to CSV/PDF' },
                          { name: 'View Analytics', description: 'Access analytics and insights' }
                        ]
                      }
                    ].map((category) => (
                      <div key={category.category} className="space-y-3">
                        <h4 className="font-medium text-lg">{category.category}</h4>
                        <div className="grid gap-3">
                          {category.permissions.map((permission, index) => (
                            <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="font-medium">{permission.name}</p>
                                <p className="text-sm text-muted-foreground">{permission.description}</p>
                              </div>
                              <Switch defaultChecked={index % 3 !== 0} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <div className="grid gap-6">
              {/* Company Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                  <CardDescription>
                    Configure your company details and branding
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-name">Company Name</Label>
                      <Input id="company-name" defaultValue="Kamer Ba Repair Shop" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-email">Company Email</Label>
                      <Input id="company-email" type="email" defaultValue="info@kamerba.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company-address">Address</Label>
                    <Textarea id="company-address" defaultValue="123 Main Street, Sarajevo, Bosnia and Herzegovina" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company-phone">Phone</Label>
                      <Input id="company-phone" defaultValue="+387 33 123 456" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-website">Website</Label>
                      <Input id="company-website" defaultValue="www.kamerba.com" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company-vat">VAT Number</Label>
                      <Input id="company-vat" defaultValue="123456789" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SettingsIcon className="h-5 w-5" />
                    System Configuration
                  </CardTitle>
                  <CardDescription>
                    Configure system-wide settings and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select defaultValue="europe-sarajevo">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="europe-sarajevo">Europe/Sarajevo</SelectItem>
                            <SelectItem value="europe-london">Europe/London</SelectItem>
                            <SelectItem value="europe-berlin">Europe/Berlin</SelectItem>
                            <SelectItem value="america-new_york">America/New_York</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency">Default Currency</Label>
                        <Select defaultValue="km">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="km">KM (Bosnian Convertible Mark)</SelectItem>
                            <SelectItem value="eur">EUR (Euro)</SelectItem>
                            <SelectItem value="usd">USD (US Dollar)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-format">Date Format</Label>
                        <Select defaultValue="dd-mm-yyyy">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dd-mm-yyyy">DD/MM/YYYY</SelectItem>
                            <SelectItem value="mm-dd-yyyy">MM/DD/YYYY</SelectItem>
                            <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="business-hours">Business Hours</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="09:00" />
                          <Input placeholder="17:00" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                        <Input id="session-timeout" type="number" defaultValue="60" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="backup-frequency">Backup Frequency</Label>
                        <Select defaultValue="daily">
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Database Management */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Database Management
                  </CardTitle>
                  <CardDescription>
                    Manage database operations and maintenance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <Download className="h-6 w-6 mb-2" />
                      <span>Backup Database</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <Upload className="h-6 w-6 mb-2" />
                      <span>Restore Database</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
                      <RefreshCw className="h-6 w-6 mb-2" />
                      <span>Optimize Database</span>
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Database Size</p>
                      <p className="text-sm text-muted-foreground">Current database size and usage</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">2.4 GB</p>
                      <p className="text-sm text-muted-foreground">Last optimized: 2 days ago</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Notification Settings
                  </CardTitle>
                  <CardDescription>
                    Configure notification preferences and delivery methods
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Configuration */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Email Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-host">SMTP Host</Label>
                        <Input id="smtp-host" defaultValue="smtp.gmail.com" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-port">SMTP Port</Label>
                        <Input id="smtp-port" type="number" defaultValue="587" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="smtp-username">Username</Label>
                        <Input id="smtp-username" defaultValue="noreply@kamerba.com" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="smtp-password">Password</Label>
                        <div className="relative">
                          <Input id="smtp-password" type={showPasswords.smtp ? "text" : "password"} defaultValue="••••••••" />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => togglePasswordVisibility('smtp')}
                          >
                            {showPasswords.smtp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Notification Types */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Notification Types</h3>
                    <div className="space-y-3">
                      {[
                        { name: 'New Work Order', description: 'Notify when a new work order is created' },
                        { name: 'Work Order Completed', description: 'Notify when a work order is completed' },
                        { name: 'Overdue Items', description: 'Notify about overdue work orders and follow-ups' },
                        { name: 'Low Stock Alert', description: 'Notify when inventory items are low in stock' },
                        { name: 'Customer Updates', description: 'Notify about customer information changes' },
                        { name: 'System Alerts', description: 'Notify about system errors and maintenance' }
                      ].map((notification, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{notification.name}</p>
                            <p className="text-sm text-muted-foreground">{notification.description}</p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <Label htmlFor={`email-${index}`} className="text-sm">Email</Label>
                              <Switch id={`email-${index}`} defaultChecked />
                            </div>
                            <div className="flex items-center space-x-2">
                              <Label htmlFor={`sms-${index}`} className="text-sm">SMS</Label>
                              <Switch id={`sms-${index}`} />
                            </div>
                            <div className="flex items-center space-x-2">
                              <Label htmlFor={`push-${index}`} className="text-sm">Push</Label>
                              <Switch id={`push-${index}`} defaultChecked />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Appearance Tab */}
          <TabsContent value="appearance" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Theme & Appearance
                  </CardTitle>
                  <CardDescription>
                    Customize the look and feel of the application
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Theme Selection */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Theme</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                        <div className="h-20 bg-white border rounded mb-2"></div>
                        <p className="text-sm font-medium">Light</p>
                        <p className="text-xs text-muted-foreground">Clean and bright</p>
                      </div>
                      <div className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 border-primary">
                        <div className="h-20 bg-gray-900 border rounded mb-2"></div>
                        <p className="text-sm font-medium">Dark</p>
                        <p className="text-xs text-muted-foreground">Easy on the eyes</p>
                      </div>
                      <div className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50">
                        <div className="h-20 bg-gradient-to-r from-blue-500 to-purple-600 border rounded mb-2"></div>
                        <p className="text-sm font-medium">System</p>
                        <p className="text-xs text-muted-foreground">Follows system preference</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Branding */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Branding</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo-upload">Company Logo</Label>
                        <div className="flex items-center space-x-4">
                          <div className="h-16 w-16 border rounded-lg flex items-center justify-center">
                            <img src="/kamer-ba-logo-v1.jpg" alt="Logo" className="h-12 w-12 object-contain" />
                          </div>
                          <Button variant="outline">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload New Logo
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="primary-color">Primary Color</Label>
                        <div className="flex items-center space-x-2">
                          <Input id="primary-color" type="color" defaultValue="#3b82f6" className="w-20 h-10" />
                          <Input defaultValue="#3b82f6" className="flex-1" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Layout Preferences */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Layout Preferences</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Compact Mode</p>
                          <p className="text-sm text-muted-foreground">Use smaller spacing and components</p>
                        </div>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Show Sidebar Labels</p>
                          <p className="text-sm text-muted-foreground">Display text labels in the sidebar</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Auto-refresh Dashboard</p>
                          <p className="text-sm text-muted-foreground">Automatically refresh dashboard data</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Security Settings
                  </CardTitle>
                  <CardDescription>
                    Configure security policies and access controls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Password Policy */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Password Policy</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="min-password-length">Minimum Password Length</Label>
                        <Input id="min-password-length" type="number" defaultValue="8" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password-expiry">Password Expiry (days)</Label>
                        <Input id="password-expiry" type="number" defaultValue="90" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Require Uppercase Letters</p>
                          <p className="text-sm text-muted-foreground">Passwords must contain uppercase letters</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Require Numbers</p>
                          <p className="text-sm text-muted-foreground">Passwords must contain numbers</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Require Special Characters</p>
                          <p className="text-sm text-muted-foreground">Passwords must contain special characters</p>
                        </div>
                        <Switch />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Access Control */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Access Control</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">IP Whitelist</p>
                          <p className="text-sm text-muted-foreground">Restrict access to specific IP addresses</p>
                        </div>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Two-Factor Authentication</p>
                          <p className="text-sm text-muted-foreground">Require 2FA for all users</p>
                        </div>
                        <Switch />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Session Timeout</p>
                          <p className="text-sm text-muted-foreground">Automatically log out inactive users</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Audit Logs */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Audit & Monitoring</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Enable Audit Logging</p>
                          <p className="text-sm text-muted-foreground">Log all user actions and system changes</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Failed Login Alerts</p>
                          <p className="text-sm text-muted-foreground">Alert administrators of failed login attempts</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Recent Security Events</p>
                          <p className="text-sm text-muted-foreground">Last 24 hours</p>
                        </div>
                        <Badge variant="outline">3 Events</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
