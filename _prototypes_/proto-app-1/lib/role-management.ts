// Role and Permission Management Utilities

export interface Permission {
  id: string
  name: string
  description: string
  category: 'songs' | 'setlists' | 'team' | 'admin'
}

export interface Role {
  id: string
  name: string
  description: string
  color: string
  permissions: string[]
  isCustom: boolean
  userCount: number
  createdAt: Date
}

export const DEFAULT_PERMISSIONS: Permission[] = [
  // Songs & Library
  {
    id: 'songs-view',
    name: 'View Songs',
    description: 'View songs in the library',
    category: 'songs',
  },
  {
    id: 'songs-edit',
    name: 'Edit Songs',
    description: 'Edit song lyrics and chords',
    category: 'songs',
  },
  {
    id: 'songs-delete',
    name: 'Delete Songs',
    description: 'Delete songs from library',
    category: 'songs',
  },
  {
    id: 'songs-create',
    name: 'Create Songs',
    description: 'Add new songs to library',
    category: 'songs',
  },
  // Setlists
  {
    id: 'setlists-view',
    name: 'View Setlists',
    description: 'View all setlists',
    category: 'setlists',
  },
  {
    id: 'setlists-create',
    name: 'Create Setlists',
    description: 'Create new setlists',
    category: 'setlists',
  },
  {
    id: 'setlists-edit',
    name: 'Edit Setlists',
    description: 'Edit setlist content and order',
    category: 'setlists',
  },
  {
    id: 'setlists-delete',
    name: 'Delete Setlists',
    description: 'Delete setlists',
    category: 'setlists',
  },
  // Team
  {
    id: 'team-view',
    name: 'View Team',
    description: 'View team members',
    category: 'team',
  },
  {
    id: 'team-invite',
    name: 'Invite Users',
    description: 'Invite new team members',
    category: 'team',
  },
  {
    id: 'team-manage',
    name: 'Manage Team',
    description: 'Manage team member roles and status',
    category: 'team',
  },
  // Admin
  {
    id: 'admin-access',
    name: 'Admin Access',
    description: 'Access admin panel',
    category: 'admin',
  },
  {
    id: 'admin-logs',
    name: 'View Access Logs',
    description: 'View audit logs and access history',
    category: 'admin',
  },
  {
    id: 'admin-roles',
    name: 'Manage Roles',
    description: 'Create, edit, and delete roles',
    category: 'admin',
  },
]

export const DEFAULT_ROLES: Role[] = [
  {
    id: 'worship-leader',
    name: 'Worship Leader',
    description: 'Full setlist and library management',
    color: '#C09060',
    permissions: [
      'songs-view',
      'songs-edit',
      'songs-create',
      'setlists-view',
      'setlists-create',
      'setlists-edit',
      'setlists-delete',
      'team-view',
      'team-invite',
    ],
    isCustom: false,
    userCount: 2,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'musician',
    name: 'Musician',
    description: 'View assigned songs and setlists',
    color: '#3B82F6',
    permissions: ['songs-view', 'setlists-view', 'team-view'],
    isCustom: false,
    userCount: 8,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'observer',
    name: 'Observer',
    description: 'Read-only access to all content',
    color: '#6B7280',
    permissions: ['songs-view', 'setlists-view', 'team-view'],
    isCustom: false,
    userCount: 3,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access and control',
    color: '#EF4444',
    permissions: [
      'songs-view',
      'songs-edit',
      'songs-create',
      'songs-delete',
      'setlists-view',
      'setlists-create',
      'setlists-edit',
      'setlists-delete',
      'team-view',
      'team-invite',
      'team-manage',
      'admin-access',
      'admin-logs',
      'admin-roles',
    ],
    isCustom: false,
    userCount: 1,
    createdAt: new Date('2024-01-01'),
  },
]

export function hasPermission(userRole: Role, permissionId: string): boolean {
  return userRole.permissions.includes(permissionId)
}

export function canAccessFeature(userRole: Role, feature: 'songs' | 'setlists' | 'team' | 'admin'): boolean {
  const requiredPermissions = {
    songs: 'songs-view',
    setlists: 'setlists-view',
    team: 'team-view',
    admin: 'admin-access',
  }
  return hasPermission(userRole, requiredPermissions[feature])
}

export function getPermissionsByCategory(category: string): Permission[] {
  return DEFAULT_PERMISSIONS.filter((p) => p.category === category)
}

export function createRole(name: string, description: string, permissions: string[]): Role {
  return {
    id: `custom-${Date.now()}`,
    name,
    description,
    color: '#9CA3AF',
    permissions,
    isCustom: true,
    userCount: 0,
    createdAt: new Date(),
  }
}
