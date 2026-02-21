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

export { mongoClient };
