import { getCollection } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const safeRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    month: row?.month || '',
    item: row?.item || 'Unknown',
    quantity: Number(row?.quantity || 0),
    revenue: Number(row?.revenue || 0),
  }));

export async function GET() {
  try {
    const orders = await getCollection('orders');
    const orderItems = await getCollection('order_item');
    const menuItems = await getCollection('menu_item');
    const payments = await getCollection('payment');

    const [orderDocs, itemDocs, menuDocs, paymentDocs] = await Promise.all([
      orders.find({}, { projection: { _id: 0, order_id: 1, order_time: 1, status: 1 } }).toArray(),
      orderItems
        .find({}, { projection: { _id: 0, order_id: 1, menu_item_id: 1, quantity: 1, unit_price: 1 } })
        .toArray(),
      menuItems.find({}, { projection: { _id: 0, menu_item_id: 1, name: 1 } }).toArray(),
      payments.find({}, { projection: { _id: 0, order_id: 1, pay_time: 1, tax: 1, discount: 1 } }).toArray(),
    ]);

    const menuNameById = new Map(menuDocs.map((doc) => [Number(doc.menu_item_id || 0), doc.name || 'Unknown']));
    const paymentByOrderId = new Map(paymentDocs.map((doc) => [Number(doc.order_id || 0), doc]));
    const itemsByOrderId = new Map();

    for (const item of itemDocs) {
      const orderId = Number(item.order_id || 0);
      if (!itemsByOrderId.has(orderId)) itemsByOrderId.set(orderId, []);
      itemsByOrderId.get(orderId).push(item);
    }

    const monthlyMenu = new Map();
    for (const order of orderDocs) {
      const orderStatus = String(order?.status || '').toLowerCase();
      if (orderStatus === 'canceled') continue;

      const orderId = Number(order.order_id || 0);
      const lines = itemsByOrderId.get(orderId) || [];
      if (lines.length === 0) continue;

      const payment = paymentByOrderId.get(orderId);
      const monthDate = payment?.pay_time ? new Date(payment.pay_time) : new Date(order.order_time || Date.now());
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;

      const tax = Number(payment?.tax || 0);
      const discount = Number(payment?.discount || 0);
      const orderSubtotal = lines.reduce(
        (sum, line) => sum + Number(line.quantity || 0) * Number(line.unit_price || 0),
        0,
      );

      for (const line of lines) {
        const quantity = Number(line.quantity || 0);
        const lineSubtotal = quantity * Number(line.unit_price || 0);
        const itemName = menuNameById.get(Number(line.menu_item_id || 0)) || 'Unknown';
        const revenue =
          orderSubtotal > 0
            ? lineSubtotal + (lineSubtotal / orderSubtotal) * tax - (lineSubtotal / orderSubtotal) * discount
            : lineSubtotal;

        const key = `${monthKey}::${itemName}`;
        if (!monthlyMenu.has(key)) {
          monthlyMenu.set(key, { monthDate, item: itemName, quantity: 0, revenue: 0 });
        }
        const entry = monthlyMenu.get(key);
        entry.quantity += quantity;
        entry.revenue += revenue;
      }
    }

    const formatMonth = (date) =>
      new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);

    const rows = [...monthlyMenu.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => ({
        month: formatMonth(value.monthDate),
        item: value.item,
        quantity: value.quantity,
        revenue: value.revenue,
      }));

    return withCors(Response.json(safeRows(rows)));
  } catch (error) {
    console.error('GET /api/reports/monthly-menu failed', error);
    return withCors(Response.json([]));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
