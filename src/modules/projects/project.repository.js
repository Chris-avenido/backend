import db from '../../config/db.js';
import { PROJECT_TABLE } from './project.model.js';

const TRANCHE_FUND_TABLE = 'tranche_fund';
const FILTER_OPTIONS_TTL_MS = 5 * 60 * 1000;

let filterOptionsCache = {
  expiresAt: 0,
  data: null
};

const getFilterOptions = async () => {
  if (filterOptionsCache.data && filterOptionsCache.expiresAt > Date.now()) {
    return filterOptionsCache.data;
  }

  const filterOptionsQuery = `
    SELECT
      (
        SELECT COALESCE(json_agg(region ORDER BY region), '[]'::json)
        FROM (
          SELECT DISTINCT region
          FROM ${PROJECT_TABLE}
          WHERE NULLIF(TRIM(region), '') IS NOT NULL
        ) region_options
      ) AS regions,
      (
        SELECT COALESCE(json_agg(division ORDER BY division), '[]'::json)
        FROM (
          SELECT DISTINCT division
          FROM ${PROJECT_TABLE}
          WHERE NULLIF(TRIM(division), '') IS NOT NULL
        ) division_options
      ) AS divisions,
      (
        SELECT COALESCE(json_agg(project_name ORDER BY project_name), '[]'::json)
        FROM (
          SELECT DISTINCT project_name
          FROM ${PROJECT_TABLE}
          WHERE NULLIF(TRIM(project_name), '') IS NOT NULL
        ) project_name_options
      ) AS project_names
  `;

  const filterOptionsRes = await db.raw(filterOptionsQuery);
  const data = filterOptionsRes.rows[0] || { regions: [], divisions: [], project_names: [] };

  filterOptionsCache = {
    data,
    expiresAt: Date.now() + FILTER_OPTIONS_TTL_MS
  };

  return data;
};

