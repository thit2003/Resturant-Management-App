import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const safeRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    month: row?.month || '',
    orders: Number(row?.orders || 0),
    revenue: Number(row?.revenue || 0),
  }));

export async function GET() {
  try {
    const result = await query(
      `WITH item_totals AS (
         SELECT oi.order_id, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS subtotal
         FROM order_item oi
         GROUP BY oi.order_id
       ),
       paid_orders AS (
         SELECT
           o.order_id,
           DATE_TRUNC('month', COALESCE(p.pay_time, o.order_time)) AS month_start,
           COALESCE(NULLIF(p.amount, 0), it.subtotal, 0) + COALESCE(p.tax, 0) - COALESCE(p.discount, 0) AS total_amount
         FROM orders o
         LEFT JOIN payment p ON p.order_id = o.order_id
         LEFT JOIN item_totals it ON it.order_id = o.order_id
         WHERE
           LOWER(COALESCE(p.payment_status, '')) = 'paid'
           OR (p.order_id IS NULL AND LOWER(COALESCE(o.status, '')) = 'paid')
       )
       SELECT
         TRIM(TO_CHAR(month_start, 'Mon YYYY')) AS month,
         COUNT(*)::int AS orders,
         COALESCE(SUM(total_amount), 0)::float8 AS revenue
       FROM paid_orders
       GROUP BY month_start
       ORDER BY month_start ASC`,
    );

    return withCors(Response.json(safeRows(result.rows)));
  } catch (primaryError) {
    console.error('GET /api/reports/monthly primary query failed', primaryError);

    try {
      const fallback = await query(
        `WITH item_totals AS (
           SELECT oi.order_id, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS subtotal
           FROM order_item oi
           GROUP BY oi.order_id
         )
         SELECT
           TRIM(TO_CHAR(DATE_TRUNC('month', o.order_time), 'Mon YYYY')) AS month,
           COUNT(*)::int AS orders,
           COALESCE(SUM(COALESCE(it.subtotal, 0)), 0)::float8 AS revenue
         FROM orders o
         LEFT JOIN item_totals it ON it.order_id = o.order_id
         WHERE LOWER(COALESCE(o.status, '')) = 'paid'
         GROUP BY DATE_TRUNC('month', o.order_time)
         ORDER BY DATE_TRUNC('month', o.order_time) ASC`,
      );
      return withCors(Response.json(safeRows(fallback.rows)));
    } catch (fallbackError) {
      console.error('GET /api/reports/monthly fallback query failed', fallbackError);
      return withCors(Response.json([]));
    }
  }
}

export async function OPTIONS() {
  return corsPreflight();
}