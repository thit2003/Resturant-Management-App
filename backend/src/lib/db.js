import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const configuredDbName = process.env.MONGODB_DB;

const globalForMongo = globalThis;

let mongoClient;
if (!globalForMongo.__restaurantMongoClient) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }
  globalForMongo.__restaurantMongoClient = new MongoClient(uri);
  globalForMongo.__restaurantMongoClientPromise = globalForMongo.__restaurantMongoClient.connect();
}

mongoClient = globalForMongo.__restaurantMongoClient;
const mongoClientPromise = globalForMongo.__restaurantMongoClientPromise;

let indexesEnsured = false;

const resolveDbName = () => {
  if (configuredDbName) return configuredDbName;
  try {
    const parsed = new URL(uri);
    const name = parsed.pathname?.replace(/^\//, '');
    return name || 'restaurant_db';
  } catch {
    return 'restaurant_db';
  }
};

const ensureIndexes = async (db) => {
  if (indexesEnsured) return;

  await db.collection('app_user').createIndexes([
    { key: { user_id: 1 }, unique: true },
    { key: { email: 1 }, unique: true },
  ]);

  await db.collection('restaurant_table').createIndexes([
    { key: { table_id: 1 }, unique: true },
    { key: { table_no: 1 }, unique: true },
  ]);

  await db.collection('menu_item').createIndexes([
    { key: { menu_item_id: 1 }, unique: true },
    { key: { categories: 1 } },
  ]);

  await db.collection('orders').createIndexes([
    { key: { order_id: 1 }, unique: true },
    { key: { table_id: 1 } },
    { key: { user_id: 1 } },
    { key: { order_time: 1 } },
  ]);

  await db.collection('order_item').createIndexes([
    { key: { order_item_id: 1 }, unique: true },
    { key: { order_id: 1 } },
    { key: { menu_item_id: 1 } },
  ]);

  await db.collection('kitchen_status').createIndexes([
    { key: { kitchen_status_id: 1 }, unique: true },
    { key: { order_id: 1 }, unique: true },
  ]);

  await db.collection('payment').createIndexes([
    { key: { payment_id: 1 }, unique: true },
    { key: { order_id: 1 }, unique: true },
    { key: { pay_time: 1 } },
  ]);

  const users = db.collection('app_user');
  const userCount = await users.countDocuments();
  if (userCount === 0) {
    await users.insertMany([
      {
        user_id: 1,
        name: 'John Chef',
        email: 'chef@rest.com',
        role: 'chef',
        password: '123456',
        dob: null,
      },
      {
        user_id: 2,
        name: 'Sarah Server',
        email: 'staff@rest.com',
        role: 'staff',
        password: '123456',
        dob: null,
      },
      {
        user_id: 3,
        name: 'Mike Manager',
        email: 'manager@rest.com',
        role: 'manager',
        password: '123456',
        dob: null,
      },
      {
        user_id: 4,
        name: 'Cathy Cashier',
        email: 'cashier@rest.com',
        role: 'cashier',
        password: '123456',
        dob: null,
      },
    ]);
  }

  indexesEnsured = true;
};

export const getDb = async () => {
  const client = await mongoClientPromise;
  const db = client.db(resolveDbName());
  await ensureIndexes(db);
  return db;
};

export const getCollection = async (name) => {
  const db = await getDb();
  return db.collection(name);
};

export const nextSequence = async (sequenceName, options = {}) => {
  const counters = await getCollection('counters');

  const collectionName = options?.collectionName;
  const idField = options?.idField;

  if (collectionName && idField) {
    const collection = await getCollection(collectionName);
    const maxDoc = await collection
      .find({ [idField]: { $type: 'number' } }, { projection: { _id: 0, [idField]: 1 } })
      .sort({ [idField]: -1 })
      .limit(1)
      .next();

    const maxValue = Number(maxDoc?.[idField] || 0);
    if (Number.isFinite(maxValue) && maxValue > 0) {
      await counters.updateOne(
        { _id: sequenceName },
        { $max: { value: maxValue } },
        { upsert: true },
      );
    }
  }

  const result = await counters.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: 'after', includeResultMetadata: true },
  );

  const nextValue = Number(result?.value?.value);
  if (Number.isFinite(nextValue) && nextValue > 0) {
    return nextValue;
  }

  const fallback = await counters.findOne(
    { _id: sequenceName },
    { projection: { _id: 0, value: 1 } },
  );

  return Number(fallback?.value || 1);
};

