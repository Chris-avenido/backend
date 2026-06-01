import db from '../../config/db.js';
import { PROJECT_TABLE } from './project.model.js';

const TRANCHE_FUND_TABLE = 'tranche_fund';

export const allProjects = async () => {
  const baseCte = `
    WITH ProjectRows AS (
      SELECT
        eng.project_id,
        eng.school_id,
        eng.project_category,
        eng.region,
        eng.approved_budget_for_contract,
        COALESCE(eng.ipc, eng.school_id || '-' || eng.project_name) AS project_key,
        GREATEST(
          CASE
            WHEN NULLIF(regexp_replace(eng.batch_of_funds::text, '[^0-9]', '', 'g'), '') IN ('1', '2', '3')
              THEN NULLIF(regexp_replace(eng.batch_of_funds::text, '[^0-9]', '', 'g'), '')::integer
            ELSE 0
          END,
          CASE WHEN COALESCE(tf.tranche_flag, 0) = 4 THEN 3 ELSE COALESCE(tf.tranche_flag, 0) END,
          CASE
            WHEN COALESCE(tf.tranche_3, 0) > 0 THEN 3
            WHEN COALESCE(tf.tranche_2, 0) > 0 THEN 2
            WHEN COALESCE(tf.tranche_1, 0) > 0 THEN 1
            ELSE 0
          END
        ) AS latest_tranche_number,
        COALESCE(tf.tranche_1, 0) AS tranche_1,
        COALESCE(tf.tranche_2, 0) AS tranche_2,
        COALESCE(tf.tranche_3, 0) AS tranche_3
      FROM ${PROJECT_TABLE} eng
      LEFT JOIN LATERAL (
        SELECT tranche_1, tranche_2, tranche_3, tranche_flag
        FROM ${TRANCHE_FUND_TABLE}
        WHERE project_id = eng.project_id
        ORDER BY
          CASE WHEN tranche_flag = 4 THEN 3 ELSE tranche_flag END DESC,
          id DESC
        LIMIT 1
      ) tf ON true
    ),
    Deduped AS (
      SELECT *
      FROM (
        SELECT
          ProjectRows.*,
          ROW_NUMBER() OVER (
            PARTITION BY project_key
            ORDER BY latest_tranche_number DESC, project_id DESC
          ) AS row_rank
        FROM ProjectRows
      ) ranked
      WHERE row_rank = 1
    )
  `;

  const [totalRes, categoryRes, regionRes] = await Promise.all([
    db.raw(baseCte + `
      SELECT
        COUNT(*) AS total_project,
        COALESCE(SUM(approved_budget_for_contract), 0) AS approved_budget_for_contract,
        COUNT(DISTINCT school_id) AS total_schools,
        COUNT(CASE WHEN latest_tranche_number = 1 THEN 1 END) AS tranche_1_count,
        COUNT(CASE WHEN latest_tranche_number = 2 THEN 1 END) AS tranche_2_count,
        COUNT(CASE WHEN latest_tranche_number >= 3 THEN 1 END) AS tranche_3_count,
        COALESCE(SUM(tranche_1), 0) AS tranche_1_amount,
        COALESCE(SUM(tranche_2), 0) AS tranche_2_amount,
        COALESCE(SUM(tranche_3), 0) AS tranche_3_amount
      FROM Deduped
    `),

    db.raw(baseCte + `SELECT project_category, COUNT(*) AS count FROM Deduped GROUP BY project_category`),

    db.raw(baseCte + `SELECT region, COUNT(*) AS count FROM Deduped GROUP BY region`),
  ]);

  return { summary: totalRes.rows[0], categories: categoryRes.rows, regions: regionRes.rows, };
};

