import { getCollection, nextSequence } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const mapTableRow = (row) => ({
  tableId: Number(row.table_id || 0),
  id: `t-${row.table_id}`,
  number: row.table_no,
  seats: Number(row.capacity || 0),
  status: 'free',
});

export async function GET() {
  try {
    const tables = await getCollection('restaurant_table');
    const rows = await tables
      .find({}, { projection: { _id: 0, table_id: 1, table_no: 1, capacity: 1 } })
      .sort({ table_id: 1 })
      .toArray();
    return withCors(Response.json(rows.map(mapTableRow)));
  } catch (error) {
    console.error('GET /api/tables failed', error);
    return withCors(Response.json({ error: 'Failed to fetch tables' }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const tables = await getCollection('restaurant_table');
    const body = await request.json();
    const number = String(body?.number || '').trim();
    const seats = Number(body?.seats || 0);

    if (!number) {
      return withCors(Response.json({ error: 'Table number is required' }, { status: 400 }));
    }
    if (!Number.isFinite(seats) || seats <= 0) {
      return withCors(Response.json({ error: 'Seats must be greater than 0' }, { status: 400 }));
    }

    const tableId = await nextSequence('restaurant_table', {
      collectionName: 'restaurant_table',
      idField: 'table_id',
    });
    const row = { table_id: tableId, table_no: number, capacity: seats };
    await tables.insertOne(row);

    return withCors(Response.json(mapTableRow(row), { status: 201 }));
  } catch (error) {
    console.error('POST /api/tables failed', error);
    const duplicate = error?.code === 11000;
    if (duplicate) {
      return withCors(Response.json({ error: 'Table number already exists' }, { status: 409 }));
    }
    return withCors(Response.json({ error: 'Failed to create table' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