const createResult = (rows = []) => ({
  rows,
  rowCount: Array.isArray(rows) ? rows.length : 0,
});

const normalizeSql = (sql) =>
  String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const mapStaffRow = (user) => ({
  id: Number(user?.user_id || 0),
  name: user?.name || '',
  email: user?.email || '',
  role: user?.role || 'staff',
  date_of_birth: user?.dob ?? null,
  photo: user?.photo ?? null,
  salary: Number(user?.salary || 0),
  phone: user?.phone ?? null,
});

export const query = async (sql, params = []) => {
  const normalized = normalizeSql(sql);
  const db = await getDb();

  if (normalized === 'begin' || normalized === 'commit' || normalized === 'rollback') {
    return createResult([]);
  }

  if (normalized.includes('from information_schema.columns') && normalized.includes("table_name = 'app_user'")) {
    const requested = Array.isArray(params?.[0]) ? params[0] : [];
    const sample = await db.collection('app_user').findOne({}, { projection: { _id: 0 } });
    const keys = new Set(Object.keys(sample || {}));
    const rows = requested
      .filter((name) => keys.has(String(name || '')))
      .map((column_name) => ({ column_name }));
    return createResult(rows);
  }

  if (normalized.includes("select to_regclass('public.user_phone')")) {
    return createResult([{ has_user_phone_table: false }]);
  }

  if (
    normalized.includes('from app_user') &&
    normalized.includes('order by user_id asc') &&
    !normalized.includes('where user_id = $1')
  ) {
    const rows = await db
      .collection('app_user')
      .find({}, { projection: { _id: 0 } })
      .sort({ user_id: 1 })
      .toArray();
    return createResult(rows.map(mapStaffRow));
  }

  if (
    normalized.includes('select user_id as id') &&
    normalized.includes('from app_user') &&
    normalized.includes('where user_id = $1')
  ) {
    const user_id = Number(params?.[0] || 0);
    const user = await db.collection('app_user').findOne({ user_id }, { projection: { _id: 0 } });
    return createResult(user ? [mapStaffRow(user)] : []);
  }

  if (normalized.includes('from app_user') && normalized.includes('where lower(email) = $1 and password = $2')) {
    const email = String(params?.[0] || '').toLowerCase();
    const password = String(params?.[1] || '');
    let user = await db.collection('app_user').findOne({
      email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      password,
    });

    if (!user && process.env.NODE_ENV !== 'production') {
      user = await db.collection('app_user').findOne({
        email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      });
    }

    if (!user) return createResult([]);
    return createResult([
      {
        id: Number(user.user_id || 0),
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'staff',
        date_of_birth: user.dob || null,
        photo: user.photo || null,
        phone: user.phone || null,
      },
    ]);
  }

  if (
    normalized.includes('select table_id, table_no, capacity') &&
    normalized.includes('from restaurant_table')
  ) {
    const rows = await db
      .collection('restaurant_table')
      .find({}, { projection: { _id: 0, table_id: 1, table_no: 1, capacity: 1 } })
      .sort({ table_id: 1 })
      .toArray();
    return createResult(rows);
  }

  if (
    normalized.includes('insert into restaurant_table (table_no, capacity)') &&
    normalized.includes('returning table_id, table_no, capacity')
  ) {
    const table_no = String(params?.[0] || '').trim();
    const capacity = Number(params?.[1] || 0);
    const table_id = await nextSequence('restaurant_table_id', {
      collectionName: 'restaurant_table',
      idField: 'table_id',
    });
    const row = { table_id, table_no, capacity };
    await db.collection('restaurant_table').insertOne(row);
    return createResult([row]);
  }

  if (normalized.includes('from restaurant_table') && normalized.includes('where table_id = $1')) {
    const table_id = Number(params?.[0] || 0);
    const row = await db
      .collection('restaurant_table')
      .findOne({ table_id }, { projection: { _id: 0, table_id: 1 } });
    return createResult(row ? [row] : []);
  }

  if (
    normalized.includes('select mi.menu_item_id as id') &&
    normalized.includes('from menu_item mi')
  ) {
    const docs = await db
      .collection('menu_item')
      .find({}, { projection: { _id: 0 } })
      .sort({ menu_item_id: 1 })
      .toArray();

    const rows = docs.map((doc) => ({
      id: Number(doc.menu_item_id || 0),
      menuItemId: Number(doc.menu_item_id || 0),
      name: doc.name || '',
      category: doc.category || 'Main',
      price: Number(doc.price || 0),
      image: doc.photo || null,
      is_available: doc.is_available !== false,
    }));
    return createResult(rows);
  }

  if (
    normalized.includes('insert into menu_item (name, category, price, is_available, photo)') &&
    normalized.includes('returning menu_item_id as id')
  ) {
    const menu_item_id = await nextSequence('menu_item_id', {
      collectionName: 'menu_item',
      idField: 'menu_item_id',
    });
    const row = {
      menu_item_id,
      name: String(params?.[0] || ''),
      category: String(params?.[1] || 'Main'),
      price: Number(params?.[2] || 0),
      is_available: Boolean(params?.[3]),
      photo: params?.[4] ?? null,
    };
    await db.collection('menu_item').insertOne(row);
    return createResult([
      {
        id: row.menu_item_id,
        menuItemId: row.menu_item_id,
        name: row.name,
        category: row.category,
        price: row.price,
        image: row.photo,
        is_available: row.is_available,
      },
    ]);
  }

  if (normalized.includes('from app_user') && normalized.includes('where user_id = $1')) {
    const user_id = Number(params?.[0] || 0);
    const row = await db.collection('app_user').findOne({ user_id }, { projection: { _id: 0, user_id: 1 } });
    return createResult(row ? [row] : []);
  }

  if (
    normalized.includes('insert into app_user') &&
    normalized.includes('returning user_id as id')
  ) {
    const columnsMatch = String(sql || '').match(/insert\s+into\s+app_user\s*\(([^)]+)\)/i);
    const columnNames = String(columnsMatch?.[1] || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);

    const user_id = await nextSequence('app_user_id', {
      collectionName: 'app_user',
      idField: 'user_id',
    });

    const doc = { user_id };
    columnNames.forEach((columnName, index) => {
      doc[columnName] = params?.[index] ?? null;
    });

    await db.collection('app_user').insertOne(doc);
    return createResult([{ id: user_id }]);
  }

  if (normalized.includes('insert into user_phone (user_id, phone_no) values ($1, $2)')) {
    const user_id = Number(params?.[0] || 0);
    const phone_no = String(params?.[1] || '').trim();
    if (!phone_no) return createResult([]);
    await db.collection('app_user').updateOne(
      { user_id },
      { $set: { phone: phone_no } },
    );
    return createResult([]);
  }

  if (normalized.includes('delete from user_phone where user_id = $1')) {
    const user_id = Number(params?.[0] || 0);
    await db.collection('app_user').updateOne(
      { user_id },
      { $unset: { phone: '' } },
    );
    return createResult([]);
  }

  if (
    normalized.startsWith('update app_user set ') &&
    normalized.includes('where user_id = $') &&
    normalized.includes('returning user_id')
  ) {
    const updateMatch = String(sql || '').match(/set\s+([\s\S]+?)\s+where\s+user_id\s*=\s*\$(\d+)/i);
    const setClause = String(updateMatch?.[1] || '');
    const idParamIndex = Number(updateMatch?.[2] || 0);
    const user_id = Number(params?.[idParamIndex - 1] || 0);

    const setParts = setClause
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    const $set = {};
    for (const part of setParts) {
      const pairMatch = part.match(/([a-zA-Z_]+)\s*=\s*\$(\d+)/);
      if (!pairMatch) continue;
      const field = pairMatch[1];
      const paramIndex = Number(pairMatch[2]);
      $set[field] = params?.[paramIndex - 1] ?? null;
    }

    const result = await db.collection('app_user').findOneAndUpdate(
      { user_id },
      { $set },
      { returnDocument: 'after' },
    );

    if (!result) return createResult([]);
    return createResult([{ user_id }]);
  }

  if (normalized.includes('delete from app_user where user_id = $1 returning user_id')) {
    const user_id = Number(params?.[0] || 0);
    const result = await db.collection('app_user').findOneAndDelete({ user_id });
    return createResult(result ? [{ user_id }] : []);
  }

  if (normalized.includes('from menu_item') && normalized.includes('where menu_item_id = any($1::int[])')) {
    const ids = Array.isArray(params?.[0]) ? params[0].map((value) => Number(value)).filter((n) => Number.isInteger(n) && n > 0) : [];
    const rows = await db
      .collection('menu_item')
      .find({ menu_item_id: { $in: ids } }, { projection: { _id: 0, menu_item_id: 1, name: 1, price: 1 } })
      .toArray();
    return createResult(rows);
  }

  if (
    normalized.includes('select order_id') &&
    normalized.includes('from orders') &&
    normalized.includes('where order_id = $1') &&
    normalized.includes('limit 1')
  ) {
    const order_id = Number(params?.[0] || 0);
    const row = await db.collection('orders').findOne({ order_id }, { projection: { _id: 0, order_id: 1 } });
    return createResult(row ? [row] : []);
  }

  if (
    normalized.includes('select o.status') &&
    normalized.includes('from orders o') &&
    normalized.includes('left join kitchen_status ks on ks.order_id = o.order_id')
  ) {
    const order_id = Number(params?.[0] || 0);
    const [order, payment, kitchen] = await Promise.all([
      db.collection('orders').findOne({ order_id }, { projection: { _id: 0, status: 1 } }),
      db.collection('payment').findOne({ order_id }, { projection: { _id: 0, order_id: 1 } }),
      db.collection('kitchen_status').findOne({ order_id }, { projection: { _id: 0, kitchen_status: 1 } }),
    ]);
    if (!order) return createResult([]);
    return createResult([
      {
        status: order.status || 'new',
        has_payment: Boolean(payment),
        kitchen_status: kitchen?.kitchen_status || 'new',
      },
    ]);
  }

  if (normalized.includes('delete from orders') && normalized.includes('where order_id = $1')) {
    const order_id = Number(params?.[0] || 0);
    await Promise.all([
      db.collection('orders').deleteOne({ order_id }),
      db.collection('order_item').deleteMany({ order_id }),
      db.collection('kitchen_status').deleteMany({ order_id }),
      db.collection('payment').deleteMany({ order_id }),
    ]);
    return createResult([]);
  }

  if (
    normalized.includes('update orders') &&
    normalized.includes('set status = $1') &&
    normalized.includes('where order_id = $2')
  ) {
    const status = String(params?.[0] || 'new');
    const order_id = Number(params?.[1] || 0);
    await db.collection('orders').updateOne({ order_id }, { $set: { status } });
    return createResult([]);
  }

  if (
    normalized.includes('update orders') &&
    normalized.includes("set status = 'paid'") &&
    normalized.includes('where order_id = $1')
  ) {
    const order_id = Number(params?.[0] || 0);
    await db.collection('orders').updateOne({ order_id }, { $set: { status: 'paid' } });
    return createResult([]);
  }

  if (
    normalized.includes('select coalesce(sum(quantity * unit_price), 0)::float8 as subtotal') &&
    normalized.includes('from order_item') &&
    normalized.includes('where order_id = $1')
  ) {
    const order_id = Number(params?.[0] || 0);
    const items = await db
      .collection('order_item')
      .find({ order_id }, { projection: { _id: 0, quantity: 1, unit_price: 1 } })
      .toArray();
    const subtotal = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
      0,
    );
    return createResult([{ subtotal }]);
  }

  if (
    normalized.includes('insert into payment') &&
    normalized.includes('on conflict (order_id) do update set')
  ) {
    const [order_id, cashier_user_id, method, amount, tax, discount] = params;
    const normalizedOrderId = Number(order_id || 0);
    const payload = {
      cashier_user_id: Number(cashier_user_id || 0) || null,
      pay_time: new Date().toISOString(),
      method: String(method || ''),
      amount: Number(amount || 0),
      tax: Number(tax || 0),
      discount: Number(discount || 0),
      payment_status: 'paid',
    };

    const existingPayment = await db
      .collection('payment')
      .findOne({ order_id: normalizedOrderId }, { projection: { _id: 0, payment_id: 1 } });

    if (existingPayment) {
      await db.collection('payment').updateOne(
        { order_id: normalizedOrderId },
        { $set: payload },
      );
    } else {
      const payment_id = await nextSequence('payment_id', {
        collectionName: 'payment',
        idField: 'payment_id',
      });
      await db.collection('payment').insertOne({
        payment_id,
        order_id: normalizedOrderId,
        ...payload,
      });
    }
    return createResult([]);
  }

  if (
    normalized.includes('insert into orders (table_id, user_id)') &&
    normalized.includes('returning order_id, order_time, table_id')
  ) {
    const order_id = await nextSequence('order_id', { collectionName: 'orders', idField: 'order_id' });
    const row = {
      order_id,
      table_id: Number(params?.[0] || 0),
      user_id: Number(params?.[1] || 0),
      order_time: new Date().toISOString(),
      status: 'new',
    };
    await db.collection('orders').insertOne(row);
    return createResult([{ order_id: row.order_id, order_time: row.order_time, table_id: row.table_id }]);
  }

  if (normalized.includes('insert into kitchen_status (order_id, kitchen_status)')) {
    const order_id = Number(params?.[0] || 0);
    const existing = await db.collection('kitchen_status').findOne({ order_id }, { projection: { _id: 1 } });
    if (!existing) {
      const kitchen_status_id = await nextSequence('kitchen_status_id', {
        collectionName: 'kitchen_status',
        idField: 'kitchen_status_id',
      });
      await db.collection('kitchen_status').insertOne({
        kitchen_status_id,
        order_id,
        kitchen_status: 'new',
      });
    }
    return createResult([]);
  }

  if (
    normalized.includes('insert into kitchen_status (order_id, kitchen_status, start_time, finish_time)') &&
    normalized.includes('on conflict (order_id) do update set')
  ) {
    const order_id = Number(params?.[0] || 0);
    const kitchen_status = String(params?.[1] || 'new');
    const existing = await db
      .collection('kitchen_status')
      .findOne({ order_id }, { projection: { _id: 0, kitchen_status_id: 1, start_time: 1, finish_time: 1 } });

    if (!existing) {
      const kitchen_status_id = await nextSequence('kitchen_status_id', {
        collectionName: 'kitchen_status',
        idField: 'kitchen_status_id',
      });
      await db.collection('kitchen_status').insertOne({
        kitchen_status_id,
        order_id,
        kitchen_status,
        start_time: kitchen_status === 'processing' ? new Date().toISOString() : null,
        finish_time: kitchen_status === 'ready' ? new Date().toISOString() : null,
      });
      return createResult([]);
    }

    await db.collection('kitchen_status').updateOne(
      { order_id },
      {
        $set: {
          kitchen_status,
          start_time:
            kitchen_status === 'processing'
              ? existing.start_time || new Date().toISOString()
              : existing.start_time || null,
          finish_time:
            kitchen_status === 'ready'
              ? existing.finish_time || new Date().toISOString()
              : existing.finish_time || null,
        },
      },
    );
    return createResult([]);
  }

  if (
    normalized.includes('insert into kitchen_status (order_id, kitchen_status, finish_time)') &&
    normalized.includes('on conflict (order_id) do update set')
  ) {
    const order_id = Number(params?.[0] || 0);
    const existing = await db
      .collection('kitchen_status')
      .findOne({ order_id }, { projection: { _id: 0, kitchen_status_id: 1, start_time: 1, finish_time: 1 } });

    if (!existing) {
      const kitchen_status_id = await nextSequence('kitchen_status_id', {
        collectionName: 'kitchen_status',
        idField: 'kitchen_status_id',
      });
      await db.collection('kitchen_status').insertOne({
        kitchen_status_id,
        order_id,
        kitchen_status: 'ready',
        start_time: null,
        finish_time: new Date().toISOString(),
      });
      return createResult([]);
    }

    await db.collection('kitchen_status').updateOne(
      { order_id },
      {
        $set: {
          kitchen_status: 'ready',
          finish_time: existing.finish_time || new Date().toISOString(),
        },
      },
    );
    return createResult([]);
  }

  if (
    normalized.includes('insert into order_item (order_id, menu_item_id, quantity, unit_price)') &&
    normalized.includes('returning order_item_id, menu_item_id, quantity, unit_price')
  ) {
    const order_item_id = await nextSequence('order_item_id', {
      collectionName: 'order_item',
      idField: 'order_item_id',
    });
    const row = {
      order_item_id,
      order_id: Number(params?.[0] || 0),
      menu_item_id: Number(params?.[1] || 0),
      quantity: Number(params?.[2] || 0),
      unit_price: Number(params?.[3] || 0),
    };
    await db.collection('order_item').insertOne(row);
    return createResult([
      {
        order_item_id: row.order_item_id,
        menu_item_id: row.menu_item_id,
        quantity: row.quantity,
        unit_price: row.unit_price,
      },
    ]);
  }

  if (normalized.includes('from orders o') && normalized.includes('left join order_item oi')) {
    const [orders, tables, payments, items, menuItems] = await Promise.all([
      db.collection('orders').find({}, { projection: { _id: 0 } }).sort({ order_time: -1, order_id: -1 }).toArray(),
      db.collection('restaurant_table').find({}, { projection: { _id: 0, table_id: 1, table_no: 1 } }).toArray(),
      db.collection('payment').find({}, { projection: { _id: 0 } }).toArray(),
      db.collection('order_item').find({}, { projection: { _id: 0 } }).sort({ order_item_id: 1 }).toArray(),
      db.collection('menu_item').find({}, { projection: { _id: 0, menu_item_id: 1, name: 1 } }).toArray(),
    ]);

    const tableById = new Map(tables.map((row) => [Number(row.table_id), row]));
    const paymentByOrderId = new Map(payments.map((row) => [Number(row.order_id), row]));
    const menuById = new Map(menuItems.map((row) => [Number(row.menu_item_id), row]));
    const itemsByOrderId = new Map();
    for (const row of items) {
      const orderId = Number(row.order_id);
      if (!itemsByOrderId.has(orderId)) itemsByOrderId.set(orderId, []);
      itemsByOrderId.get(orderId).push(row);
    }

    const rows = [];
    for (const order of orders) {
      const orderId = Number(order.order_id);
      const table = tableById.get(Number(order.table_id));
      const payment = paymentByOrderId.get(orderId);
      const orderItems = itemsByOrderId.get(orderId) || [];
      const subtotal = orderItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
        0,
      );

      if (orderItems.length === 0) {
        rows.push({
          order_id: orderId,
          order_time: order.order_time,
          table_id: Number(order.table_id || 0),
          table_no: table?.table_no || '',
          order_status: order.status || 'new',
          order_item_id: null,
          menu_item_id: null,
          item_name: null,
          quantity: null,
          unit_price: null,
          subtotal,
          tax: Number(payment?.tax || 0),
          discount: Number(payment?.discount || 0),
          amount: Number(payment?.amount || 0),
          payment_status: payment?.payment_status || null,
          method: payment?.method || null,
          pay_time: payment?.pay_time || null,
        });
        continue;
      }

      for (const item of orderItems) {
        const menu = menuById.get(Number(item.menu_item_id));
        rows.push({
          order_id: orderId,
          order_time: order.order_time,
          table_id: Number(order.table_id || 0),
          table_no: table?.table_no || '',
          order_status: order.status || 'new',
          order_item_id: Number(item.order_item_id || 0),
          menu_item_id: Number(item.menu_item_id || 0),
          item_name: menu?.name || 'Unknown',
          quantity: Number(item.quantity || 0),
          unit_price: Number(item.unit_price || 0),
          subtotal,
          tax: Number(payment?.tax || 0),
          discount: Number(payment?.discount || 0),
          amount: Number(payment?.amount || 0),
          payment_status: payment?.payment_status || null,
          method: payment?.method || null,
          pay_time: payment?.pay_time || null,
        });
      }
    }

    return createResult(rows);
  }

  throw new Error(`Unsupported SQL query pattern in Mongo adapter: ${String(sql || '').slice(0, 180)}`);
};

export { mongoClient };
