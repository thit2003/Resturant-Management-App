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

  try {
    const result = await query(
      `WITH order_subtotal AS (
         SELECT oi.order_id, COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float8 AS subtotal
         FROM order_item oi
         GROUP BY oi.order_id
       )
       SELECT
         o.order_id,
         o.order_time,
         o.table_id,
         rt.table_no,
         o.status AS order_status,
         oi.order_item_id,
         oi.menu_item_id,
         mi.name AS item_name,
         oi.quantity,
         oi.unit_price,
         COALESCE(os.subtotal, 0)::float8 AS subtotal,
         COALESCE(p.tax, 0)::float8 AS tax,
         COALESCE(p.discount, 0)::float8 AS discount,
         COALESCE(p.amount, 0)::float8 AS amount,
         p.payment_status,
         p.method,
         p.pay_time
       FROM orders o
       JOIN restaurant_table rt ON rt.table_id = o.table_id
       LEFT JOIN order_subtotal os ON os.order_id = o.order_id
       LEFT JOIN payment p ON p.order_id = o.order_id
       LEFT JOIN order_item oi ON oi.order_id = o.order_id
       LEFT JOIN menu_item mi ON mi.menu_item_id = oi.menu_item_id
       ORDER BY o.order_time DESC, o.order_id DESC, oi.order_item_id ASC`,
    );

    const ordersById = new Map();
    for (const row of Array.isArray(result.rows) ? result.rows : []) {
      const paymentStatus = String(row?.payment_status || '').toLowerCase();
      if (paymentStatus !== 'paid') continue;

      const saleTimeRaw = row?.pay_time || row?.order_time;
      if (!saleTimeRaw) continue;
      const saleTime = new Date(saleTimeRaw);
      if (Number.isNaN(Number(saleTime))) continue;

      const saleYear = saleTime.getFullYear();
      const saleMonth = saleTime.getMonth() + 1;
      if (filter && (saleYear !== filter.year || saleMonth !== filter.month)) continue;

      const orderId = Number(row?.order_id || 0);
      if (!Number.isInteger(orderId) || orderId <= 0) continue;

      if (!ordersById.has(orderId)) {
        ordersById.set(orderId, {
          saleTime,
          amount: Number(row?.amount || 0),
          tax: Number(row?.tax || 0),
          discount: Number(row?.discount || 0),
          subtotal: Number(row?.subtotal || 0),
          items: [],
        });
      }

      if (row?.order_item_id) {
        const itemName = String(row?.item_name || '').trim() || `Menu #${Number(row?.menu_item_id || 0)}`;
        ordersById.get(orderId).items.push({
          item: itemName,
          quantity: Number(row?.quantity || 0),
          unitPrice: Number(row?.unit_price || 0),
        });
      }
    }

    const grouped = new Map();
    for (const order of ordersById.values()) {
      const monthKey = `${order.saleTime.getFullYear()}-${String(order.saleTime.getMonth() + 1).padStart(2, '0')}`;
      const items = order.items.filter((item) => Number(item.quantity) > 0);
      if (items.length === 0) continue;

      const orderSubtotal = Number(order.subtotal || 0);
      const totalQty = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

      for (const item of items) {
        const quantity = Number(item.quantity || 0);
        const lineSubtotal = quantity * Number(item.unitPrice || 0);
        let lineRevenue = lineSubtotal;

        if (orderSubtotal > 0) {
          const ratio = lineSubtotal / orderSubtotal;
          lineRevenue = lineSubtotal + ratio * Number(order.tax || 0) - ratio * Number(order.discount || 0);
        } else if (Number(order.amount || 0) > 0 && totalQty > 0) {
          // Fallback for legacy rows with zero unit_price: allocate paid amount by quantity share.
          lineRevenue = Number(order.amount || 0) * (quantity / totalQty);
        }

        const key = `${monthKey}__${item.item}`;
        const current = grouped.get(key) || { month: monthKey, item: item.item, quantity: 0, revenue: 0 };
        current.quantity += quantity;
        current.revenue += lineRevenue;
        grouped.set(key, current);
      }
    }

    const rows = [...grouped.values()].sort((a, b) => {
      if (a.month === b.month) return a.item.localeCompare(b.item);
      return a.month.localeCompare(b.month);
    });

    return withCors(Response.json(safeRows(rows)));
  } catch (error) {
    console.error('GET /api/reports/monthly-menu failed', error);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Failed to load monthly menu report'
        : `Failed to load monthly menu report: ${error?.message || 'Unknown error'}`;
    return withCors(Response.json({ error: message }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
