import { query } from '@/lib/db';
import { withCors, corsPreflight } from '@/lib/cors';

const getOptionalColumns = async () => {
  const [columnResult, phoneTableResult] = await Promise.all([
    query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'app_user'
         AND column_name = ANY($1::text[])`,
      [['photo', 'salary']],
    ),
    query(`SELECT to_regclass('public.user_phone') IS NOT NULL AS has_user_phone_table`),
  ]);

  const available = new Set(columnResult.rows.map((row) => row.column_name));
  return {
    hasPhoto: available.has('photo'),
    hasSalary: available.has('salary'),
    hasUserPhoneTable: Boolean(phoneTableResult.rows[0]?.has_user_phone_table),
  };
};

const selectStaffById = async (id, { hasPhoto, hasSalary, hasUserPhoneTable }) => {
  const photoField = hasPhoto ? 'photo' : 'NULL::text AS photo';
  const salaryField = hasSalary ? 'salary' : '0::numeric AS salary';
  const phoneField = hasUserPhoneTable
    ? `(SELECT up.phone_no FROM user_phone up WHERE up.user_id = app_user.user_id ORDER BY up.phone_no ASC LIMIT 1) AS phone`
    : 'NULL::text AS phone';

  return query(
    `SELECT user_id AS id,
            name,
            email,
            role,
            dob AS date_of_birth,
            ${photoField},
            ${salaryField},
            ${phoneField}
     FROM app_user
     WHERE user_id = $1`,
    [id],
  );
};

export async function GET(_request, { params }) {
  try {
    const id = Number(params.id);
    const optionalColumns = await getOptionalColumns();
    const result = await selectStaffById(id, optionalColumns);
    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
    }
    return withCors(Response.json(result.rows[0]));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to fetch staff' }, { status: 500 }));
  }
}

export async function PUT(request, { params }) {
  try {
    const optionalColumns = await getOptionalColumns();
    const allowedFields = ['name', 'email', 'role', 'date_of_birth', 'dob', 'password'];
    if (optionalColumns.hasSalary) allowedFields.push('salary');
    if (optionalColumns.hasPhoto) allowedFields.push('photo');

    const id = Number(params.id);
    const body = await request.json();

    const updates = [];
    const values = [];
    const shouldUpdatePhone =
      optionalColumns.hasUserPhoneTable && Object.prototype.hasOwnProperty.call(body, 'phone');

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
          updates.push('password = $' + (values.length + 1));
          values.push(normalizedPassword);
        } else if (field === 'date_of_birth' || field === 'dob') {
          updates.push('dob = $' + (values.length + 1));
          values.push(value || null);
        } else if (field === 'salary') {
          const numericSalary = Number(value);
          if (!Number.isFinite(numericSalary)) {
            return withCors(Response.json({ error: 'Invalid salary' }, { status: 400 }));
          }
          updates.push('salary = $' + (values.length + 1));
          values.push(Math.round(numericSalary));
        } else {
          updates.push(field + ' = $' + (values.length + 1));
          values.push(value);
        }
      }
    }

    if (updates.length > 0) {
      values.push(id);
      const updateResult = await query(
        `UPDATE app_user
         SET ${updates.join(', ')}
         WHERE user_id = $${values.length}
         RETURNING user_id`,
        values,
      );
      if (updateResult.rows.length === 0) {
        return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
      }
    }

    if (shouldUpdatePhone) {
      const normalizedPhone = String(body?.phone ?? '').trim();
      await query('DELETE FROM user_phone WHERE user_id = $1', [id]);
      if (normalizedPhone) {
        await query('INSERT INTO user_phone (user_id, phone_no) VALUES ($1, $2)', [id, normalizedPhone]);
      }
    }

    if (updates.length === 0 && !shouldUpdatePhone) {
      const hasRequestFields = Object.keys(body || {}).length > 0;
      if (hasRequestFields) {
        const fallback = await selectStaffById(id, optionalColumns);
        if (fallback.rows.length === 0) {
          return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
        }
        return withCors(Response.json(fallback.rows[0]));
      }
      return withCors(Response.json({ error: 'No fields to update' }, { status: 400 }));
    }

    const result = await selectStaffById(id, optionalColumns);
    if (result.rows.length === 0) {
      return withCors(Response.json({ error: 'Staff not found' }, { status: 404 }));
    }

    return withCors(Response.json(result.rows[0]));
  } catch (error) {
    return withCors(Response.json({ error: 'Failed to update staff' }, { status: 500 }));
  }
}

export async function DELETE(_request, { params }) {
  try {
    const id = Number(params.id);
    const result = await query('DELETE FROM app_user WHERE user_id = $1 RETURNING user_id', [id]);

    if (result.rows.length === 0) {
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