import * as userRepository from './user.repository.js';
import bcrypt from 'bcrypt';

/**
 * User Service
 * Contains core business logic. Calls the repository for data.
 */
export const getAllUsers = async () => {
  // Add any business logic here (e.g., filtering, mapping data) before returning
  const users = await userRepository.findAll();
  return users;
};

export const loginUser = async (email, password) => {
  const user = await userRepository.findByEmail(email);
  if (!user) throw new Error('Invalid Email');

  // Check if the password is a bcrypt hash (starts with $2a$ or $2b$)
  const isBcrypt = user.password_hash;

  let isMatch = false;
  if (isBcrypt) {
    isMatch = await bcrypt.compare(password, user.password_hash);
  } else {
    // Fallback to plaintext comparison
    isMatch = (user.password_hash === password) || (user.password === password);
  }

  if (!isMatch) {
    throw new Error('Invalid Password');
  }

  // Omit the password from the returned object
  const { password_hash, password: _pwd, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

export const userInfo = async (uid) => {
  const user = await userRepository.findById(uid);
  if (!user) throw new Error('User not found');
  return user;
};

export const updateUser = async (uid, updateData) => {
  if (updateData.password) {
    updateData.password_hash = await bcrypt.hash(updateData.password, 10);
    delete updateData.password;
  }

  // Sanitize fields to prevent updating restricted columns
  const allowedFields = ['first_name', 'last_name', 'email', 'contact_number', 'password_hash', 'passcode'];
  const sanitizedData = {};
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      sanitizedData[field] = updateData[field];
    }
  }

  if (Object.keys(sanitizedData).length === 0) {
    throw new Error('No valid fields to update');
  }

  const updatedUsers = await userRepository.update(uid, sanitizedData);
  if (!updatedUsers || updatedUsers.length === 0) {
    throw new Error('User not found or update failed');
  }
  return updatedUsers[0];
};

export const verifyPasscode = async (uid, passcode) => {
  const user = await userRepository.findById(uid);
  if (!user) throw new Error('User not found');

  // Assuming passcode is plain text (e.g., a PIN code).
  if (String(user.passcode) !== String(passcode)) {
    throw new Error('Invalid passcode');
  }
  return true;
};

export const registerUser = async (payload) => {
  const { 
    verification_code, 
    password, 
    email,
    first_name, 
    last_name, 
    region, 
    division, 
    province, 
    city, 
    barangay, 
    office, 
    position, 
    contact_number, 
    account_category, 
    passcode 
  } = payload;

  if (verification_code !== 'DEPED-FINANCE-2026') {
    throw new Error('Invalid Admin Verification Code');
  }

  if (!password) {
    throw new Error('Password is required for registration');
  }

  if (!email || !first_name || !last_name) {
    throw new Error('Email, First Name, and Last Name are required');
  }

  const existingEmail = await userRepository.findByEmail(email);
  if (existingEmail) {
    throw new Error('Email is already registered');
  }

  const password_hash = await bcrypt.hash(password, 10);

  const userData = {
    email,
    first_name,
    last_name,
    region,
    division,
    province,
    city,
    barangay,
    office,
    position,
    contact_number,
    account_category,
    passcode,
    role: 'finance', // Default role
    registration_status: 'pending',
    password_hash,
    hash_version: 1, // Default hash version
  };

  const newUser = await userRepository.create(userData);
  if (!newUser || newUser.length === 0) {
    throw new Error('Failed to create user account');
  }

  const { password_hash: _ph, ...userWithoutPassword } = newUser[0];
  return userWithoutPassword;
};

