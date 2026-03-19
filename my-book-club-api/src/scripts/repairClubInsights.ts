import "../config/env.js";
import { pool } from "../db/pool.js";

async function main() {
  const result = await pool.query(
    `UPDATE club_insights
     SET signals = ARRAY(
       SELECT cleaned_signal
       FROM unnest(signals) AS signal
       CROSS JOIN LATERAL trim(replace(signal, '[object Object]', '')) AS cleaned_signal
       WHERE trim(replace(signal, '[object Object]', '')) <> ''
     ),
     updated_at = NOW()
     WHERE headline LIKE '%[object Object]%'
        OR summary LIKE '%[object Object]%'
        OR EXISTS (
          SELECT 1
          FROM unnest(signals) AS signal
          WHERE signal LIKE '%[object Object]%'
        )
     RETURNING club_id`
  );

  console.log(`Repaired ${result.rowCount ?? 0} club insight row(s).`);
  if (result.rows.length > 0) {
    console.log(result.rows.map((row) => row.club_id).join("\n"));
  }
}

try {
  await main();
} finally {
  await pool.end();
}
