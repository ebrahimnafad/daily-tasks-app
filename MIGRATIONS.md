# Database Migration Policy

This project uses [Drizzle ORM](https://orm.drizzle.team/) for schema management.

## 1. Automated Deployments (Vercel)

On every deployment to Vercel, the `npm run migrate` script is executed (configured via `vercel.json` and `package.json`).
This script runs `npx drizzle-kit migrate`, which sequentially applies any pending `.sql` migration files located in the `drizzle/` directory.

Because `migrate` relies on strictly-ordered `.sql` files, it provides a safe, idempotent audit trail and will **never** silently truncate tables or drop columns unprompted (unlike `drizzle-kit push`).

## 2. Generating Migrations

Whenever you modify `src/db/schema.ts`, you **must** generate a new migration file:

```bash
npx drizzle-kit generate
```

This will create a new `.sql` file in the `drizzle/` directory.

## 3. The "Additive-Only" Rule

To ensure zero-downtime deployments and safe rollbacks, **all automated migrations should be additive-only**:

- Add new tables.
- Add new columns (ensure they have a `DEFAULT` or are nullable so existing rows don't break).
- Add indices.

If you commit an additive migration, Vercel will safely apply it on deploy.

## 4. Destructive Changes

For destructive changes (e.g., dropping a column, changing a column type, altering an enum):

1. Write the code changes and generate the `.sql` migration file.
2. Review the generated `.sql` file carefully. Drizzle may sometimes incorrectly attempt to drop/recreate tables if it cannot handle the type change natively.
3. **Run the migration manually** against the production database _before_ merging the code (or use a blue/green deployment strategy).
   ```bash
   npm run migrate
   ```
4. Only merge the code once the database has been successfully updated.
