import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

export async function GET() {
  try {
    const result = await query(
      `SELECT mi.menu_item_id AS id,
              mi.menu_item_id AS "menuItemId",
              mi.name,
              COALESCE(mi.category, 'Main') AS category,
              mi.price,
              mi.photo AS image,
              mi.is_available
       FROM menu_item mi
       ORDER BY mi.menu_item_id ASC`,
    );
    return withCors(Response.json(result.rows));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to fetch menu' }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name,
      category = 'Main',
      price = 0,
      image = null,
      is_available = true,
    } = body || {};

    if (!name) {
      return withCors(Response.json({ error: 'Name is required' }, { status: 400 }));
    }

    const result = await query(
      `INSERT INTO menu_item (name, category, price, is_available, photo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING menu_item_id AS id, menu_item_id AS "menuItemId", name, category, price, photo AS image, is_available`,
      [name, category, price, is_available, image],
    );
    return withCors(Response.json(result.rows[0], { status: 201 }));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to create menu item' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}