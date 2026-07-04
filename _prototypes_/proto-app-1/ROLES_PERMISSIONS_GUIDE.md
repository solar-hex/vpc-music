# Roles & Permissions System Documentation

## Overview

The Roles & Permissions system provides comprehensive access control for the VPC Music application, enabling administrators to define roles, assign permissions, and manage team access.

## Architecture

### Core Components

1. **Role Management** (`lib/role-management.ts`)
   - Role definitions with permissions
   - Permission categories (songs, setlists, team, admin)
   - Built-in roles (Worship Leader, Musician, Observer, Administrator)
   - Custom role creation

2. **Roles & Permissions Manager** (`components/roles-permissions-manager.tsx`)
   - Role CRUD operations
   - Permission matrix interface
   - Role expansion/collapse for details
   - Edit/delete functionality

3. **Admin Dashboard Integration** (`app/admin/page.tsx`)
   - Roles & Permissions section within admin panel
   - Dashboard statistics
   - Navigation to other admin areas

## Default Roles

### 1. Worship Leader
- **Color**: Gold (#C09060)
- **Access Level**: Full setlist and library management
- **Permissions**:
  - Full song management (view, edit, create)
  - Full setlist management
  - Team viewing and invitations
- **User Count**: 2

### 2. Musician
- **Color**: Blue (#3B82F6)
- **Access Level**: View assigned songs and setlists
- **Permissions**:
  - View songs and setlists only
  - Team viewing
- **User Count**: 8

### 3. Observer
- **Color**: Gray (#6B7280)
- **Access Level**: Read-only access
- **Permissions**:
  - View songs, setlists, and team
- **User Count**: 3

### 4. Administrator
- **Color**: Red (#EF4444)
- **Access Level**: Full system access
- **Permissions**:
  - All permissions available
  - Role management
  - Access log viewing
  - System admin functions
- **User Count**: 1

## Permission Categories

### Songs & Library (6 permissions)
- View Songs
- Edit Songs
- Delete Songs
- Create Songs

### Setlists (4 permissions)
- View Setlists
- Create Setlists
- Edit Setlists
- Delete Setlists

### Team (3 permissions)
- View Team
- Invite Users
- Manage Team

### Admin (3 permissions)
- Admin Access
- View Access Logs
- Manage Roles

## Feature Matrix

| Feature | Observer | Musician | Worship Leader | Admin |
|---------|----------|----------|---|---|
| View Songs | ✓ | ✓ | ✓ | ✓ |
| Edit Songs | ✗ | ✗ | ✓ | ✓ |
| Create Songs | ✗ | ✗ | ✓ | ✓ |
| Delete Songs | ✗ | ✗ | ✗ | ✓ |
| View Setlists | ✓ | ✓ | ✓ | ✓ |
| Create Setlists | ✗ | ✗ | ✓ | ✓ |
| Edit Setlists | ✗ | ✗ | ✓ | ✓ |
| Delete Setlists | ✗ | ✗ | ✗ | ✓ |
| View Team | ✓ | ✓ | ✓ | ✓ |
| Invite Users | ✗ | ✗ | ✓ | ✓ |
| Manage Team | ✗ | ✗ | ✗ | ✓ |
| Admin Access | ✗ | ✗ | ✗ | ✓ |
| View Access Logs | ✗ | ✗ | ✗ | ✓ |
| Manage Roles | ✗ | ✗ | ✗ | ✓ |

## Usage

### Check User Permissions

```typescript
import { hasPermission, canAccessFeature } from '@/lib/role-management'

// Check specific permission
const canEdit = hasPermission(userRole, 'songs-edit')

// Check feature access
const canAccessAdmin = canAccessFeature(userRole, 'admin')
```

### Create Custom Role

```typescript
import { createRole } from '@/lib/role-management'

const soundEngineer = createRole(
  'Sound Engineer',
  'Manages audio and display settings',
  ['songs-view', 'setlists-view', 'team-view']
)
```

### Get Permissions by Category

```typescript
import { getPermissionsByCategory } from '@/lib/role-management'

const songPermissions = getPermissionsByCategory('songs')
```

## Admin Interface

### Navigation
- Click "Roles & Permissions" in the admin sidebar to access the manager
- View all roles with expansion for detailed permissions

### Creating a Role
1. Click "Create Role" button
2. Enter role name and description
3. Select permissions by category
4. Click "Create Role"

### Editing Roles
- Default roles: Can edit permissions only
- Custom roles: Can edit name, description, and permissions
- Click "Edit Permissions" to modify access levels

### Deleting Roles
- Only custom roles can be deleted
- Click "Delete" on the custom role card
- Confirm deletion

## Statistics

The admin dashboard displays key metrics:
- **Active Roles**: Number of currently defined roles
- **Total Permissions**: Count of available permissions
- **Users Assigned**: Number of users with role assignments

## Security Considerations

1. **Permission Inheritance**: Roles inherit all assigned permissions
2. **No Direct Access**: Users must be assigned roles; no direct permission assignment
3. **Audit Trail**: All role changes are logged (see Access Logs)
4. **Admin-Only**: Role management restricted to administrators
5. **Feature Protection**: Route and API endpoints check user permissions

## Future Enhancements

- [ ] Dynamic permission creation
- [ ] Role hierarchy/inheritance
- [ ] Time-based access restrictions
- [ ] Department-based role templates
- [ ] Activity audit logs
- [ ] Bulk role assignment
- [ ] Permission delegation
