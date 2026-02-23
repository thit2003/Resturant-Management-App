import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const safeRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    month: row?.month || '',
    item: row?.item || 'Unknown',
    quantity: Number(row?.quantity || 0),
    revenue: Number(row?.revenue || 0),
  }));

const parseYearMonth = (request) => {
  const { searchParams } = new URL(request.url);
  const yearRaw = searchParams.get('year');
  const monthRaw = searchParams.get('month');

  if (!yearRaw && !monthRaw) return { value: null, error: '' };
  if (!yearRaw || !monthRaw) {
    return {
      value: null,
      error: 'Both year and month are required when filtering monthly menu report.',
    };
  }

  const year = Number.parseInt(yearRaw, 10);
  const month = Number.parseInt(monthRaw, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || year < 1900 || year > 3000 || month < 1 || month > 12) {
    return { value: null, error: 'Invalid year/month filter for monthly menu report.' };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year > currentYear || (year === currentYear && month > currentMonth)) {
    return { value: null, error: 'Future months are not allowed for monthly menu report.' };
  }

  return { value: { year, month }, error: '' };
};

export async function GET(request) {
  const parsed = parseYearMonth(request);
  if (parsed.error) {
    return withCors(Response.json({ error: parsed.error }, { status: 400 }));
  }

  const filter = parsed.value;
  const filterParams = filter ? [filter.year, filter.month] : [];
  const primaryMonthFilter = filter
    ? `AND DATE_TRUNC('month', p.pay_time) = MAKE_DATE($1, $2, 1)::timestamp`
    : '';
  const fallbackMonthFilter = filter
    ? `AND DATE_TRUNC('month', p.pay_time) = MAKE_DATE($1, $2, 1)::timestamp`
    : '';

  try {
    const result = await query(
      `WITH order_scope AS (
          SELECT
            o.order_id,
            p.pay_time AS sale_time,
            DATE_TRUNC('month', p.pay_time) AS month_start,
            COALESCE(p.amount, 0)::float8 AS amount,
            COALESCE(p.tax, 0)::float8 AS tax,
            COALESCE(p.discount, 0)::float8 AS discount
         FROM orders o
         JOIN payment p ON p.order_id = o.order_id
         WHERE
           LOWER(COALESCE(p.payment_status, '')) = 'paid'
           ${primaryMonthFilter}
       ),
       order_totals AS (
         SELECT oi.order_id, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float8 AS subtotal
         FROM order_item oi
         GROUP BY oi.order_id
       ),
       item_rows AS (
         SELECT
           po.month_start,
           po.sale_time,
           COALESCE(mi.name, 'Unknown') AS item,
           oi.quantity::int AS quantity,
           (oi.quantity * oi.unit_price)::float8 AS line_subtotal,
           COALESCE(ot.subtotal, 0) AS order_subtotal,
           po.tax,
           po.discount
         FROM order_scope po
         JOIN order_item oi ON oi.order_id = po.order_id
         LEFT JOIN menu_item mi ON mi.menu_item_id = oi.menu_item_id
         LEFT JOIN order_totals ot ON ot.order_id = po.order_id
       ),
       missing_item_orders AS (
         SELECT
           po.month_start,
           po.sale_time,
           'Unknown'::text AS item,
           0::int AS quantity,
           po.amount AS revenue
         FROM order_scope po
         LEFT JOIN order_item oi ON oi.order_id = po.order_id
         WHERE oi.order_id IS NULL
       ),
       combined_rows AS (
         SELECT
            month_start,
            DATE_TRUNC('day', sale_time) AS sale_day,
            sale_time,
            item,
            quantity,
           COALESCE(
             CASE
               WHEN order_subtotal > 0
                 THEN line_subtotal
                      + ((line_subtotal / order_subtotal) * tax)
                      - ((line_subtotal / order_subtotal) * discount)
               ELSE line_subtotal
             END,
             0
           )::float8 AS revenue
         FROM item_rows
         UNION ALL
         SELECT
            month_start,
            DATE_TRUNC('day', sale_time) AS sale_day,
            sale_time,
            item,
            quantity,
            revenue
         FROM missing_item_orders
       )
       SELECT
         TO_CHAR(sale_day, 'DD-Mon-YYYY') AS month,
         item,
         COALESCE(SUM(quantity), 0)::int AS quantity,
         COALESCE(SUM(revenue), 0)::float8 AS revenue
       FROM combined_rows
       GROUP BY month_start, sale_day, item
       ORDER BY month_start ASC, sale_day DESC, item ASC`,
      filterParams,
    );

    return withCors(Response.json(safeRows(result.rows)));
  } catch (primaryError) {
    console.error('GET /api/reports/monthly-menu primary query failed', primaryError);

    try {
      const fallback = await query(
        `SELECT
           TO_CHAR(DATE_TRUNC('day', p.pay_time), 'DD-Mon-YYYY') AS month,
           COALESCE(mi.name, 'Unknown') AS item,
           COALESCE(SUM(oi.quantity), 0)::int AS quantity,
           COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float8 AS revenue
         FROM orders o
         JOIN order_item oi ON oi.order_id = o.order_id
         JOIN payment p ON p.order_id = o.order_id
         LEFT JOIN menu_item mi ON mi.menu_item_id = oi.menu_item_id
         WHERE LOWER(COALESCE(p.payment_status, '')) = 'paid'
         ${fallbackMonthFilter}
         GROUP BY DATE_TRUNC('month', p.pay_time), DATE_TRUNC('day', p.pay_time), mi.name
         ORDER BY DATE_TRUNC('month', p.pay_time) ASC, DATE_TRUNC('day', p.pay_time) DESC, mi.name ASC`,
        filterParams,
      );
      return withCors(Response.json(safeRows(fallback.rows)));
    } catch (fallbackError) {
      console.error('GET /api/reports/monthly-menu fallback query failed', fallbackError);
      const message =
        process.env.NODE_ENV === 'production'
          ? 'Failed to load monthly menu report'
          : `Failed to load monthly menu report: ${fallbackError?.message || 'Unknown error'}`;
      return withCors(Response.json({ error: message }, { status: 500 }));
    }
  }
}

export async function OPTIONS() {
  return corsPreflight();
}