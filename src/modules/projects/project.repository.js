import db from '../../config/db.js';
import { PROJECT_TABLE } from './project.model.js';

export const allProjects = async () => {
  const baseCte = `
    WITH Deduped AS (
      SELECT DISTINCT ON (COALESCE(ipc, school_id || '-' || project_name))
        project_id,
        school_id,
        project_category,
        region,
        approved_budget_for_contract
      FROM ${PROJECT_TABLE}
      ORDER BY 
        COALESCE(ipc, school_id || '-' || project_name),
        project_id DESC
    )
  `;

  const [totalRes, categoryRes, regionRes] = await Promise.all([
    db.raw(baseCte + `SELECT COUNT(*) AS total_project, COALESCE(SUM(approved_budget_for_contract), 0) AS approved_budget_for_contract, COUNT(DISTINCT school_id) AS total_schools FROM Deduped`),

    db.raw(baseCte + `SELECT project_category, COUNT(*) AS count FROM Deduped GROUP BY project_category`),

    db.raw(baseCte + `SELECT region, COUNT(*) AS count FROM Deduped GROUP BY region`),
  ]);

  return { summary: totalRes.rows[0], categories: categoryRes.rows, regions: regionRes.rows, };
};

export const displayData = async ({ page = 1, limit = 10, search = '', status = '', school_id = '', region = '', division = '' }) => {
  const offset = (page - 1) * limit;
  let baseQuery = `
    FROM engineer_form eng
      LEFT JOIN (SELECT DISTINCT school_id FROM schools) sch ON eng.school_id = sch.school_id
    WHERE 1=1
  `;
  const filterBindings = [];

  // 1. Apply global filters that affect counts
  if (search) {
    baseQuery += ` AND (eng.project_id::text ILIKE ? OR eng.project_name ILIKE ? OR eng.school_name ILIKE ?)`;
    filterBindings.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (school_id) {
    baseQuery += ` AND eng.school_id ILIKE ?`;
    filterBindings.push(`%${school_id}%`);
  }
  if (region) {
    baseQuery += ` AND eng.region ILIKE ?`;
    filterBindings.push(`%${region}%`);
  }
  if (division) {
    baseQuery += ` AND eng.division ILIKE ?`;
    filterBindings.push(`%${division}%`);
  }

  // 2. Calculate Status Counts
  const countsQuery = `
    SELECT 
      COUNT(*) AS total,
      COUNT(CASE WHEN eng.status_of_construction_phase ILIKE '%progress%' OR eng.status_of_construction_phase ILIKE '%ongoing%' THEN 1 END) AS ongoing,
      COUNT(CASE WHEN eng.status_of_construction_phase ILIKE '%complete%' THEN 1 END) AS completed,
      COUNT(CASE WHEN eng.status_of_construction_phase ILIKE '%not yet%' OR eng.status_of_construction_phase ILIKE '%pending%' THEN 1 END) AS not_started
    ${baseQuery}
  `;
  const countsRes = await db.raw(countsQuery, filterBindings);
  const statusCounts = countsRes.rows[0];

  // 3. Apply the specific status filter for pagination and data
  let dataQueryWhere = baseQuery;
  const dataBindings = [...filterBindings];
  
  if (status === 'ongoing') {
    dataQueryWhere += ` AND (eng.status_of_construction_phase ILIKE '%progress%' OR eng.status_of_construction_phase ILIKE '%ongoing%')`;
  } else if (status === 'completed') {
    dataQueryWhere += ` AND eng.status_of_construction_phase ILIKE '%complete%'`;
  } else if (status === 'not_started') {
    dataQueryWhere += ` AND (eng.status_of_construction_phase ILIKE '%not yet%' OR eng.status_of_construction_phase ILIKE '%pending%')`;
  } else if (status) {
    dataQueryWhere += ` AND eng.status_of_construction_phase ILIKE ?`;
    dataBindings.push(`%${status}%`);
  }

  const countQuery = `SELECT COUNT(*) FROM (SELECT 1 ${dataQueryWhere}) AS sub`;
  const countRes = await db.raw(countQuery, dataBindings);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataQuery = `
    SELECT eng.project_id, eng.project_name, eng.school_name, eng.school_id, eng.region, eng.division, eng.status_of_construction_phase, eng.accomplishment_percentage, eng.approved_budget_for_contract, eng.batch_of_funds
    ${dataQueryWhere}
    ORDER BY eng.project_id ASC LIMIT ? OFFSET ?
  `;
  dataBindings.push(limit, offset);

  const dataRes = await db.raw(dataQuery, dataBindings);

  return {
    data: dataRes.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    statusCounts: {
      total: parseInt(statusCounts.total || 0, 10),
      ongoing: parseInt(statusCounts.ongoing || 0, 10),
      completed: parseInt(statusCounts.completed || 0, 10),
      not_started: parseInt(statusCounts.not_started || 0, 10)
    }
  };
};
