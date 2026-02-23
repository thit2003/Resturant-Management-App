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

export async function GET() {
  try {
    const { hasPhoto, hasSalary, hasUserPhoneTable } = await getOptionalColumns();
    const photoField = hasPhoto ? 'photo' : 'NULL::text AS photo';
    const salaryField = hasSalary ? 'salary' : '0::numeric AS salary';
    const phoneField = hasUserPhoneTable
      ? `(SELECT up.phone_no FROM user_phone up WHERE up.user_id = app_user.user_id ORDER BY up.phone_no ASC LIMIT 1) AS phone`
      : 'NULL::text AS phone';

    const result = await query(
      `SELECT user_id AS id,
              name,
              email,
              role,
              dob AS date_of_birth,
              ${photoField},
              ${salaryField},
              ${phoneField}
       FROM app_user
       ORDER BY user_id ASC`,
    );

    return withCors(Response.json(result.rows));
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
    const optionalColumns = await getOptionalColumns();
    const { hasPhoto, hasSalary, hasUserPhoneTable } = optionalColumns;
    const body = await request.json();

    const {
      name,
      email,
      role = 'staff',
      date_of_birth,
      dob,
      phone = null,
      password = null,
      salary = 0,
    } = body || {};

    const resolvedDob = dob ?? date_of_birth ?? null;

    if (!name || !email || !password) {
      return withCors(
        Response.json({ error: 'Name, email, and password are required' }, { status: 400 }),
      );
    }

    const insertColumns = ['name', 'email', 'role', 'dob', 'password'];
    const insertValues = [name, email, role, resolvedDob, password];
    if (hasSalary) {
      insertColumns.push('salary');
      insertValues.push(salary);
    }

    const placeholders = insertColumns.map((_, index) => `$${index + 1}`).join(', ');

    const insertResult = await query(
      `INSERT INTO app_user (${insertColumns.join(', ')})
       VALUES (${placeholders})
       RETURNING user_id AS id`,
      insertValues,
    );

    const row = insertResult.rows[0];
    const normalizedPhone = String(phone ?? '').trim();
    if (hasUserPhoneTable && normalizedPhone) {
      await query('INSERT INTO user_phone (user_id, phone_no) VALUES ($1, $2)', [row.id, normalizedPhone]);
    }

    const fullRecord = await selectStaffById(row.id, optionalColumns);
    return withCors(Response.json(fullRecord.rows[0], { status: 201 }));
  } catch (error) {
    console.error('POST /api/staff failed', error);
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