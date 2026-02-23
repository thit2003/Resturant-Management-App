import { query } from '@/lib/db';
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
    const result = await query(
      `SELECT table_id, table_no, capacity
       FROM restaurant_table
       ORDER BY table_id ASC`,
    );
    return withCors(Response.json(result.rows.map(mapTableRow)));
  } catch (error) {
    console.error('GET /api/tables failed', error);
    return withCors(Response.json({ error: 'Failed to fetch tables' }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const number = String(body?.number || '').trim();
    const seats = Number(body?.seats || 0);

    if (!number) {
      return withCors(Response.json({ error: 'Table number is required' }, { status: 400 }));
    }
    if (!Number.isFinite(seats) || seats <= 0) {
      return withCors(Response.json({ error: 'Seats must be greater than 0' }, { status: 400 }));
    }

    const result = await query(
      `INSERT INTO restaurant_table (table_no, capacity)
       VALUES ($1, $2)
       RETURNING table_id, table_no, capacity`,
      [number, seats],
    );

    return withCors(Response.json(mapTableRow(result.rows[0]), { status: 201 }));
  } catch (error) {
    console.error('POST /api/tables failed', error);
    const duplicate = String(error?.message || '').toLowerCase().includes('duplicate key');
    if (duplicate) {
      return withCors(Response.json({ error: 'Table number already exists' }, { status: 409 }));
    }
    return withCors(Response.json({ error: 'Failed to create table' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}