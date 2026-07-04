'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Users,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Role,
  Permission,
  DEFAULT_ROLES,
  DEFAULT_PERMISSIONS,
  createRole,
  getPermissionsByCategory,
} from '@/lib/role-management'

interface RolesPermissionsProps {
  onClose?: () => void
}

export function RolesPermissionsManager({ onClose }: RolesPermissionsProps) {
  const [roles, setRoles] = useState<Role[]>(DEFAULT_ROLES)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [isCreateMode, setIsCreateMode] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    )
  }

  const handleCreateRole = () => {
    if (!newRoleName.trim()) return

    const newRole = createRole(newRoleName, newRoleDescription, selectedPermissions)
    setRoles([...roles, newRole])
    setNewRoleName('')
    setNewRoleDescription('')
    setSelectedPermissions([])
    setIsCreateMode(false)
  }

  const handleDeleteRole = (roleId: string) => {
    const role = roles.find((r) => r.id === roleId)
    if (role?.isCustom && confirm(`Delete role "${role.name}"?`)) {
      setRoles(roles.filter((r) => r.id !== roleId))
      setExpandedRole(null)
    }
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    setSelectedPermissions(role.permissions)
  }

  const handleSaveEdit = () => {
    if (!editingRole) return
    setRoles(
      roles.map((r) =>
        r.id === editingRole.id ? { ...r, permissions: selectedPermissions } : r
      )
    )
    setEditingRole(null)
    setSelectedPermissions([])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Roles & Permissions</h2>
          <p className="mt-1 text-sm text-slate-400">
            Define roles and assign permissions to control feature access
          </p>
        </div>
        <motion.button
          onClick={() => setIsCreateMode(!isCreateMode)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 rounded-lg bg-[#C09060] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#B8844F]"
        >
          <Plus className="h-5 w-5" />
          Create Role
        </motion.button>
      </div>

      {/* Create Role Form */}
      <AnimatePresence>
        {isCreateMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4 rounded-lg border border-[#C09060]/50 bg-[#C09060]/10 p-6"
          >
            <input
              type="text"
              placeholder="Role name (e.g., Sound Engineer)"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-[#C09060] focus:outline-none"
            />
            <textarea
              placeholder="Role description..."
              value={newRoleDescription}
              onChange={(e) => setNewRoleDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-white placeholder-slate-500 focus:border-[#C09060] focus:outline-none"
              rows={2}
            />

            {/* Permission Selection */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-300">Assign Permissions</p>
              {['songs', 'setlists', 'team', 'admin'].map((category) => (
                <div key={category} className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-500">
                    {category}
                  </p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {getPermissionsByCategory(category).map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2 cursor-pointer hover:bg-slate-700 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="rounded border-slate-500"
                        />
                        <span className="text-sm text-slate-300">{perm.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <motion.button
                onClick={handleCreateRole}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 rounded-lg bg-[#C09060] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#B8844F]"
              >
                Create Role
              </motion.button>
              <motion.button
                onClick={() => {
                  setIsCreateMode(false)
                  setNewRoleName('')
                  setNewRoleDescription('')
                  setSelectedPermissions([])
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-semibold text-slate-300 transition-colors hover:bg-slate-700"
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roles List */}
      <div className="space-y-3">
        {roles.map((role) => (
          <motion.div
            key={role.id}
            className="overflow-hidden rounded-lg border border-slate-700 bg-slate-800/50"
          >
            {/* Role Header */}
            <motion.button
              onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex items-center gap-4 flex-1 text-left">
                <div
                  className="h-4 w-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: role.color }}
                />
                <div>
                  <h3 className="font-semibold text-white">{role.name}</h3>
                  <p className="text-sm text-slate-400">{role.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-400">{role.userCount}</span>
                </div>
                <span className="text-xs font-semibold text-slate-500 bg-slate-700 px-2 py-1 rounded">
                  {role.permissions.length} permissions
                </span>
                {expandedRole === role.id ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </motion.button>

            {/* Role Details */}
            <AnimatePresence>
              {expandedRole === role.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-700 bg-slate-900/50"
                >
                  <div className="p-6 space-y-6">
                    {/* Permission Matrix */}
                    <div>
                      <h4 className="font-semibold text-white mb-4">Permissions</h4>
                      {editingRole?.id === role.id ? (
                        <div className="space-y-3">
                          {['songs', 'setlists', 'team', 'admin'].map((category) => (
                            <div key={category} className="space-y-2">
                              <p className="text-xs font-bold uppercase text-slate-500">
                                {category}
                              </p>
                              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                {getPermissionsByCategory(category).map((perm) => (
                                  <label
                                    key={perm.id}
                                    className="flex items-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2 cursor-pointer hover:bg-slate-700 transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedPermissions.includes(perm.id)}
                                      onChange={() => togglePermission(perm.id)}
                                      className="rounded border-slate-500"
                                    />
                                    <span className="text-sm text-slate-300">{perm.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {['songs', 'setlists', 'team', 'admin'].map((category) => {
                            const categoryPerms = getPermissionsByCategory(category).filter(
                              (p) => role.permissions.includes(p.id)
                            )
                            if (categoryPerms.length === 0) return null
                            return (
                              <div key={category}>
                                <p className="text-xs font-bold uppercase text-slate-500 mb-2">
                                  {category}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {categoryPerms.map((perm) => (
                                    <span
                                      key={perm.id}
                                      className="inline-flex items-center gap-1 rounded-full bg-[#C09060]/20 px-3 py-1 text-sm text-[#C09060]"
                                    >
                                      <Check className="h-3 w-3" />
                                      {perm.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {editingRole?.id === role.id ? (
                      <div className="flex gap-3 pt-4 border-t border-slate-700">
                        <motion.button
                          onClick={handleSaveEdit}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-emerald-700"
                        >
                          Save Changes
                        </motion.button>
                        <motion.button
                          onClick={() => {
                            setEditingRole(null)
                            setSelectedPermissions([])
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 font-semibold text-slate-300 transition-colors hover:bg-slate-700"
                        >
                          Cancel
                        </motion.button>
                      </div>
                    ) : (
                      <div className="flex gap-3 pt-4 border-t border-slate-700">
                        {!role.isCustom && (
                          <motion.button
                            onClick={() => handleEditRole(role)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
                          >
                            <Edit2 className="h-4 w-4" />
                            Edit Permissions
                          </motion.button>
                        )}
                        {role.isCustom && (
                          <>
                            <motion.button
                              onClick={() => handleEditRole(role)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-700"
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit
                            </motion.button>
                            <motion.button
                              onClick={() => handleDeleteRole(role.id)}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </motion.button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
