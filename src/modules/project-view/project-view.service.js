import * as projectViewRepository from './project-view.repository.js';

const decodeProjectToken = (projectToken) => {
  if (!projectToken) throw new Error('Project token is required');

  const base64 = projectToken.replace(/-/g, '+').replace(/_/g, '/');
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const projectId = Buffer.from(paddedBase64, 'base64').toString('utf8');

  if (!/^\d+$/.test(projectId)) {
    throw new Error('Invalid project token');
  }

  return projectId;
};

export const getProjectView = async (projectToken) => {
  const projectId = decodeProjectToken(projectToken);
  const project = await projectViewRepository.findProjectViewById(projectId);

  if (!project) throw new Error('Project not found');

  return project;
};
