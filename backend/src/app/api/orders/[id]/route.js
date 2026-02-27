import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const TAX_RATE = 0.07;

const parseOrderId = (value) => {
  const normalized = String(value || '').replace(/^ord-/i, '');
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseUserId = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toDbOrderStatus = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled';
  if (normalized === 'pending' || normalized === 'new') return 'new';
  if (normalized === 'processing') return 'processing';
  if (normalized === 'finish' || normalized === 'ready' || normalized === 'completed') return 'ready';
  if (normalized === 'paid') return 'paid';
  return null;
};

const normalizePaymentMethod = (method) => {
  const normalized = String(method || '').toLowerCase();
  return ['cash', 'card', 'qr'].includes(normalized) ? normalized : null;
};

const getCancelEligibility = async (orderId) => {
  const orderCheck = await query(
    `SELECT o.status,
            EXISTS (SELECT 1 FROM payment p WHERE p.order_id = o.order_id) AS has_payment,
            COALESCE(ks.kitchen_status, 'new') AS kitchen_status
     FROM orders o
     LEFT JOIN kitchen_status ks ON ks.order_id = o.order_id
     WHERE o.order_id = $1
     LIMIT 1`,
    [orderId],
  );
  const row = orderCheck.rows[0];
  if (!row) {
    return { ok: false, response: withCors(Response.json({ error: 'Order not found' }, { status: 404 })) };
  }
  const currentStatus = String(row.status || '').toLowerCase();
  const kitchenStatus = String(row.kitchen_status || '').toLowerCase();
  const hasPayment = Boolean(row.has_payment);
  const canCancel =
    !hasPayment &&
    currentStatus === 'new' &&
    (kitchenStatus === 'new' || kitchenStatus === '');

  if (!canCancel) {
    return {
      ok: false,
      response: withCors(
        Response.json(
          { error: 'Order can only be canceled before kitchen starts and before payment.' },
          { status: 400 },
        ),
      ),
    };
  }
  return { ok: true, response: null };
};

const handleOrderStatusUpdate = async (orderId, nextStatus) => {
  const dbStatus = toDbOrderStatus(nextStatus);
  if (!dbStatus) {
    return withCors(Response.json({ error: 'Invalid order status' }, { status: 400 }));
  }

  if (dbStatus === 'canceled') {
    const eligibility = await getCancelEligibility(orderId);
    if (!eligibility.ok) {
      return eligibility.response;
    }

    await query(
      `DELETE FROM orders
       WHERE order_id = $1`,
      [orderId],
    );
    return withCors(Response.json({ ok: true, deleted: true }));
  }

  await query(
    `UPDATE orders
     SET status = $1
     WHERE order_id = $2`,
    [dbStatus, orderId],
  );

  if (dbStatus === 'processing' || dbStatus === 'ready') {
    await query(
      `INSERT INTO kitchen_status (order_id, kitchen_status, start_time, finish_time)
       VALUES (
         $1,
         $2,
         CASE WHEN $2 = 'processing' THEN NOW() ELSE NULL END,
         CASE WHEN $2 = 'ready' THEN NOW() ELSE NULL END
       )
       ON CONFLICT (order_id) DO UPDATE SET
         kitchen_status = EXCLUDED.kitchen_status,
         start_time = CASE
           WHEN EXCLUDED.kitchen_status = 'processing'
             THEN COALESCE(kitchen_status.start_time, NOW())
           ELSE kitchen_status.start_time
         END,
         finish_time = CASE
           WHEN EXCLUDED.kitchen_status = 'ready'
             THEN COALESCE(kitchen_status.finish_time, NOW())
           ELSE kitchen_status.finish_time
         END`,
      [orderId, dbStatus],
    );
  }

  return withCors(Response.json({ ok: true }));
};

const handlePayment = async (orderId, paymentMethod, cashierUserId) => {
  const method = normalizePaymentMethod(paymentMethod);
  if (!method) {
    return withCors(Response.json({ error: 'Invalid payment method' }, { status: 400 }));
  }

  const subtotalResult = await query(
    `SELECT COALESCE(SUM(quantity * unit_price), 0)::float8 AS subtotal
     FROM order_item
     WHERE order_id = $1`,
    [orderId],
  );
  const subtotal = Number(subtotalResult.rows[0]?.subtotal || 0);
  const tax = subtotal * TAX_RATE;
  const discount = 0;
  const amount = subtotal + tax - discount;

  await query(
    `INSERT INTO payment (order_id, cashier_user_id, pay_time, method, amount, tax, discount, payment_status)
     VALUES ($1, $2, NOW(), $3, $4, $5, $6, 'paid')
     ON CONFLICT (order_id) DO UPDATE SET
       cashier_user_id = EXCLUDED.cashier_user_id,
       pay_time = EXCLUDED.pay_time,
       method = EXCLUDED.method,
       amount = EXCLUDED.amount,
       tax = EXCLUDED.tax,
       discount = EXCLUDED.discount,
       payment_status = EXCLUDED.payment_status`,
    [orderId, cashierUserId, method, amount, tax, discount],
  );

  await query(
    `UPDATE orders
     SET status = 'paid'
     WHERE order_id = $1`,
    [orderId],
  );

  await query(
    `INSERT INTO kitchen_status (order_id, kitchen_status, finish_time)
     VALUES ($1, 'ready', NOW())
     ON CONFLICT (order_id) DO UPDATE SET
       kitchen_status = 'ready',
       finish_time = COALESCE(kitchen_status.finish_time, NOW())`,
    [orderId],
  );

  return withCors(Response.json({ ok: true }));
};

export async function PATCH(request, { params }) {
  const orderId = parseOrderId(params?.id);
  if (!orderId) {
    return withCors(Response.json({ error: 'Invalid order id' }, { status: 400 }));
  }

  try {
    const exists = await query(
      `SELECT order_id
       FROM orders
       WHERE order_id = $1
       LIMIT 1`,
      [orderId],
    );
    if (exists.rows.length === 0) {
      return withCors(Response.json({ error: 'Order not found' }, { status: 404 }));
    }

    const body = await request.json().catch(() => ({}));
    const nextStatus = body?.status;
    const paymentMethod = body?.paymentMethod;
    const cashierUserId = parseUserId(body?.cashierUserId);

    await query('BEGIN');
    try {
      let response;
      if (String(nextStatus || '').toLowerCase() === 'paid' || paymentMethod) {
        response = await handlePayment(orderId, paymentMethod, cashierUserId);
      } else {
        response = await handleOrderStatusUpdate(orderId, nextStatus);
      }
      if (response.status >= 400) {
        await query('ROLLBACK');
        return response;
      }
      await query('COMMIT');
      return response;
    } catch (txError) {
      await query('ROLLBACK');
      throw txError;
    }
  } catch (error) {
    console.error('PATCH /api/orders/[id] failed', error);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Failed to update order'
        : `Failed to update order: ${error?.message || 'Unknown error'}`;
    return withCors(Response.json({ error: message }, { status: 500 }));
  }
}

export async function DELETE(_request, { params }) {
  const orderId = parseOrderId(params?.id);
  if (!orderId) {
    return withCors(Response.json({ error: 'Invalid order id' }, { status: 400 }));
  }

  try {
    const eligibility = await getCancelEligibility(orderId);
    if (!eligibility.ok) return eligibility.response;

    await query(
      `DELETE FROM orders
       WHERE order_id = $1`,
      [orderId],
    );
    return withCors(Response.json({ ok: true, deleted: true }));
  } catch (error) {
    console.error('DELETE /api/orders/[id] failed', error);
    return withCors(Response.json({ error: 'Failed to cancel order' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}