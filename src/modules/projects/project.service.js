import * as projectRepository from './project.repository.js';


export const allProjects = async () => {
  return await projectRepository.allProjects();
};

export const displayData = async (queryParams) => {
  return await projectRepository.displayData(queryParams);
};

const toAmount = (value) => {
  if (value === '' || value === null || value === undefined) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Tranche amounts must be valid non-negative numbers');
  }
  return amount;
};

const hasAmount = (value) => Number(value || 0) > 0;

const getTrancheFlag = ({ tranche_1, tranche_2, tranche_3 }) => {
  if (hasAmount(tranche_1) && hasAmount(tranche_2) && hasAmount(tranche_3)) return 4;
  if (hasAmount(tranche_1) && hasAmount(tranche_2)) return 2;
  if (hasAmount(tranche_1)) return 1;
  return 0;
};

export const getTrancheFund = async (projectId) => {
  if (!projectId) throw new Error('Project ID is required');
  return await projectRepository.findTrancheFundByProjectId(projectId);
};

export const saveTrancheFund = async (projectId, payload) => {
  if (!projectId) throw new Error('Project ID is required');

  const trancheData = {
    tranche_1: toAmount(payload.tranche_1),
    tranche_2: toAmount(payload.tranche_2),
    tranche_3: toAmount(payload.tranche_3)
  };

  if (hasAmount(trancheData.tranche_2) && !hasAmount(trancheData.tranche_1)) {
    throw new Error('Tranche 1 must be released before Tranche 2');
  }

  if (hasAmount(trancheData.tranche_3) && !hasAmount(trancheData.tranche_2)) {
    throw new Error('Tranche 2 must be released before Tranche 3');
  }

  const userId = Number(payload.user_id);
  const savedRows = await projectRepository.saveTrancheFund(projectId, {
    ...trancheData,
    tranche_flag: getTrancheFlag(trancheData),
    user_id: Number.isFinite(userId) ? userId : 0,
    remarks: payload.remarks || null
  });

  return savedRows[0];
};
