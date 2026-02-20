export const e2e_users = {
  admin: {
    name: 'e2e_admin',
    email: 'e2e_admin@shionlib.local',
    role: 3,
  },
  user: {
    name: 'e2e_user',
    email: 'e2e_user@shionlib.local',
    role: 1,
  },
  mutableUser: {
    name: 'e2e_mutable_user',
    email: 'e2e_mutable_user@shionlib.local',
    role: 1,
  },
  permissionUser: {
    name: 'e2e_permission_user',
    email: 'e2e_permission_user@shionlib.local',
    role: 1,
  },
  relationUser: {
    name: 'e2e_relation_user',
    email: 'e2e_relation_user@shionlib.local',
    role: 1,
  },
  adminOpsUser: {
    name: 'e2e_admin_ops_user',
    email: 'e2e_admin_ops_user@shionlib.local',
    role: 1,
  },
} as const
