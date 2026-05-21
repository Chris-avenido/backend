/**
 * User Data Model / Schema definition
 * We do not use ORMs directly here, but this defines the structure
 * and constants related to the User entity.
 */

export const USER_TABLE = 'users';

export const UserRoles = {
  FINANCE_OFFICER: 'finance_officer',
  ACCOUNTANT: 'accountant',
  AUDITOR: 'auditor',
  DIVISION_CHIEF: 'division_chief',
};
