import * as projectService from './project.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

// export const getProjects = async (req, res) => {
//   try {
//     const projects = await projectService.getDashboardProjects();
//     return successResponse(res, 200, 'Projects retrieved successfully', projects);
//   } catch (error) {
//     console.error('[ProjectController] error:', error);
//     return errorResponse(res, 500, 'Failed to fetch projects', error.message);
//   }
// };

export const allProjects = async (req, res) => {
  try {
    const projects = await projectService.allProjects();
    return successResponse(res, 200, 'Projects retrieved successfully', projects);
  } catch (error) {
    console.error('[UserController] error:', error);
    return errorResponse(res, 500, 'Failed to fetch projects', error.message);
  }
};


export const displayData = async (req, res) => {
  try {
    const projects = await projectService.displayData(req.query);
    return successResponse(res, 200, 'Projects retrieved successfully', projects);
  } catch (error) {
    console.error('[UserController] error:', error);
    return errorResponse(res, 500, 'Failed to fetch projects', error.message);
  }
}
