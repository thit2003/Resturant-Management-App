import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const allowedFields = ['name', 'category', 'price', 'image', 'is_available'];

export async function GET(_request, { params }) {
  try {
    const id = Number(params.id);
    const result = await query(
      `SELECT mi.menu_item_id AS id,
              mi.menu_item_id AS "menuItemId",
              mi.name,
              COALESCE(mi.category, 'Main') AS category,
              mi.price,
              mi.photo AS image,
              mi.is_available
       FROM menu_item mi
       WHERE mi.menu_item_id = $1
       LIMIT 1`,
      [id],
    );
    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Menu item not found' }, { status: 404 }));
    }
    return withCors(Response.json(result.rows[0]));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to fetch menu item' }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  try {
    const id = Number(params.id);
    const body = await request.json();

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        if (field === 'image') {
          updates.push('photo = $' + (values.length + 1));
          values.push(body[field]);
        } else if (field === 'category') {
          updates.push('category = $' + (values.length + 1));
          values.push(body[field]);
        } else {
          updates.push(field + ' = $' + (values.length + 1));
          values.push(body[field]);
        }
      }
    }

    if (updates.length === 0) {
      return withCors(Response.json({ error: 'No fields to update' }, { status: 400 }));
    }

    values.push(id);

    const result = await query(
      `UPDATE menu_item SET ${updates.join(', ')} WHERE menu_item_id = $${values.length}
       RETURNING menu_item_id AS id, menu_item_id AS "menuItemId", name, category, price, photo AS image, is_available`,
      values,
    );

    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Menu item not found' }, { status: 404 }));
    }

    return withCors(Response.json(result.rows[0]));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to update menu item' }, { status: 500 }));
  }
}

export async function DELETE(_request, { params }) {
  try {
    const id = Number(params.id);
    const result = await query(
      'DELETE FROM menu_item WHERE menu_item_id = $1 RETURNING menu_item_id',
      [id],
    );

    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Menu item not found' }, { status: 404 }));
    }

    return withCors(Response.json({ success: true }));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to delete menu item' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}