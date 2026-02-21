import { getCollection } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const safeRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    month: row?.month || '',
    orders: Number(row?.orders || 0),
    revenue: Number(row?.revenue || 0),
  }));

export async function GET() {
  try {
    const orders = await getCollection('orders');
    const orderItems = await getCollection('order_item');
    const payments = await getCollection('payment');

    const [orderDocs, itemDocs, paymentDocs] = await Promise.all([
      orders.find({}, { projection: { _id: 0, order_id: 1, order_time: 1, status: 1 } }).toArray(),
      orderItems.find({}, { projection: { _id: 0, order_id: 1, quantity: 1, unit_price: 1 } }).toArray(),
      payments
        .find({}, { projection: { _id: 0, order_id: 1, pay_time: 1, amount: 1, tax: 1, discount: 1, payment_status: 1 } })
        .toArray(),
    ]);

    const subtotalByOrderId = new Map();
    for (const item of itemDocs) {
      const orderId = Number(item.order_id || 0);
      const line = Number(item.quantity || 0) * Number(item.unit_price || 0);
      subtotalByOrderId.set(orderId, (subtotalByOrderId.get(orderId) || 0) + line);
    }

    const paymentByOrderId = new Map(
      paymentDocs.map((payment) => [Number(payment.order_id || 0), payment]),
    );

    const monthly = new Map();
    for (const order of orderDocs) {
      const orderId = Number(order.order_id || 0);
      const payment = paymentByOrderId.get(orderId);
      const paymentStatus = String(payment?.payment_status || '').toLowerCase();
      const orderStatus = String(order?.status || '').toLowerCase();
      const isPaid = paymentStatus === 'paid' || (!payment && orderStatus === 'paid');
      if (!isPaid) continue;

      const monthDate = payment?.pay_time ? new Date(payment.pay_time) : new Date(order.order_time || Date.now());
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const subtotal = Number(subtotalByOrderId.get(orderId) || 0);
      const amount = Number(payment?.amount || 0);
      const tax = Number(payment?.tax || 0);
      const discount = Number(payment?.discount || 0);
      const totalAmount = (amount !== 0 ? amount : subtotal) + tax - discount;

      if (!monthly.has(monthKey)) {
        monthly.set(monthKey, { monthDate, orders: 0, revenue: 0 });
      }
      const entry = monthly.get(monthKey);
      entry.orders += 1;
      entry.revenue += totalAmount;
    }

    const formatMonth = (date) =>
      new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(date);

    const rows = [...monthly.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, value]) => ({
        month: formatMonth(value.monthDate),
        orders: value.orders,
        revenue: value.revenue,
      }));

    return withCors(Response.json(safeRows(rows)));
  } catch (error) {
    console.error('GET /api/reports/monthly failed', error);
    return withCors(Response.json([]));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
