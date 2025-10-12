import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { MainLayout } from '../components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { useAuth } from '../contexts/auth-context'
import { 
  Users, 
  Shield, 
  CheckCircle,
  XCircle,
  Plus,
  Edit2,
  Trash2,
  Key,
  Clock,
  AlertTriangle
} from 'lucide-react'
import apiService from '../services/api'
import { formatDateTime } from '../lib/dateTime'

interface User {
  id: number
  name: string
  email: string
  role: string
  status: string
}

interface PermissionOverride {
  id: number
  permission_key: string
  granted: boolean
  granted_at: string
  expires_at?: string
  reason?: string
  granted_by_name?: string
}

interface AvailablePermissions {
  [category: string]: {
    [key: string]: {
      description: string
      defaultRoles: string[]
    }
  }
}

export default function Settings() {
  const { user: currentUser, refreshPermissions } = useAuth()
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<PermissionOverride[]>([])
  const [availablePermissions, setAvailablePermissions] = useState<AvailablePermissions>({})
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [showEditUserDialog, setShowEditUserDialog] = useState(false)
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [permissionForm, setPermissionForm] = useState({
    permission_key: '',
    expires_at: '',
    reason: ''
  })
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'technician',
    phone: '',
    department: ''
  })
  const [editUserForm, setEditUserForm] = useState({
    name: '',
    email: '',
    role: '',
    phone: '',
    department: '',
    status: ''
  })
  const [changePasswordForm, setChangePasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadUsers()
    loadAvailablePermissions()
  }, [])

  const loadUsers = async () => {
    try {
      setUsersLoading(true)
      const response = await apiService.getUsers()
      setUsers(response.data || [])
    } catch (error) {
      console.error('Error loading users:', error)
      alert('Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }

  const loadAvailablePermissions = async () => {
    try {
      const response = await apiService.getAvailablePermissions()
      setAvailablePermissions(response.data || {})
    } catch (error) {
      console.error('Error loading permissions:', error)
    }
  }

  const handleAddUser = async () => {
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
      toast.error('Please fill in all required fields')
      return
    }

    if (newUserForm.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setIsSubmitting(true)
    try {
      // Only send phone if it's not empty
      const payload: any = {
        name: newUserForm.name,
        email: newUserForm.email,
        password: newUserForm.password,
        role: newUserForm.role,
        department: newUserForm.department || undefined
      }

      // Only add phone if provided
      if (newUserForm.phone && newUserForm.phone.trim()) {
        payload.phone = newUserForm.phone
      }

      await apiService.request('/users/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      toast.success('User created successfully')
      setShowAddUserDialog(false)
      setNewUserForm({
        name: '',
        email: '',
        password: '',
        role: 'technician',
        phone: '',
        department: ''
      })
      loadUsers()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const loadUserPermissions = async (userId: number) => {
    try {
      const response = await apiService.getUserPermissions(userId.toString())
      setUserPermissions(response.data?.overrides || [])
    } catch (error) {
      console.error('Error loading user permissions:', error)
      alert('Failed to load user permissions')
    }
  }

  const handleUserSelect = async (user: User) => {
    setSelectedUser(user)
    await loadUserPermissions(user.id)
  }

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      phone: (user as any).phone || '',
      department: (user as any).department || '',
      status: user.status
    })
    setShowEditUserDialog(true)
  }

  const handleSaveEditUser = async () => {
    if (!editingUser || !editUserForm.name || !editUserForm.email) {
      toast.error('Please fill in required fields')
      return
    }

    setIsSubmitting(true)
    try {
      await apiService.updateUser(editingUser.id.toString(), editUserForm)
      toast.success('User updated successfully')
      setShowEditUserDialog(false)
      setEditingUser(null)
      await loadUsers()
      // Refresh selected user if it was the edited one
      if (selectedUser?.id === editingUser.id) {
        const updated = users.find(u => u.id === editingUser.id)
        if (updated) setSelectedUser(updated)
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = (user: User) => {
    setEditingUser(user)
    setChangePasswordForm({ newPassword: '', confirmPassword: '' })
    setShowChangePasswordDialog(true)
  }

  const handleSavePassword = async () => {
    if (!editingUser) return

    if (!changePasswordForm.newPassword || changePasswordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsSubmitting(true)
    try {
      await apiService.updateUser(editingUser.id.toString(), {
        password: changePasswordForm.newPassword
      })
      toast.success('Password changed successfully')
      setShowChangePasswordDialog(false)
      setEditingUser(null)
      setChangePasswordForm({ newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      toast.error(error.message || 'Failed to change password')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleGrantPermission = () => {
    setShowPermissionDialog(true)
  }

  const handleSavePermission = async () => {
    if (!selectedUser || !permissionForm.permission_key) {
      alert('Please select a permission')
      return
    }

    try {
      await apiService.grantPermission({
        user_id: selectedUser.id,
        permission_key: permissionForm.permission_key,
        expires_at: permissionForm.expires_at || undefined,
        reason: permissionForm.reason || undefined
      })

      toast.success('Permission granted successfully', {
        description: `${selectedUser.name} can now access ${permissionForm.permission_key}`
      })
      setShowPermissionDialog(false)
      setPermissionForm({ permission_key: '', expires_at: '', reason: '' })
      await loadUserPermissions(selectedUser.id)
      
      // Refresh current user's permissions if they were modified
      if (currentUser && selectedUser.id === parseInt(currentUser.id)) {
        await refreshPermissions()
      }
    } catch (error) {
      console.error('Error granting permission:', error)
      toast.error('Failed to grant permission', {
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    }
  }

  const handleRevokePermission = async (permissionKey: string) => {
    if (!selectedUser) return

    if (!confirm('Are you sure you want to revoke this permission?')) return

    try {
      await apiService.revokePermission({
        user_id: selectedUser.id,
        permission_key: permissionKey,
        reason: 'Revoked by admin'
      })

      toast.success('Permission revoked successfully', {
        description: `${selectedUser.name} no longer has access to ${permissionKey}`
      })
      await loadUserPermissions(selectedUser.id)
      
      // Refresh current user's permissions if they were modified
      if (currentUser && selectedUser.id === parseInt(currentUser.id)) {
        await refreshPermissions()
      }
    } catch (error) {
      console.error('Error revoking permission:', error)
      toast.error('Failed to revoke permission', {
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive'
      case 'manager': return 'default'
      case 'technician': return 'secondary'
      case 'sales': return 'outline'
      default: return 'secondary'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'default'
      case 'inactive': return 'secondary'
      default: return 'outline'
    }
  }

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin'

  if (!isAdmin) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access settings.</p>
          </div>
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
            <p className="text-muted-foreground">
              Manage users, permissions, and system configuration
            </p>
          </div>
          <Button
            onClick={() => setShowAddUserDialog(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* Settings Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Permissions
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Users List */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-foreground">All Users</CardTitle>
                  <CardDescription>Select a user to manage their permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="text-center py-4 text-muted-foreground">Loading users...</div>
                  ) : (
                    <div className="space-y-2">
                      {users.map((user) => (
                        <div
                          key={user.id}
                          className={`p-3 rounded-lg border transition-colors ${
                            selectedUser?.id === user.id 
                              ? 'bg-primary/10 border-primary' 
                              : 'bg-card border-border hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 cursor-pointer" onClick={() => handleUserSelect(user)}>
                              <p className="font-medium text-foreground">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col items-end gap-1">
                                <Badge variant={getRoleBadgeColor(user.role) as any}>
                                  {user.role}
                                </Badge>
                                <Badge variant={getStatusBadgeColor(user.status) as any} className="text-xs">
                                  {user.status}
                                </Badge>
                              </div>
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditUser(user)
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleChangePassword(user)
                                  }}
                                  className="h-7 text-xs"
                                >
                                  <Key className="h-3 w-3 mr-1" />
                                  Password
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Permissions */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-foreground">
                        {selectedUser ? `${selectedUser.name}'s Permissions` : 'Permission Overrides'}
                      </CardTitle>
                      <CardDescription>
                        {selectedUser 
                          ? `Manage custom permissions for ${selectedUser.name} (${selectedUser.role})`
                          : 'Select a user to view and manage their permissions'
                        }
                      </CardDescription>
                    </div>
                    {selectedUser && (
                      <Button onClick={handleGrantPermission} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Grant Permission
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedUser ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p>Select a user from the list to view their permissions</p>
                    </div>
                  ) : userPermissions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="mb-2">No custom permissions</p>
                      <p className="text-sm">This user has default role-based permissions only</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-foreground">Permission</TableHead>
                          <TableHead className="text-foreground">Status</TableHead>
                          <TableHead className="text-foreground">Granted</TableHead>
                          <TableHead className="text-foreground">Expires</TableHead>
                          <TableHead className="text-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userPermissions.map((perm) => (
                          <TableRow key={perm.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-foreground">{perm.permission_key}</p>
                                {perm.reason && (
                                  <p className="text-sm text-muted-foreground">{perm.reason}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {perm.granted ? (
                                <Badge variant="default" className="flex items-center gap-1 w-fit">
                                  <CheckCircle className="h-3 w-3" />
                                  Granted
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <XCircle className="h-3 w-3" />
                                  Denied
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <p className="text-foreground">{formatDateTime(perm.granted_at)}</p>
                                {perm.granted_by_name && (
                                  <p className="text-muted-foreground">by {perm.granted_by_name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {perm.expires_at ? (
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-foreground">{formatDateTime(perm.expires_at)}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">Never</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRevokePermission(perm.permission_key)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Permissions Tab */}
          <TabsContent value="permissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-foreground">Available Permissions</CardTitle>
                <CardDescription>
                  View all available permissions and their default role assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(availablePermissions).map(([category, perms]) => (
                    <div key={category} className="space-y-3">
                      <h3 className="text-lg font-semibold capitalize text-foreground">
                        {category.replace(/_/g, ' ')}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(perms).map(([key, value]) => (
                          <Card key={key} className="bg-card border-border">
                            <CardContent className="pt-6">
                              <div className="space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-sm text-foreground">{key}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {value.description}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1 pt-2">
                                  {value.defaultRoles.map((role) => (
                                    <Badge
                                      key={role}
                                      variant={getRoleBadgeColor(role) as any}
                                      className="text-xs"
                                    >
                                      {role}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Grant Permission Dialog */}
        <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
          <DialogContent className="bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">Grant Permission</DialogTitle>
              <DialogDescription>
                Grant a custom permission to {selectedUser?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="permission" className="text-foreground">Permission</Label>
                <Select
                  value={permissionForm.permission_key}
                  onValueChange={(value) => setPermissionForm({ ...permissionForm, permission_key: value })}
                >
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Select permission" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border-border">
                    {Object.entries(availablePermissions).map(([category, perms]) =>
                      Object.keys(perms).map((key) => (
                        <SelectItem key={key} value={key} className="text-foreground">
                          {key}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expires_at" className="text-foreground">Expires At (Optional)</Label>
                <Input
                  id="expires_at"
                  type="datetime-local"
                  value={permissionForm.expires_at}
                  onChange={(e) => setPermissionForm({ ...permissionForm, expires_at: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>

              <div>
                <Label htmlFor="reason" className="text-foreground">Reason (Optional)</Label>
                <Input
                  id="reason"
                  placeholder="Why is this permission being granted?"
                  value={permissionForm.reason}
                  onChange={(e) => setPermissionForm({ ...permissionForm, reason: e.target.value })}
                  className="bg-background border-border text-foreground"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPermissionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePermission}>
                Grant Permission
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add User Dialog */}
        <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
          <DialogContent className="bg-background border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Add New User</DialogTitle>
              <DialogDescription>
                Create a new user account for the system
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-foreground">Full Name *</Label>
                <Input
                  id="name"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  placeholder="Enter full name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-foreground">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-foreground">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  placeholder="Enter password"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Password will be hashed automatically
                </p>
              </div>

              <div>
                <Label htmlFor="role" className="text-foreground">Role *</Label>
                <Select
                  value={newUserForm.role}
                  onValueChange={(value) => setNewUserForm({ ...newUserForm, role: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="technician">Technician</SelectItem>
                      <SelectItem value="sales">Sales</SelectItem>
                    </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="phone" className="text-foreground">Phone (Optional)</Label>
                <Input
                  id="phone"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  placeholder="+387 XX XXX XXX"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="department" className="text-foreground">Department (Optional)</Label>
                <Input
                  id="department"
                  value={newUserForm.department}
                  onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                  placeholder="e.g. Technical Support"
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowAddUserDialog(false)
                  setNewUserForm({
                    name: '',
                    email: '',
                    password: '',
                    role: 'technician',
                    phone: '',
                    department: ''
                  })
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditUserDialog} onOpenChange={setShowEditUserDialog}>
          <DialogContent className="bg-background border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Edit User</DialogTitle>
              <DialogDescription>
                Update user information for {editingUser?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name" className="text-foreground">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  placeholder="Enter full name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-email" className="text-foreground">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editUserForm.email}
                  onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                  placeholder="user@example.com"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-role" className="text-foreground">Role *</Label>
                <Select
                  value={editUserForm.role}
                  onValueChange={(value) => setEditUserForm({ ...editUserForm, role: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-status" className="text-foreground">Status *</Label>
                <Select
                  value={editUserForm.status}
                  onValueChange={(value) => setEditUserForm({ ...editUserForm, status: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="edit-phone" className="text-foreground">Phone (Optional)</Label>
                <Input
                  id="edit-phone"
                  value={editUserForm.phone}
                  onChange={(e) => setEditUserForm({ ...editUserForm, phone: e.target.value })}
                  placeholder="+387 XX XXX XXX"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-department" className="text-foreground">Department (Optional)</Label>
                <Input
                  id="edit-department"
                  value={editUserForm.department}
                  onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
                  placeholder="e.g. Technical Support"
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowEditUserDialog(false)
                  setEditingUser(null)
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveEditUser} disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Change Password Dialog */}
        <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
          <DialogContent className="bg-background border-border max-w-md">
            <DialogHeader>
              <DialogTitle className="text-foreground">Change Password</DialogTitle>
              <DialogDescription>
                Set a new password for {editingUser?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="new-password" className="text-foreground">New Password *</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={changePasswordForm.newPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Password must be at least 8 characters
                </p>
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-foreground">Confirm Password *</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={changePasswordForm.confirmPassword}
                  onChange={(e) => setChangePasswordForm({ ...changePasswordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="mt-1"
                />
                {changePasswordForm.confirmPassword && changePasswordForm.newPassword !== changePasswordForm.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">
                    Passwords do not match
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowChangePasswordDialog(false)
                  setEditingUser(null)
                  setChangePasswordForm({ newPassword: '', confirmPassword: '' })
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSavePassword} disabled={isSubmitting}>
                {isSubmitting ? 'Changing...' : 'Change Password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}

