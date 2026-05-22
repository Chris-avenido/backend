import * as userService from './user.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

/**
 * User Controller
 * Handles HTTP requests and responses. Delegates logic to the Service.
 */
export const getUsers = async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    return successResponse(res, 200, 'Users retrieved successfully', users);
  } catch (error) {
    console.error('[UserController] error:', error);
    return errorResponse(res, 500, 'Failed to fetch users', error.message);
  }
};

export const login = async (req, res) => {
  try {
    const { email, password, loginMethod } = req.body;
    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password/passcode are required');
    }
    const user = await userService.loginUser(email, password, loginMethod);
    return successResponse(res, 200, 'Login successful', { user });
  } catch (error) {
    return errorResponse(res, 401, error.message);
  }
};

export const userInfo = async (req, res) => {
  try {
    const { uid } = req.params;
    const user = await userService.userInfo(uid);
    return successResponse(res, 200, 'User retrieved successfully', user);
  } catch (error) {
    return errorResponse(res, 404, error.message);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { uid } = req.params;
    const updatedUser = await userService.updateUser(uid, req.body);
    return successResponse(res, 200, 'Profile updated successfully', updatedUser);
  } catch (error) {
    return errorResponse(res, 400, error.message);
  }
};

export const verifyPasscode = async (req, res) => {
  try {
    const { uid } = req.params;
    const { passcode } = req.body;
    if (!passcode) return errorResponse(res, 400, 'Passcode is required');
    await userService.verifyPasscode(uid, passcode);
    return successResponse(res, 200, 'Passcode verified successfully');
  } catch (error) {
    return errorResponse(res, 401, error.message);
  }
};

export const register = async (req, res) => {
  try {
    const newUser = await userService.registerUser(req.body);
    return successResponse(res, 201, 'User registered successfully', { user: newUser });
  } catch (error) {
    // If the error message mentions email, return 409 Conflict, else 400 Bad Request
    const statusCode = error.message.includes('Email is already registered') ? 409 : 400;
    return errorResponse(res, statusCode, error.message);
  }
};