export const displayData = async ({ page = 1, limit = 10, search = '', status = '', school_id = '', region = '', division = '' }) => {
  const offset = (page - 1) * limit;
  const filterBindings = [];
  const whereConditions = ['1=1'];

  // 1. Apply global filters that affect counts
  if (search) {
    whereConditions.push(`(eng.project_id::text ILIKE ? OR eng.project_name ILIKE ? OR eng.school_name ILIKE ?)`);
    filterBindings.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (school_id) {
    whereConditions.push(`eng.school_id ILIKE ?`);
    filterBindings.push(`%${school_id}%`);
  }
  if (region) {
    whereConditions.push(`eng.region ILIKE ?`);
    filterBindings.push(`%${region}%`);
  }
  if (division) {
    whereConditions.push(`eng.division ILIKE ?`);
    filterBindings.push(`%${division}%`);
  }

  const rankedCte = `
    WITH ProjectRows AS (
      SELECT
        eng.*,
        COALESCE(eng.ipc, eng.school_id || '-' || eng.project_name) AS project_key,
        COALESCE(tf.tranche_1, 0) AS tranche_1,
        COALESCE(tf.tranche_2, 0) AS tranche_2,
        COALESCE(tf.tranche_3, 0) AS tranche_3,
        COALESCE(tf.tranche_flag, 0) AS tranche_flag,
        GREATEST(
          CASE
            WHEN NULLIF(regexp_replace(eng.batch_of_funds::text, '[^0-9]', '', 'g'), '') IN ('1', '2', '3')
              THEN NULLIF(regexp_replace(eng.batch_of_funds::text, '[^0-9]', '', 'g'), '')::integer
            ELSE 0
          END,
          CASE WHEN COALESCE(tf.tranche_flag, 0) = 4 THEN 3 ELSE COALESCE(tf.tranche_flag, 0) END,
          CASE
            WHEN COALESCE(tf.tranche_3, 0) > 0 THEN 3
            WHEN COALESCE(tf.tranche_2, 0) > 0 THEN 2
            WHEN COALESCE(tf.tranche_1, 0) > 0 THEN 1
            ELSE 0
          END
        ) AS latest_tranche_number
      FROM ${PROJECT_TABLE} eng
      LEFT JOIN LATERAL (
        SELECT tranche_1, tranche_2, tranche_3, tranche_flag
        FROM ${TRANCHE_FUND_TABLE}
        WHERE project_id = eng.project_id
        ORDER BY
          CASE WHEN tranche_flag = 4 THEN 3 ELSE tranche_flag END DESC,
          id DESC
        LIMIT 1
      ) tf ON true
      WHERE ${whereConditions.join(' AND ')}
    ),
    RankedProjects AS (
      SELECT *
      FROM (
        SELECT
          ProjectRows.*,
          ROW_NUMBER() OVER (
            PARTITION BY project_key
            ORDER BY latest_tranche_number DESC, project_id DESC
          ) AS row_rank
        FROM ProjectRows
      ) ranked
      WHERE row_rank = 1
    )
  `;

  // 2. Calculate latest-tranche counts after de-duplicating projects.
  const countsQuery = `
    ${rankedCte}
    SELECT 
      COUNT(*) AS total,
      COUNT(CASE WHEN latest_tranche_number = 1 THEN 1 END) AS tranche_1,
      COUNT(CASE WHEN latest_tranche_number = 2 THEN 1 END) AS tranche_2,
      COUNT(CASE WHEN latest_tranche_number >= 3 THEN 1 END) AS tranche_3
    FROM RankedProjects
  `;
  const countsRes = await db.raw(countsQuery, filterBindings);
  const statusCounts = countsRes.rows[0];

  // 3. Apply the specific tranche filter for pagination and data.
  const dataBindings = [...filterBindings];
  const finalConditions = [];

  if (status === 'tranche_1') finalConditions.push(`latest_tranche_number = 1`);
  if (status === 'tranche_2') finalConditions.push(`latest_tranche_number = 2`);
  if (status === 'tranche_3') finalConditions.push(`latest_tranche_number >= 3`);

  const finalWhere = finalConditions.length > 0 ? `WHERE ${finalConditions.join(' AND ')}` : '';

  const countQuery = `${rankedCte} SELECT COUNT(*) FROM RankedProjects ${finalWhere}`;
  const countRes = await db.raw(countQuery, dataBindings);
  const total = parseInt(countRes.rows[0].count, 10);

  const dataQuery = `
    ${rankedCte}
    SELECT
      project_id,
      project_name,
      school_name,
      school_id,
      region,
      division,
      province,
      municipality,
      district,
      status_of_construction_phase,
      accomplishment_percentage,
      contract_amount,
      CASE
        WHEN NULLIF(regexp_replace(accomplishment_percentage::text, '[^0-9.]', '', 'g'), '')::numeric = 0 THEN 'New'
        WHEN NULLIF(regexp_replace(accomplishment_percentage::text, '[^0-9.]', '', 'g'), '')::numeric = 100 THEN 'Completed'
        ELSE 'Under Construction'
      END AS accomplishment_status,
      approved_budget_for_contract,
      tranche_1,
      tranche_2,
      tranche_3,
      tranche_flag,
      latest_tranche_number,
      CASE
        WHEN latest_tranche_number >= 3 THEN 'Tranche 3'
        WHEN latest_tranche_number = 2 THEN 'Tranche 2'
        WHEN latest_tranche_number = 1 THEN 'Tranche 1'
        ELSE 'New'
      END AS latest_tranche_status,
      batch_of_funds
    FROM RankedProjects
    ${finalWhere}
    ORDER BY latest_tranche_number DESC, project_id ASC LIMIT ? OFFSET ?
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
      tranche_1: parseInt(statusCounts.tranche_1 || 0, 10),
      tranche_2: parseInt(statusCounts.tranche_2 || 0, 10),
      tranche_3: parseInt(statusCounts.tranche_3 || 0, 10)
    }
  };
};

export const findTrancheFundByProjectId = async (projectId) => {
  return await db(TRANCHE_FUND_TABLE)
    .where({ project_id: projectId })
    .orderByRaw('CASE WHEN tranche_flag = 4 THEN 3 ELSE tranche_flag END DESC')
    .orderBy('id', 'desc')
    .first();
};

export const saveTrancheFund = async (projectId, data) => {
  const existingRecord = await findTrancheFundByProjectId(projectId);
  const payload = {
    ...data,
    project_id: projectId,
    edit_date: db.fn.now()
  };

  if (existingRecord) {
    return await db(TRANCHE_FUND_TABLE)
      .where({ id: existingRecord.id })
      .update(payload)
      .returning('*');
  }

  return await db(TRANCHE_FUND_TABLE)
    .insert({
      ...payload,
      create_date: db.fn.now()
    })
    .returning('*');
};
