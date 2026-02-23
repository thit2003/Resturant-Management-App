import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const TAX_RATE = 0.07;

const parseTableId = (value) => {
  const normalized = String(value || '').replace(/^t-/i, '');
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseUserId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseOrderId = (value) => {
  const normalized = String(value || '').replace(/^ord-/i, '');
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toUiStatus = (dbStatus) => {
  const status = String(dbStatus || '').toLowerCase();
  if (status === 'new') return 'pending';
  if (status === 'processing') return 'processing';
  if (status === 'ready') return 'finish';
  if (status === 'paid') return 'paid';
  return status || 'pending';
};

const normalizeItems = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      menuItemId: Number(item?.menuItemId ?? item?.id ?? 0),
      quantity: Number(item?.quantity || 0),
      protein: String(item?.protein || 'None'),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.menuItemId) &&
        item.menuItemId > 0 &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0,
    );

const mapRowsToOrders = (rows) => {
  const ordersById = new Map();

  for (const row of Array.isArray(rows) ? rows : []) {
    const orderId = Number(row.order_id);
    if (!ordersById.has(orderId)) {
      const subtotal = Number(row.subtotal || 0);
      const tax = Number(row.tax || subtotal * TAX_RATE);
      const discount = Number(row.discount || 0);
      const total = Number(row.amount || subtotal + tax - discount);
      const paymentStatus = String(row.payment_status || '').toLowerCase();
      const effectiveStatus = paymentStatus === 'paid' || row.pay_time ? 'paid' : row.order_status;
      ordersById.set(orderId, {
        id: `ord-${orderId}`,
        orderId,
        tableId: `t-${row.table_id}`,
        tableNumber: row.table_no,
        status: toUiStatus(effectiveStatus),
        paymentMethod: row.method ? String(row.method).toLowerCase() : null,
        paidAt: row.pay_time || null,
        createdAt: row.order_time,
        subtotal,
        tax,
        total,
        items: [],
      });
    }

    if (row.order_item_id) {
      const order = ordersById.get(orderId);
      order.items.push({
        id: Number(row.order_item_id),
        menuItemId: Number(row.menu_item_id),
        name: row.item_name || 'Unknown',
        quantity: Number(row.quantity || 0),
        price: Number(row.unit_price || 0),
        protein: 'None',
      });
    }
  }

  return [...ordersById.values()];
};

export async function GET() {
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

    return withCors(Response.json(mapRowsToOrders(result.rows)));
  } catch (error) {
    console.error('GET /api/orders failed', error);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Failed to fetch orders'
        : `Failed to fetch orders: ${error?.message || 'Unknown error'}`;
    return withCors(Response.json({ error: message }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const tableId = parseTableId(body?.tableId);
    const userId = parseUserId(body?.userId);
    const note = String(body?.note || '').trim();
    const items = normalizeItems(body?.items);

    if (!tableId) {
      return withCors(Response.json({ error: 'Valid tableId is required' }, { status: 400 }));
    }
    if (!userId) {
      return withCors(Response.json({ error: 'Valid userId is required' }, { status: 400 }));
    }
    if (items.length === 0) {
      return withCors(Response.json({ error: 'At least one order item is required' }, { status: 400 }));
    }

    const tableCheck = await query(
      `SELECT table_id
       FROM restaurant_table
       WHERE table_id = $1
       LIMIT 1`,
      [tableId],
    );
    if (tableCheck.rows.length === 0) {
      return withCors(Response.json({ error: `Table ${tableId} does not exist` }, { status: 400 }));
    }

    const userCheck = await query(
      `SELECT user_id
       FROM app_user
       WHERE user_id = $1
       LIMIT 1`,
      [userId],
    );
    if (userCheck.rows.length === 0) {
      return withCors(Response.json({ error: `User ${userId} does not exist` }, { status: 400 }));
    }

    const itemIds = items.map((item) => item.menuItemId);
    const menuResult = await query(
      `SELECT menu_item_id, name, price
       FROM menu_item
       WHERE menu_item_id = ANY($1::int[])`,
      [itemIds],
    );
    const menuById = new Map(
      menuResult.rows.map((row) => [
        Number(row.menu_item_id),
        { name: row.name, price: Number(row.price || 0) },
      ]),
    );
    const missingMenuItem = items.find((item) => !menuById.has(item.menuItemId));
    if (missingMenuItem) {
      return withCors(
        Response.json(
          { error: `Menu item ${missingMenuItem.menuItemId} does not exist` },
          { status: 400 },
        ),
      );
    }

    await query('BEGIN');
    try {
      const orderResult = await query(
        `INSERT INTO orders (table_id, user_id)
         VALUES ($1, $2)
         RETURNING order_id, order_time, table_id`,
        [tableId, userId],
      );
      const order = orderResult.rows[0];

      await query(
        `INSERT INTO kitchen_status (order_id, kitchen_status)
         VALUES ($1, 'new')
         ON CONFLICT (order_id) DO NOTHING`,
        [order.order_id],
      );

      const insertedItems = [];
      for (const item of items) {
        const menuItem = menuById.get(item.menuItemId);
        const itemResult = await query(
          `INSERT INTO order_item (order_id, menu_item_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)
           RETURNING order_item_id, menu_item_id, quantity, unit_price`,
          [order.order_id, item.menuItemId, item.quantity, menuItem.price],
        );
        insertedItems.push({
          ...itemResult.rows[0],
          name: menuItem.name,
          protein: item.protein,
        });
      }

      await query('COMMIT');

      return withCors(
        Response.json(
          {
            id: `ord-${order.order_id}`,
            orderId: order.order_id,
            tableId: `t-${order.table_id}`,
            status: 'pending',
            note,
            createdAt: order.order_time,
            items: insertedItems.map((item) => ({
              id: item.order_item_id,
              menuItemId: Number(item.menu_item_id),
              name: item.name,
              quantity: Number(item.quantity || 0),
              price: Number(item.unit_price || 0),
              protein: item.protein,
            })),
          },
          { status: 201 },
        ),
      );
    } catch (txError) {
      await query('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    console.error('POST /api/orders failed', error);
    const detail = String(error?.message || '').toLowerCase();
    if (detail.includes('violates foreign key constraint')) {
      return withCors(Response.json({ error: 'Invalid table or user reference' }, { status: 400 }));
    }
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Failed to create order'
        : `Failed to create order: ${error?.message || 'Unknown error'}`;
    return withCors(Response.json({ error: message }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}