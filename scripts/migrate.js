import { neon } from '@neondatabase/serverless';
import 'dotenv/config'; // Make sure to load .env variables locally

async function ensureSchema(sql) {
  console.log('Running migrations...');

  // ── Users ──
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS tasks_definition (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_state (
      date        DATE PRIMARY KEY,
      checked     JSONB DEFAULT '{}',
      sub_checked JSONB DEFAULT '{}',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Add skipped column if not exists (idempotent migration)
  await sql`ALTER TABLE daily_state ADD COLUMN IF NOT EXISTS skipped JSONB DEFAULT '{}'`;

  await sql`
    CREATE TABLE IF NOT EXISTS daily_snapshots (
      date       DATE PRIMARY KEY,
      snapshot   JSONB NOT NULL DEFAULT '{}',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_snapshots_date ON daily_snapshots(date)`;

  await sql`
    CREATE TABLE IF NOT EXISTS schedule_config (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_schedule CHECK (id = 1)
    )
  `;

  // ── Finance tables ──
  await sql`
    CREATE TABLE IF NOT EXISTS finance_income (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_income CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS finance_obligations (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_obligations CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS finance_payments (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_payments CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS finance_goals (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_goals CHECK (id = 1)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS calendar_notes (
      id         INTEGER PRIMARY KEY DEFAULT 1,
      data       JSONB   NOT NULL DEFAULT '[]',
      client_id UUID DEFAULT gen_random_uuid(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT single_row_calendar_notes CHECK (id = 1)
    )
  `;

  // ── Add indexes on updated_at for time-based queries ──
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks_definition(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_state_updated_at ON daily_state(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_schedule_updated_at ON schedule_config(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_updated_at ON finance_income(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_obligations_updated_at ON finance_obligations(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_payments_updated_at ON finance_payments(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_finance_goals_updated_at ON finance_goals(updated_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_calendar_notes_updated_at ON calendar_notes(updated_at)`;

  console.log('Running Relational Schema Migrations (Phase 2)...');

  // 1. Tasks
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id BIGINT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      icon TEXT,
      title TEXT NOT NULL,
      category TEXT,
      color TEXT,
      shifts JSONB DEFAULT '[]',
      time_block TEXT,
      is_warning BOOLEAN DEFAULT false,
      recurrence TEXT,
      target_date DATE,
      alert_time TEXT,
      is_prayer_task BOOLEAN DEFAULT false,
      is_pinned BOOLEAN DEFAULT false,
      subtasks JSONB DEFAULT '[]',
      brief JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Fix existing integer column if it was created
  await sql`ALTER TABLE tasks ALTER COLUMN id TYPE BIGINT`;

  // 2. Finance: Income
  await sql`
    CREATE TABLE IF NOT EXISTS finance_incomes (
      id UUID PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      title TEXT NOT NULL,
      icon TEXT,
      amount NUMERIC NOT NULL,
      frequency TEXT,
      income_type TEXT,
      is_active BOOLEAN DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 3. Finance: Expense Categories
  await sql`
    CREATE TABLE IF NOT EXISTS finance_categories (
      id UUID PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      monthly_budget NUMERIC,
      is_custom BOOLEAN DEFAULT false,
      display_order INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 4. Finance: Expenses
  await sql`
    CREATE TABLE IF NOT EXISTS finance_expenses (
      id UUID PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      category_id UUID REFERENCES finance_categories(id),
      title TEXT NOT NULL,
      icon TEXT,
      amount NUMERIC NOT NULL,
      frequency TEXT,
      expense_type TEXT,
      is_active BOOLEAN DEFAULT true,
      due_day INTEGER,
      quarter_month INTEGER,
      total_amount NUMERIC,
      total_installments INTEGER,
      end_date DATE,
      season_month INTEGER,
      monthly_set_aside NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 5. Finance: Transactions
  await sql`
    CREATE TABLE IF NOT EXISTS finance_transactions (
      id UUID PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      expense_id UUID REFERENCES finance_expenses(id),
      category_id UUID REFERENCES finance_categories(id) NOT NULL,
      amount NUMERIC NOT NULL,
      transaction_date DATE NOT NULL,
      status TEXT,
      notes TEXT,
      currency_symbol TEXT,
      exchange_rate NUMERIC,
      original_amount NUMERIC,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 6. Finance: Goals
  await sql`
    CREATE TABLE IF NOT EXISTS finance_goals_rel (
      id UUID PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      title TEXT NOT NULL,
      icon TEXT,
      target_amount NUMERIC NOT NULL,
      current_saved NUMERIC DEFAULT 0,
      deadline DATE,
      monthly_target NUMERIC,
      is_active BOOLEAN DEFAULT true,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // 7. Calendar Notes
  await sql`
    CREATE TABLE IF NOT EXISTS calendar_notes_rel (
      id UUID PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) NOT NULL,
      note_date DATE NOT NULL,
      note_text TEXT NOT NULL,
      is_pinned BOOLEAN DEFAULT false,
      tags JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Migrations complete.');
}

async function migrateData(sql) {
  console.log('Migrating data from JSONB to Relational...');
  
  // Find first user to own the data (since previous system was functionally single-tenant overwriting row id=1)
  const users = await sql`SELECT id FROM users ORDER BY id ASC LIMIT 1`;
  if (users.length === 0) {
    console.log('No users found. Skipping data migration.');
    return;
  }
  const defaultUserId = users[0].id;

  // Migrate Tasks
  await sql`
    INSERT INTO tasks (id, user_id, icon, title, category, color, shifts, time_block, is_warning, recurrence, target_date, alert_time, is_prayer_task, is_pinned, subtasks, brief, created_at, updated_at)
    SELECT 
      (elem->>'id')::bigint as id,
      ${defaultUserId} as user_id,
      elem->>'icon' as icon,
      elem->>'title' as title,
      elem->>'category' as category,
      elem->>'color' as color,
      COALESCE(elem->'shifts', '[]'::jsonb) as shifts,
      elem->>'timeBlock' as time_block,
      COALESCE((elem->>'isWarning')::boolean, false) as is_warning,
      elem->>'recurrence' as recurrence,
      NULLIF(elem->>'date', '')::date as target_date,
      elem->>'alertTime' as alert_time,
      COALESCE((elem->>'isPrayerTask')::boolean, false) as is_prayer_task,
      COALESCE((elem->>'isPinned')::boolean, false) as is_pinned,
      COALESCE(elem->'subtasks', '[]'::jsonb) as subtasks,
      COALESCE(elem->'brief', '{}'::jsonb) as brief,
      NOW(), NOW()
    FROM tasks_definition, jsonb_array_elements(data) as elem
    WHERE tasks_definition.id = 1
    ON CONFLICT (id) DO NOTHING;
  `;

  // We skip finance_categories migration because it didn't exist in the backend
  
  // For finance_expenses, we might not have category_id correctly if categories didn't exist.
  // We'll leave category_id NULL if it fails or if finance_categories is empty. 
  // However, category_id is a foreign key, so we need to ensure the categories exist.
  // Since categories are effectively broken, the user might not have categories saved. We'll skip relations data migration for finance for now, or just provide the script commented out so it doesn't fail on FK constraints.
  console.log('Data migration completed (Tasks migrated). Finance requires categories to be synced from frontend first.');
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Cannot run migrations.');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  try {
    await ensureSchema(sql);
    await migrateData(sql);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

run();