export const allProjects = async ({ region = '', division = '', project_name = '' } = {}) => {
  const filterBindings = [];
  const whereConditions = ['1=1'];

  if (project_name) {
    whereConditions.push(`eng.project_name = ?`);
    filterBindings.push(project_name);
  }
  if (region) {
    whereConditions.push(`eng.region = ?`);
    filterBindings.push(region);
  }
  if (division) {
    whereConditions.push(`eng.division = ?`);
    filterBindings.push(division);
  }

  const baseCte = `
    WITH ProjectRows AS (
      SELECT
        eng.project_id,
        eng.school_id,
        eng.project_category,
        eng.region,
        eng.latitude,
        eng.longitude,
        eng.school_name,
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
        COALESCE(tf.tranche_3, 0) AS tranche_3,
        tf.id AS tf_id,
        tf.tranche_1_release_date,
        tf.tranche_2_release_date,
        tf.tranche_3_release_date
      FROM ${PROJECT_TABLE} eng
      LEFT JOIN LATERAL (
        SELECT id, tranche_1, tranche_2, tranche_3, tranche_flag, tranche_1_release_date, tranche_2_release_date, tranche_3_release_date
        FROM ${TRANCHE_FUND_TABLE}
        WHERE project_id = eng.project_id
        ORDER BY
          CASE WHEN tranche_flag = 4 THEN 3 ELSE tranche_flag END DESC,
          id DESC
        LIMIT 1
      ) tf ON true
      WHERE ${whereConditions.join(' AND ')}
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

  const [totalRes, categoryRes, regionRes, dailyTrendRes, mapDataRes] = await Promise.all([
    db.raw(baseCte + `
      SELECT
        COUNT(*) AS total_project,
        COALESCE(SUM(approved_budget_for_contract), 0) AS approved_budget_for_contract,
        COUNT(DISTINCT school_id) AS total_schools,
        COUNT(CASE WHEN tranche_1 > 0 THEN 1 END) AS tranche_1_count,
        COUNT(CASE WHEN tranche_2 > 0 THEN 1 END) AS tranche_2_count,
        COUNT(CASE WHEN tranche_3 > 0 THEN 1 END) AS tranche_3_count,
        COUNT(CASE WHEN tf_id IS NULL THEN 1 END) AS na_count,
        COUNT(CASE WHEN tf_id IS NOT NULL THEN 1 END) AS total_tranche_fund,
        COALESCE(SUM(tranche_1), 0) AS tranche_1_amount,
        COALESCE(SUM(tranche_2), 0) AS tranche_2_amount,
        COALESCE(SUM(tranche_3), 0) AS tranche_3_amount
      FROM Deduped
    `, filterBindings),

    db.raw(baseCte + `SELECT project_category, COUNT(*) AS count FROM Deduped GROUP BY project_category`, filterBindings),

    db.raw(baseCte + `SELECT region, COUNT(*) AS count FROM Deduped GROUP BY region`, filterBindings),

    db.raw(baseCte + `
      SELECT 
        TO_CHAR(u.date, 'YYYY-MM-DD') AS date,
        SUM(u.t1) AS tranche_1,
        SUM(u.t2) AS tranche_2,
        SUM(u.t3) AS tranche_3
      FROM (
        SELECT tranche_1_release_date AS date, CASE WHEN tranche_1 > 0 THEN 1 ELSE 0 END AS t1, 0 AS t2, 0 AS t3
        FROM Deduped WHERE tranche_1_release_date IS NOT NULL
        UNION ALL
        SELECT tranche_2_release_date AS date, 0 AS t1, CASE WHEN tranche_2 > 0 THEN 1 ELSE 0 END AS t2, 0 AS t3
        FROM Deduped WHERE tranche_2_release_date IS NOT NULL
        UNION ALL
        SELECT tranche_3_release_date AS date, 0 AS t1, 0 AS t2, CASE WHEN tranche_3 > 0 THEN 1 ELSE 0 END AS t3
        FROM Deduped WHERE tranche_3_release_date IS NOT NULL
      ) u
      GROUP BY TO_CHAR(u.date, 'YYYY-MM-DD')
      ORDER BY date ASC
    `, filterBindings),

    db.raw(baseCte + `
      SELECT 
        project_id,
        school_name,
        project_category,
        latitude,
        longitude,
        tf_id,
        tranche_1,
        tranche_2,
        tranche_3
      FROM Deduped 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND NULLIF(latitude, '') IS NOT NULL AND NULLIF(longitude, '') IS NOT NULL
    `, filterBindings),
  ]);

  return {
    summary: totalRes.rows[0],
    dailyTrend: dailyTrendRes.rows,
    categories: categoryRes.rows,
    regions: regionRes.rows,
    mapData: mapDataRes.rows,
  };
};

export const displayData = async ({ page = 1, limit = 10, search = '', status = '', school_id = '', region = '', division = '' }) => {
  const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
  const pageLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
  const offset = (pageNumber - 1) * pageLimit;
  const filterBindings = [];
  const whereConditions = ['1=1'];

  // 1. Apply global filters that affect counts
  if (search) {
    whereConditions.push(`(eng.project_id::text ILIKE ? OR eng.project_name ILIKE ? OR eng.school_name ILIKE ? OR eng.region ILIKE ? OR eng.division ILIKE ?)`);
    filterBindings.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (school_id) {
    whereConditions.push(`eng.school_id ILIKE ?`);
    filterBindings.push(`%${school_id}%`);
  }
  if (region) {
    whereConditions.push(`eng.region = ?`);
    filterBindings.push(region);
  }
  if (division) {
    whereConditions.push(`eng.division = ?`);
    filterBindings.push(division);
  }

  const rankedCte = `
    WITH ProjectRows AS (
      SELECT
        eng.project_id,
        eng.project_name,
        eng.school_name,
        eng.school_id,
        eng.project_category,
        eng.region,
        eng.division,
        eng.province,
        eng.municipality,
        eng.district,
        eng.status_of_construction_phase,
        eng.accomplishment_percentage,
        eng.contract_amount,
        eng.contractor_name,
        eng.pcab_license_number,
        eng.approved_budget_for_contract,
        eng.batch_of_funds,
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
    RankedProjects AS MATERIALIZED (
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
    ),
    StatusCounts AS (
      SELECT
        COUNT(*) AS total,
        COUNT(CASE WHEN tranche_1 > 0 THEN 1 END) AS tranche_1,
        COUNT(CASE WHEN tranche_2 > 0 THEN 1 END) AS tranche_2,
        COUNT(CASE WHEN tranche_3 > 0 THEN 1 END) AS tranche_3
      FROM RankedProjects
    ),
  `;

  // 3. Apply the specific tranche filter for pagination and data.
  const dataBindings = [...filterBindings];
  const finalConditions = [];

  if (status === 'tranche_1') finalConditions.push(`tranche_1 > 0`);
  if (status === 'tranche_2') finalConditions.push(`tranche_2 > 0`);
  if (status === 'tranche_3') finalConditions.push(`tranche_3 > 0`);

  const finalWhere = finalConditions.length > 0 ? `WHERE ${finalConditions.join(' AND ')}` : '';

  const dataQuery = `
    ${rankedCte}
    FilteredProjects AS MATERIALIZED (
      SELECT * FROM RankedProjects ${finalWhere}
    ),
    FilteredCount AS (
      SELECT COUNT(*) AS total FROM FilteredProjects
    ),
    PageRows AS (
      SELECT
        project_id,
        project_name,
        school_name,
        school_id,
        project_category,
        region,
        division,
        province,
        municipality,
        district,
        status_of_construction_phase,
        accomplishment_percentage,
        contract_amount,
        contractor_name,
        pcab_license_number,
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
          WHEN tranche_3 > 0 THEN 'Tranche 3'
          WHEN tranche_2 > 0 THEN 'Tranche 2'
          WHEN tranche_1 > 0 THEN 'Tranche 1'
          ELSE 'No Tranche'
        END AS latest_tranche_status,
        batch_of_funds
      FROM FilteredProjects
      ORDER BY latest_tranche_number DESC, project_id ASC
      LIMIT ? OFFSET ?
    )
    SELECT
      COALESCE((SELECT json_agg(PageRows ORDER BY latest_tranche_number DESC, project_id ASC) FROM PageRows), '[]'::json) AS data,
      (SELECT total FROM FilteredCount) AS total,
      (SELECT row_to_json(StatusCounts) FROM StatusCounts) AS status_counts
  `;
  dataBindings.push(pageLimit, offset);

  const [dataRes, filterOptions] = await Promise.all([
    db.raw(dataQuery, dataBindings),
    getFilterOptions()
  ]);

  const result = dataRes.rows[0] || {};
  const statusCounts = result.status_counts || {};
  const total = parseInt(result.total || 0, 10);

  return {
    data: result.data || [],
    total,
    page: pageNumber,
    limit: pageLimit,
    statusCounts: {
      total: parseInt(statusCounts.total || 0, 10),
      tranche_1: parseInt(statusCounts.tranche_1 || 0, 10),
      tranche_2: parseInt(statusCounts.tranche_2 || 0, 10),
      tranche_3: parseInt(statusCounts.tranche_3 || 0, 10)
    },
    filterOptions
  };
};

export const findProjectById = async (projectId) => {
  return await db(PROJECT_TABLE)
    .where({ project_id: projectId })
    .first();
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
