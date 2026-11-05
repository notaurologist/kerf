import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../../test/database.ts';

describe('the statement timeout', () => {
  it("is set on the app's role by the migrations, for every session it opens", async () => {
    const { client, close } = await createTestDatabase();
    const { rows } = await client.query<{ setconfig: string[] }>(
      `select s.setconfig from pg_db_role_setting s
         join pg_roles r on r.oid = s.setrole
        where r.rolname = current_user and s.setdatabase = 0`,
    );
    expect(rows[0]?.setconfig).toContain('statement_timeout=15s');
    await close();
  });
});
