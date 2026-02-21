import { getCollection } from '@/lib/db';
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

export async function GET(_request, { params }) {
  try {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return withCors(Response.json({ error: 'Invalid staff id' }, { status: 400 }));
    }

    const users = await getCollection('app_user');
    const doc = await users.findOne(
      { user_id: id },
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
    );

    if (!doc) {
      return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
    }
    return withCors(Response.json(mapStaffDoc(doc)));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to fetch staff' }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  try {
    const users = await getCollection('app_user');
    const allowedFields = ['name', 'email', 'role', 'date_of_birth', 'dob', 'password', 'salary', 'photo'];
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return withCors(Response.json({ error: 'Invalid staff id' }, { status: 400 }));
    }

    const body = await request.json();

    const updateDoc = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = body[field];
        if (value === undefined) {
          continue;
        }
        if (field === 'password') {
          const normalizedPassword = String(value || '').trim();
          if (!normalizedPassword) {
            continue;
          }
          updateDoc.password = normalizedPassword;
        } else if (field === 'date_of_birth' || field === 'dob') {
          updateDoc.dob = value || null;
        } else if (field === 'salary') {
          const numericSalary = Number(value);
          if (!Number.isFinite(numericSalary)) {
            return withCors(Response.json({ error: 'Invalid salary' }, { status: 400 }));
          }
          updateDoc.salary = Math.round(numericSalary);
        } else if (field === 'email') {
          const normalizedEmail = String(value || '').trim().toLowerCase();
          if (!normalizedEmail) {
            return withCors(Response.json({ error: 'Email cannot be empty' }, { status: 400 }));
          }
          updateDoc.email = normalizedEmail;
        } else if (field === 'role') {
          const normalizedRole = String(value || '').trim().toLowerCase();
          if (!USER_ROLES.has(normalizedRole)) {
            return withCors(Response.json({ error: 'Invalid role' }, { status: 400 }));
          }
          updateDoc.role = normalizedRole;
        } else {
          updateDoc[field] = value;
        }
      }
    }

    if (Object.keys(updateDoc).length === 0) {
      const hasRequestFields = Object.keys(body || {}).length > 0;
      if (hasRequestFields) {
        const fallback = await users.findOne(
          { user_id: id },
          { projection: { _id: 0, user_id: 1, name: 1, email: 1, role: 1, dob: 1, photo: 1, salary: 1 } },
        );
        if (!fallback) {
          return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
        }
        return withCors(Response.json(mapStaffDoc(fallback)));
      }
      return withCors(Response.json({ error: 'No fields to update' }, { status: 400 }));
    }

    const result = await users.findOneAndUpdate(
      { user_id: id },
      { $set: updateDoc },
      {
        returnDocument: 'after',
        projection: { _id: 0, user_id: 1, name: 1, email: 1, role: 1, dob: 1, photo: 1, salary: 1 },
      },
    );

    const updated = result?.value ?? result;
    if (!updated) {
      return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
    }

    return withCors(Response.json(mapStaffDoc(updated)));
  } catch (error) {
    if (error?.code === 11000) {
      return withCors(Response.json({ error: 'Email already exists' }, { status: 409 }));
    }
    return withCors(Response.json({ error: 'Failed to update staff' }, { status: 500 }));
  }
}

export async function DELETE(_request, { params }) {
  try {
    const users = await getCollection('app_user');
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return withCors(Response.json({ error: 'Invalid staff id' }, { status: 400 }));
    }

    const result = await users.deleteOne({ user_id: id });

    if (result.deletedCount === 0) {
      return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
    }

    return withCors(Response.json({ success: true }));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to delete staff' }, { status: 500 }));
  }
}

export async function OPTIONS() {
  return corsPreflight();
}
