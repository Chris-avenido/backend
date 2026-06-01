/**
 * User Data Model / Schema definition
 * We do not use ORMs directly here, but this defines the structure
 * and constants related to the User entity.
 */

export const USER_TABLE = 'users';

export const UserRoles = {
  FINANCE: 'Finance',
  SUPER_USER: 'Super User',
};

export const ALLOWED_LOGIN_ROLES = [UserRoles.FINANCE, UserRoles.SUPER_USER];

export const isAllowedLoginRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase().replace(/_/g, ' ');
  return ALLOWED_LOGIN_ROLES.some((allowedRole) => allowedRole.toLowerCase() === normalizedRole);
};
