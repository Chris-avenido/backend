import * as projectRepository from './project.repository.js';


export const allProjects = async (query = {}) => {
  return await projectRepository.allProjects(query);
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

  const project = await projectRepository.findProjectById(projectId);
  if (!project) throw new Error('Project not found');
  const budget = Number(project.approved_budget_for_contract) || 0;

  const existingFund = await projectRepository.findTrancheFundByProjectId(projectId);

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date format: ${value}`);
  }
  return d.toISOString().split('T')[0];
};

  const trancheData = {
    tranche_1: toAmount(payload.tranche_1),
    tranche_2: toAmount(payload.tranche_2),
    tranche_3: toAmount(payload.tranche_3),
    tranche_1_liquidated: toAmount(payload.tranche_1_liquidated),
    tranche_2_liquidated: toAmount(payload.tranche_2_liquidated),
    tranche_3_liquidated: toAmount(payload.tranche_3_liquidated),
    tranche_1_release_date: toDate(payload.tranche_1_release_date),
    tranche_1_latest_liquidation_date: toDate(payload.tranche_1_latest_liquidation_date),
    tranche_2_release_date: toDate(payload.tranche_2_release_date),
    tranche_2_latest_liquidation_date: toDate(payload.tranche_2_latest_liquidation_date),
    tranche_3_release_date: toDate(payload.tranche_3_release_date),
    tranche_3_latest_liquidation_date: toDate(payload.tranche_3_latest_liquidation_date)
  };

  const isConfirmed = {
    is_tranche_1_confirmed: payload.is_tranche_1_confirmed ?? existingFund?.is_tranche_1_confirmed ?? false,
    is_tranche_2_confirmed: payload.is_tranche_2_confirmed ?? existingFund?.is_tranche_2_confirmed ?? false,
    is_tranche_3_confirmed: payload.is_tranche_3_confirmed ?? existingFund?.is_tranche_3_confirmed ?? false,
  };

  const calcTranchePerc = (released, liquidated) => (released > 0 ? (liquidated / released) * 100 : 0);

  const t1_perc = calcTranchePerc(trancheData.tranche_1, trancheData.tranche_1_liquidated);
  const t2_perc = calcTranchePerc(trancheData.tranche_2, trancheData.tranche_2_liquidated);

  // Business Rule Validation
  if (hasAmount(trancheData.tranche_1) && !trancheData.tranche_1_release_date) throw new Error('Release Date is required for Tranche 1');
  if (hasAmount(trancheData.tranche_1_liquidated) && !trancheData.tranche_1_latest_liquidation_date) throw new Error('Liquidation Date is required for Tranche 1');

  if (hasAmount(trancheData.tranche_2) && !trancheData.tranche_2_release_date) throw new Error('Release Date is required for Tranche 2');
  if (hasAmount(trancheData.tranche_2_liquidated) && !trancheData.tranche_2_latest_liquidation_date) throw new Error('Liquidation Date is required for Tranche 2');

  if (hasAmount(trancheData.tranche_3) && !trancheData.tranche_3_release_date) throw new Error('Release Date is required for Tranche 3');
  if (hasAmount(trancheData.tranche_3_liquidated) && !trancheData.tranche_3_latest_liquidation_date) throw new Error('Liquidation Date is required for Tranche 3');

  if (hasAmount(trancheData.tranche_2)) {
    if (!isConfirmed.is_tranche_1_confirmed) {
      throw new Error('Tranche 1 must be confirmed and locked before Tranche 2 can be updated.');
    }
    if (t1_perc < 50) {
      throw new Error('Tranche 1 must be 50% liquidated to unlock Tranche 2.');
    }
  }

  if (hasAmount(trancheData.tranche_3)) {
    if (!isConfirmed.is_tranche_2_confirmed) {
      throw new Error('Tranche 2 must be confirmed and locked before Tranche 3 can be updated.');
    }
    if (t2_perc < 50) {
      throw new Error('Tranche 2 must be 50% liquidated to unlock Tranche 3.');
    }
  }

  const userId = Number(payload.user_id);
  const savedRows = await projectRepository.saveTrancheFund(projectId, {
    ...trancheData,
    ...isConfirmed,
    tranche_flag: getTrancheFlag(trancheData),
    user_id: Number.isFinite(userId) ? userId : 0,
    remarks: payload.remarks || null
  });

  return savedRows[0];
};
