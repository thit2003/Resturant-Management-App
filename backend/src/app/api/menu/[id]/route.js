import { getCollection } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const allowedFields = ['name', 'category', 'price', 'image', 'is_available'];

const mapMenuDoc = (doc) => ({
  id: Number(doc?.menu_item_id || 0),
  menuItemId: Number(doc?.menu_item_id || 0),
  name: doc?.name || '',
  category: doc?.categories?.[0] || 'Main',
  price: Number(doc?.price || 0),
  image: doc?.photo || null,
  is_available: Boolean(doc?.is_available),
});

export async function GET(_request, { params }) {
  try {
    const menu = await getCollection('menu_item');
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return withCors(Response.json({ error: 'Invalid menu item id' }, { status: 400 }));
    }

    const result = await menu.findOne(
      { menu_item_id: id },
      { projection: { _id: 0, menu_item_id: 1, name: 1, categories: 1, price: 1, photo: 1, is_available: 1 } },
    );
    if (!result) {
      return withCors(Response.json({ error: 'Menu item not found' }, { status: 404 }));
    }
    return withCors(Response.json(mapMenuDoc(result)));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to fetch menu item' }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  try {
    const menu = await getCollection('menu_item');
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return withCors(Response.json({ error: 'Invalid menu item id' }, { status: 400 }));
    }

    const body = await request.json();

    const updateDoc = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        if (field === 'image') {
          updateDoc.photo = body[field] || null;
        } else if (field === 'category') {
          updateDoc.categories = body[field] ? [String(body[field])] : [];
        } else {
          updateDoc[field] = body[field];
        }
      }
    }

    if (Object.keys(updateDoc).length === 0) {
      return withCors(Response.json({ error: 'No fields to update' }, { status: 400 }));
    }

    const result = await menu.findOneAndUpdate(
      { menu_item_id: id },
      { $set: updateDoc },
      {
        returnDocument: 'after',
        projection: { _id: 0, menu_item_id: 1, name: 1, categories: 1, price: 1, photo: 1, is_available: 1 },
      },
    );

    const updated = result?.value ?? result;
    if (!updated) {
      return withCors(Response.json({ error: 'Menu item not found' }, { status: 404 }));
    }

    return withCors(Response.json(mapMenuDoc(updated)));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to update menu item' }, { status: 500 }));
  }
}

export async function DELETE(_request, { params }) {
  try {
    const menu = await getCollection('menu_item');
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return withCors(Response.json({ error: 'Invalid menu item id' }, { status: 400 }));
    }

    const result = await menu.deleteOne({ menu_item_id: id });

    if (result.deletedCount === 0) {
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
