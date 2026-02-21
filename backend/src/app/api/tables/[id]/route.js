import { getCollection } from '@/lib/db';
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
    const tables = await getCollection('restaurant_table');
    const id = parseTableId(params.id);
    if (!id) {
      return withCors(Response.json({ error: 'Invalid table id' }, { status: 400 }));
    }

    const result = await tables.findOne(
      { table_id: id },
      { projection: { _id: 0, table_id: 1, table_no: 1, capacity: 1 } },
    );
    if (!result) {
      return withCors(Response.json({ error: 'Table not found' }, { status: 404 }));
    }
    return withCors(Response.json(mapTableRow(result)));
  } catch (error) {
    console.error('GET /api/tables/[id] failed', error);
    return withCors(Response.json({ error: 'Failed to fetch table' }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  try {
    const tables = await getCollection('restaurant_table');
    const id = parseTableId(params.id);
    if (!id) {
      return withCors(Response.json({ error: 'Invalid table id' }, { status: 400 }));
    }

    const body = await request.json();
    const updateDoc = {};

    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(body || {}, field)) continue;

      if (field === 'number') {
        const value = String(body[field] || '').trim();
        if (!value) {
          return withCors(Response.json({ error: 'Table number cannot be empty' }, { status: 400 }));
        }
        updateDoc.table_no = value;
      }
      if (field === 'seats') {
        const value = Number(body[field] || 0);
        if (!Number.isFinite(value) || value <= 0) {
          return withCors(Response.json({ error: 'Seats must be greater than 0' }, { status: 400 }));
        }
        updateDoc.capacity = value;
      }
    }

    if (Object.keys(updateDoc).length === 0) {
      return withCors(Response.json({ error: 'No fields to update' }, { status: 400 }));
    }

    const result = await tables.findOneAndUpdate(
      { table_id: id },
      { $set: updateDoc },
      {
        returnDocument: 'after',
        projection: { _id: 0, table_id: 1, table_no: 1, capacity: 1 },
      },
    );

    const updated = result?.value ?? result;
    if (!updated) {
      return withCors(Response.json({ error: 'Table not found' }, { status: 404 }));
    }
    return withCors(Response.json(mapTableRow(updated)));
  } catch (error) {
    console.error('PUT /api/tables/[id] failed', error);
    const duplicate = error?.code === 11000;
    if (duplicate) {
      return withCors(Response.json({ error: 'Table number already exists' }, { status: 409 }));
    }
    return withCors(Response.json({ error: 'Failed to update table' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
