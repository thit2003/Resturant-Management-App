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
      [['photo']],
    ),
    query(`SELECT to_regclass('public.user_phone') IS NOT NULL AS has_user_phone_table`),
  ]);

  const available = new Set(columnResult.rows.map((row) => row.column_name));
  return {
    hasPhoto: available.has('photo'),
    hasUserPhoneTable: Boolean(phoneTableResult.rows[0]?.has_user_phone_table),
  };
};

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();

    if (!email || !password) {
      return withCors(
        Response.json({ error: 'Email and password are required' }, { status: 400 }),
      );
    }

    const { hasPhoto, hasUserPhoneTable } = await getOptionalColumns();
    const photoField = hasPhoto ? 'photo' : 'NULL::text AS photo';
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
              ${phoneField}
       FROM app_user
       WHERE LOWER(email) = $1 AND password = $2
       LIMIT 1`,
      [email, password],
    );

    const user = result.rows[0];
    if (!user) {
      return withCors(Response.json({ error: 'Invalid email or password' }, { status: 401 }));
    }

    return withCors(Response.json(user));
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