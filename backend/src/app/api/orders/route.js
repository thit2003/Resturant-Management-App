import { getCollection, nextSequence } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const TAX_RATE = 0.07;

const mapStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'new') return 'pending';
  return value || 'pending';
};

const parseTableId = (value) => {
  const normalized = String(value || '').replace(/^t-/i, '');
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseUserId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeItems = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => ({
      menuItemId: Number(item?.menuItemId ?? item?.id ?? 0),
      quantity: Number(item?.quantity || 0),
      protein: String(item?.protein || 'None'),
    }))
    .filter((item) => Number.isInteger(item.menuItemId) && item.menuItemId > 0 && Number.isInteger(item.quantity) && item.quantity > 0);

export async function GET() {
  try {
    const orders = await getCollection('orders');
    const orderItems = await getCollection('order_item');
    const menuItems = await getCollection('menu_item');

    const orderRows = await orders
      .find(
        {},
        {
          projection: {
            _id: 0,
            order_id: 1,
            order_time: 1,
            table_id: 1,
            status: 1,
            note: 1,
            payment_method: 1,
            paid_at: 1,
          },
        },
      )
      .sort({ order_time: -1, order_id: -1 })
      .toArray();

    if (orderRows.length === 0) {
      return withCors(Response.json([]));
    }

    const orderIds = orderRows.map((row) => Number(row.order_id)).filter((id) => Number.isInteger(id));
    const orderItemRows = await orderItems
      .find(
        { order_id: { $in: orderIds } },
        {
          projection: {
            _id: 0,
            order_item_id: 1,
            order_id: 1,
            menu_item_id: 1,
            quantity: 1,
            unit_price: 1,
            protein: 1,
          },
        },
      )
      .sort({ order_item_id: 1 })
      .toArray();

    const menuIds = Array.from(
      new Set(
        orderItemRows
          .map((row) => Number(row.menu_item_id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    );

    const menuRows = await menuItems
      .find(
        { menu_item_id: { $in: menuIds } },
        { projection: { _id: 0, menu_item_id: 1, name: 1 } },
      )
      .toArray();
    const menuNameById = new Map(
      menuRows.map((row) => [Number(row.menu_item_id), row.name || `Item ${row.menu_item_id}`]),
    );

    const itemsByOrderId = new Map();
    for (const row of orderItemRows) {
      const current = itemsByOrderId.get(Number(row.order_id)) || [];
      current.push({
        id: Number(row.order_item_id || 0),
        menuItemId: Number(row.menu_item_id || 0),
        name: menuNameById.get(Number(row.menu_item_id)) || `Item ${row.menu_item_id}`,
        quantity: Number(row.quantity || 0),
        price: Number(row.unit_price || 0),
        protein: String(row.protein || 'None'),
      });
      itemsByOrderId.set(Number(row.order_id), current);
    }

    const payload = orderRows.map((row) => {
      const items = itemsByOrderId.get(Number(row.order_id)) || [];
      const subtotal = items.reduce(
        (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
        0,
      );
      const tax = subtotal * TAX_RATE;
      const total = subtotal + tax;

      return {
        id: `ord-${row.order_id}`,
        orderId: Number(row.order_id || 0),
        tableId: `t-${row.table_id}`,
        status: mapStatus(row.status),
        note: row.note || '',
        paymentMethod: row.payment_method || null,
        paidAt: row.paid_at || null,
        createdAt: row.order_time,
        subtotal,
        tax,
        total,
        items,
      };
    });

    return withCors(Response.json(payload));
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
    const tables = await getCollection('restaurant_table');
    const users = await getCollection('app_user');
    const menuItems = await getCollection('menu_item');
    const orders = await getCollection('orders');
    const orderItems = await getCollection('order_item');

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

    const tableCheck = await tables.findOne({ table_id: tableId }, { projection: { _id: 0, table_id: 1 } });
    if (!tableCheck) {
      return withCors(Response.json({ error: `Table ${tableId} does not exist` }, { status: 400 }));
    }

    const userCheck = await users.findOne({ user_id: userId }, { projection: { _id: 0, user_id: 1 } });
    if (!userCheck) {
      return withCors(Response.json({ error: `User ${userId} does not exist` }, { status: 400 }));
    }

    const itemIds = items.map((item) => item.menuItemId);
    const menuResult = await menuItems
      .find(
        { menu_item_id: { $in: itemIds } },
        { projection: { _id: 0, menu_item_id: 1, name: 1, price: 1 } },
      )
      .toArray();
    const menuById = new Map(
      menuResult.map((row) => [
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

    const orderId = await nextSequence('orders', {
      collectionName: 'orders',
      idField: 'order_id',
    });
    const order = {
      order_id: orderId,
      order_time: new Date(),
      table_id: tableId,
      user_id: userId,
      status: 'new',
      note,
    };
    await orders.insertOne(order);

    const insertedItems = [];
    for (const item of items) {
      const menuItem = menuById.get(item.menuItemId);
      const orderItemId = await nextSequence('order_item', {
        collectionName: 'order_item',
        idField: 'order_item_id',
      });
      const itemResult = {
        order_item_id: orderItemId,
        order_id: order.order_id,
        menu_item_id: item.menuItemId,
        quantity: item.quantity,
        unit_price: menuItem.price,
        protein: item.protein,
      };
      await orderItems.insertOne(itemResult);
      insertedItems.push({
        ...itemResult,
        name: menuItem.name,
        protein: item.protein,
      });
    }

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
  } catch (error) {
    console.error('POST /api/orders failed', error);
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
