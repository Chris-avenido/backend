import db from '../../config/db.js';
import { PROJECT_TABLE } from '../projects/project.model.js';

const TRANCHE_FUND_TABLE = 'tranche_fund';

export const findProjectViewById = async (projectId) => {
  const query = `
    SELECT
      eng.*,
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
      ) AS latest_tranche_number,
      CASE
        WHEN NULLIF(regexp_replace(eng.accomplishment_percentage::text, '[^0-9.]', '', 'g'), '')::numeric = 0 THEN 'New'
        WHEN NULLIF(regexp_replace(eng.accomplishment_percentage::text, '[^0-9.]', '', 'g'), '')::numeric = 100 THEN 'Completed'
        ELSE 'Under Construction'
      END AS accomplishment_status,
      CASE
        WHEN COALESCE(tf.tranche_3, 0) > 0 THEN 'Tranche 3'
        WHEN COALESCE(tf.tranche_2, 0) > 0 THEN 'Tranche 2'
        WHEN COALESCE(tf.tranche_1, 0) > 0 THEN 'Tranche 1'
        ELSE 'No Tranche'
      END AS latest_tranche_status
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
    WHERE eng.project_id = ?
    LIMIT 1
  `;

  const result = await db.raw(query, [projectId]);
  return result.rows[0] || null;
};
