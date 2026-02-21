import { getCollection, nextSequence } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const DEMO_USERS = [
  { name: 'John Chef', email: 'chef@rest.com', role: 'chef', password: '1234' },
  { name: 'Sarah Server', email: 'staff@rest.com', role: 'staff', password: '1234' },
  { name: 'Mike Manager', email: 'manager@rest.com', role: 'manager', password: '1234' },
  { name: 'Cathy Cashier', email: 'cashier@rest.com', role: 'cashier', password: '1234' },
  { name: 'Chef 1', email: 'chef@test.com', role: 'chef', password: '1234' },
  { name: 'Staff 1', email: 'staff@test.com', role: 'staff', password: '1234' },
  { name: 'Manager 1', email: 'manager@test.com', role: 'manager', password: '1234' },
  { name: 'Cashier 1', email: 'cashier@test.com', role: 'cashier', password: '1234' },
];

const ensureDemoUsers = async () => {
  const users = await getCollection('app_user');
  for (const user of DEMO_USERS) {
    const existing = await users.findOne({ email: user.email.toLowerCase() }, { projection: { _id: 1 } });
    if (existing) continue;

    let inserted = false;
    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      const userId = await nextSequence('app_user', {
        collectionName: 'app_user',
        idField: 'user_id',
      });

      try {
        const result = await users.updateOne(
          { email: user.email.toLowerCase() },
          {
            $setOnInsert: {
              user_id: userId,
              name: user.name,
              email: user.email.toLowerCase(),
              role: user.role,
              password: user.password,
              dob: null,
              photo: null,
              salary: 0,
            },
          },
          { upsert: true },
        );

        inserted = result.upsertedCount === 1 || result.matchedCount === 1;
      } catch (error) {
        if (error?.code !== 11000 || attempt === 2) {
          throw error;
        }
      }
    }
  }
};

export async function POST(request) {
  try {
    const users = await getCollection('app_user');
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();

    if (!email || !password) {
      return withCors(
        Response.json({ error: 'Email and password are required' }, { status: 400 }),
      );
    }

    await ensureDemoUsers();

    const user = await users.findOne(
      { email, password },
      {
        projection: {
          _id: 0,
          user_id: 1,
          name: 1,
          email: 1,
          role: 1,
          dob: 1,
          photo: 1,
        },
      },
    );

    if (!user) {
      return withCors(Response.json({ error: 'Invalid email or password' }, { status: 401 }));
    }

    return withCors(
      Response.json({
        id: Number(user.user_id || 0),
        name: user.name,
        email: user.email,
        role: user.role,
        date_of_birth: user.dob || null,
        photo: user.photo || null,
      }),
    );
  } catch (error) {
    console.error('POST /api/auth/login failed', error);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Failed to login'
        : `Failed to login: ${error?.message || 'Unknown error'}`;
    return withCors(Response.json({ error: message }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
