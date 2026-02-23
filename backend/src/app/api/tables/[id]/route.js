import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const allowedFields = ['number', 'seats'];

const mapTableRow = (row) => ({
  tableId: Number(row.table_id || 0),
  id: `t-${row.table_id}`,
  number: row.table_no,
  seats: Number(row.capacity || 0),
  status: 'free',
});

const parseTableId = (id) => {
  const normalized = String(id || '').replace(/^t-/i, '');
  const parsed = Number(normalized);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export async function GET(_request, { params }) {
  try {
    const id = parseTableId(params.id);
    if (!id) {
      return withCors(Response.json({ error: 'Invalid table id' }, { status: 400 }));
    }

    const result = await query(
      `SELECT table_id, table_no, capacity
       FROM restaurant_table
       WHERE table_id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Table not found' }, { status: 404 }));
    }
    return withCors(Response.json(mapTableRow(result.rows[0])));
  } catch (error) {
    console.error('GET /api/tables/[id] failed', error);
    return withCors(Response.json({ error: 'Failed to fetch table' }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  try {
    const id = parseTableId(params.id);
    if (!id) {
      return withCors(Response.json({ error: 'Invalid table id' }, { status: 400 }));
    }

    const body = await request.json();
    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(body || {}, field)) continue;

      if (field === 'number') {
        const value = String(body[field] || '').trim();
        if (!value) {
          return withCors(Response.json({ error: 'Table number cannot be empty' }, { status: 400 }));
        }
        updates.push(`table_no = $${values.length + 1}`);
        values.push(value);
      }
      if (field === 'seats') {
        const value = Number(body[field] || 0);
        if (!Number.isFinite(value) || value <= 0) {
          return withCors(Response.json({ error: 'Seats must be greater than 0' }, { status: 400 }));
        }
        updates.push(`capacity = $${values.length + 1}`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return withCors(Response.json({ error: 'No fields to update' }, { status: 400 }));
    }

    values.push(id);
    const result = await query(
      `UPDATE restaurant_table
       SET ${updates.join(', ')}
       WHERE table_id = $${values.length}
       RETURNING table_id, table_no, capacity`,
      values,
    );

    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Table not found' }, { status: 404 }));
    }
    return withCors(Response.json(mapTableRow(result.rows[0])));
  } catch (error) {
    console.error('PUT /api/tables/[id] failed', error);
    const duplicate = String(error?.message || '').toLowerCase().includes('duplicate key');
    if (duplicate) {
      return withCors(Response.json({ error: 'Table number already exists' }, { status: 409 }));
    }
    return withCors(Response.json({ error: 'Failed to update table' }, { status: 500 }));
  }
}

export async function DELETE(_request, { params }) {
  try {
    const id = parseTableId(params.id);
    if (!id) {
      return withCors(Response.json({ error: 'Invalid table id' }, { status: 400 }));
    }

    const result = await query(
      `DELETE FROM restaurant_table
       WHERE table_id = $1
       RETURNING table_id`,
      [id],
    );

    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Table not found' }, { status: 404 }));
    }

    return withCors(Response.json({ success: true }));
  } catch (error) {
    console.error('DELETE /api/tables/[id] failed', error);
    const message = String(error?.message || '').toLowerCase();
    const hasOrders = message.includes('orders_table_id_fkey') || message.includes('foreign key');
    if (hasOrders) {
      return withCors(
        Response.json(
          { error: 'Cannot delete table because it is used by existing orders' },
          { status: 409 },
        ),
      );
    }
    return withCors(Response.json({ error: 'Failed to delete table' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}