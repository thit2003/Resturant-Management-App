import { getCollection, nextSequence } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const mapMenuDoc = (doc) => ({
  id: Number(doc?.menu_item_id || 0),
  menuItemId: Number(doc?.menu_item_id || 0),
  name: doc?.name || '',
  category: doc?.categories?.[0] || 'Main',
  price: Number(doc?.price || 0),
  image: doc?.photo || null,
  is_available: Boolean(doc?.is_available),
});

export async function GET() {
  try {
    const menu = await getCollection('menu_item');
    const docs = await menu
      .find(
        {},
        { projection: { _id: 0, menu_item_id: 1, name: 1, categories: 1, price: 1, photo: 1, is_available: 1 } },
      )
      .sort({ menu_item_id: 1 })
      .toArray();
    return withCors(Response.json(docs.map(mapMenuDoc)));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to fetch menu' }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const menu = await getCollection('menu_item');
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

    const menuItemId = await nextSequence('menu_item', {
      collectionName: 'menu_item',
      idField: 'menu_item_id',
    });
    const doc = {
      menu_item_id: menuItemId,
      name: String(name).trim(),
      price: Number(price || 0),
      is_available: Boolean(is_available),
      photo: image || null,
      categories: category ? [String(category)] : [],
    };
    await menu.insertOne(doc);
    return withCors(Response.json(mapMenuDoc(doc), { status: 201 }));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to create menu item' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
