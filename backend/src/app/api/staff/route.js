import { getCollection, nextSequence } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const USER_ROLES = new Set(['manager', 'chef', 'staff', 'cashier']);

const mapStaffDoc = (doc) => ({
  id: Number(doc?.user_id || 0),
  name: doc?.name || '',
  email: doc?.email || '',
  role: doc?.role || 'staff',
  date_of_birth: doc?.dob || null,
  photo: doc?.photo || null,
  salary: Number(doc?.salary || 0),
});

export async function GET() {
  try {
    const users = await getCollection('app_user');
    const docs = await users
      .find(
        {},
        {
          projection: {
            _id: 0,
            user_id: 1,
            name: 1,
            email: 1,
            role: 1,
            dob: 1,
            photo: 1,
            salary: 1,
          },
        },
      )
      .sort({ user_id: 1 })
      .toArray();

    return withCors(Response.json(docs.map(mapStaffDoc)));
  } catch (error) {
    console.error('GET /api/staff failed', error);
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Failed to fetch staff'
        : `Failed to fetch staff: ${error?.message || 'Unknown error'}`;
    return withCors(Response.json({ error: message }, { status: 500 }));
  }
}

export async function POST(request) {
  try {
    const users = await getCollection('app_user');
    const body = await request.json();
    const {
      name,
      email,
      role = 'staff',
      date_of_birth,
      dob,
      password = null,
      salary = 0,
      photo = null,
    } = body || {};
    const resolvedDob = dob ?? date_of_birth ?? null;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = String(role || 'staff').trim().toLowerCase();

    if (!name || !normalizedEmail || !password) {
      return withCors(
        Response.json({ error: 'Name, email, and password are required' }, { status: 400 }),
      );
    }
    if (!USER_ROLES.has(normalizedRole)) {
      return withCors(Response.json({ error: 'Invalid role' }, { status: 400 }));
    }
    const numericSalary = Number(salary || 0);
    if (!Number.isFinite(numericSalary) || numericSalary < 0) {
      return withCors(Response.json({ error: 'Invalid salary' }, { status: 400 }));
    }

    const userId = await nextSequence('app_user', {
      collectionName: 'app_user',
      idField: 'user_id',
    });
    const doc = {
      user_id: userId,
      name: String(name).trim(),
      email: normalizedEmail,
      role: normalizedRole,
      dob: resolvedDob,
      password: String(password),
      salary: Math.round(numericSalary),
      photo: photo || null,
    };

    await users.insertOne(doc);
    return withCors(Response.json(mapStaffDoc(doc), { status: 201 }));
  } catch (error) {
    console.error('POST /api/staff failed', error);
    if (error?.code === 11000) {
      return withCors(Response.json({ error: 'Email already exists' }, { status: 409 }));
    }
    const message =
      process.env.NODE_ENV === 'production'
        ? 'Failed to create staff'
        : `Failed to create staff: ${error?.message || 'Unknown error'}`;
    return withCors(Response.json({ error: message }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
