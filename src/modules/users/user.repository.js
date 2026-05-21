import db from '../../config/db.js';
import { USER_TABLE } from './user.model.js';

/**
 * User Repository
 * Handles all direct database queries for users via Knex.
 */
export const findAll = async (limit = 50) => {
  return await db(USER_TABLE).select('uid').limit(limit);
};

export const findById = async (uid) => {
  return await db(USER_TABLE)
    .select('uid', 'email', 'role', 'first_name', 'last_name', 'region', 'division', 'province', 'city', 'barangay', 'office', 'position', 'contact_number', 'account_category', 'password_hash', 'hash_version', 'passcode', 'registration_status', 'created_at')
    .where({ uid })
    .first();
};

export const findByEmail = async (email) => {
  return await db(USER_TABLE).where({ email }).first();
};

export const update = async (uid, data) => {
  return await db(USER_TABLE).where({ uid }).update(data).returning('*');
};

export const create = async (data) => {
  return await db(USER_TABLE).insert(data).returning('*');
};