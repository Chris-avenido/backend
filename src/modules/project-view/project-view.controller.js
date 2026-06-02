import * as projectViewService from './project-view.service.js';
import { successResponse, errorResponse } from '../../utils/response.js';

export const getProjectView = async (req, res) => {
  try {
    const project = await projectViewService.getProjectView(req.params.projectToken);
    return successResponse(res, 200, 'Project view retrieved successfully', project);
  } catch (error) {
    console.error('[ProjectViewController] error:', error);
    return errorResponse(res, 404, error.message);
  }
};
