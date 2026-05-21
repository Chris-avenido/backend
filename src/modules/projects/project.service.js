import * as projectRepository from './project.repository.js';


export const allProjects = async () => {
  return await projectRepository.allProjects();
};

export const displayData = async (queryParams) => {
  return await projectRepository.displayData(queryParams);
};
