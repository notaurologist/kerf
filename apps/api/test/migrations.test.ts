import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { TEMPLATES } from '@kerf/core';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { describe, expect, it } from 'vitest';

// Migrations run while the previous deploy still serves (decision 0014). A statement that could
// break it needs a comment saying why it does not.

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = join(here, '..', 'drizzle');
const templatesFolder = join(here, ...['..', '..', '..', 'packages', 'core', 'src', 'templates']);

const RISKY: { name: string; pattern: RegExp }[] = [
  { name: 'DROP', pattern: /\bDROP\b/i },
  { name: 'RENAME', pattern: /\bRENAME\b/i },
  { name: 'SET NOT NULL', pattern: /\bSET\s+NOT\s+NULL\b/i },
  { name: 'type change', pattern: /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i },
  {
    name: 'NOT NULL column without a default',
    pattern: /\bADD\s+COLUMN\b(?![^;]*\bDEFAULT\b)[^;]*\bNOT\s+NULL\b/i,
  },
  // These validate existing rows and constrain the previous deploy's writes.
  { name: 'CHECK constraint', pattern: /\bADD\s+CONSTRAINT\b[^;]*\bCHECK\b/i },
  { name: 'UNIQUE constraint', pattern: /\bADD\s+(?:CONSTRAINT\b[^;]*)?\bUNIQUE\b/i },
  { name: 'FOREIGN KEY', pattern: /\bADD\s+(?:CONSTRAINT\b[^;]*)?\bFOREIGN\s+KEY\b/i },
  { name: 'PRIMARY KEY', pattern: /\bADD\s+(?:CONSTRAINT\b[^;]*)?\bPRIMARY\s+KEY\b/i },
  { name: 'unique index', pattern: /\bCREATE\s+UNIQUE\s+INDEX\b/i },
];

function uncommentedRiskyStatements(migration: string): string[] {
  return migration.split('--> statement-breakpoint').flatMap((chunk) => {
    const lines = chunk.split('\n');
    const commented = lines.some((l) => l.trim().startsWith('--'));
    const statement = lines.filter((l) => !l.trim().startsWith('--')).join('\n');
    const risks = RISKY.filter((r) => r.pattern.test(statement)).map((r) => r.name);
    return risks.length > 0 && !commented ? [`${risks.join(', ')}: ${statement.trim()}`] : [];
  });
}

describe('uncommentedRiskyStatements', () => {
  it('flags each kind of statement that can break the previous deploy', () => {
    for (const statement of [
      'ALTER TABLE "t" DROP COLUMN "c";',
      'DROP TABLE "t";',
      'ALTER TABLE "t" RENAME COLUMN "a" TO "b";',
      'ALTER TABLE "t" ALTER COLUMN "c" SET NOT NULL;',
      'ALTER TABLE "t" ALTER COLUMN "c" SET DATA TYPE integer;',
      'ALTER TABLE "t" ALTER COLUMN "c" TYPE integer USING "c"::integer;',
      'ALTER TABLE "t" ADD COLUMN "c" text NOT NULL;',
      'ALTER TABLE "t" ADD CONSTRAINT "k" CHECK ("c" > 0);',
      'ALTER TABLE "t" ADD CONSTRAINT "k" UNIQUE ("c");',
      'ALTER TABLE "t" ADD UNIQUE ("c");',
      'ALTER TABLE "t" ADD CONSTRAINT "k" FOREIGN KEY ("c") REFERENCES "u"("id");',
      'ALTER TABLE "t" ADD FOREIGN KEY ("c") REFERENCES "u"("id");',
      'ALTER TABLE "t" ADD CONSTRAINT "k" PRIMARY KEY ("c");',
      'ALTER TABLE "t" ADD PRIMARY KEY ("c");',
      'CREATE UNIQUE INDEX "i" ON "t" USING btree ("c");',
    ]) {
      expect(uncommentedRiskyStatements(statement)).toHaveLength(1);
      expect(uncommentedRiskyStatements(`-- Why it is safe.\n${statement}`)).toEqual([]);
    }
  });

  it('passes statements that keep the previous deploy working', () => {
    const migration = [
      'CREATE TABLE "t" ("c" text NOT NULL);',
      'ALTER TABLE "t" ADD COLUMN "d" text;',
      `ALTER TABLE "t" ADD COLUMN "e" text DEFAULT '' NOT NULL;`,
      'CREATE INDEX "i" ON "t" ("c");',
    ].join('--> statement-breakpoint\n');
    expect(uncommentedRiskyStatements(migration)).toEqual([]);
  });

  it('wants the comment with the statement it explains, not elsewhere in the file', () => {
    const migration = '-- A note.\nCREATE TABLE "t" ();--> statement-breakpoint\nDROP TABLE "u";';
    expect(uncommentedRiskyStatements(migration)).toHaveLength(1);
  });
});

describe('committed migrations', () => {
  const files = readdirSync(migrationsFolder).filter((f) => f.endsWith('.sql'));

  it('are found', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s explains every statement that could break the previous deploy', (file) => {
    const migration = readFileSync(join(migrationsFolder, file), 'utf8');
    expect(uncommentedRiskyStatements(migration)).toEqual([]);
  });
});

/** Every committed snapshot fixture: projects as each template version stored them. */
function fixtureSnapshots(): { templateId: string; templateVersion: number }[] {
  return TEMPLATES.flatMap((template) => {
    const folder = join(templatesFolder, template.id, 'snapshots');
    return readdirSync(folder)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(join(folder, f), 'utf8')));
  });
}

/** A copy of the migrations folder whose journal stops before the last migration. */
function migrationsBeforeLast(): string {
  const folder = mkdtempSync(join(tmpdir(), 'kerf-migrations-'));
  cpSync(migrationsFolder, folder, { recursive: true });
  const journalPath = join(folder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, -1) }));
  return folder;
}

describe('the last migration', () => {
  // Drizzle's migrator applies every journal entry newer than the last one recorded, so a
  // shortened journal stands for the database the previous deploy left.
  it('applies to a database holding every stored snapshot fixture', async () => {
    const client = new PGlite();
    const db = drizzle(client);
    const previous = migrationsBeforeLast();
    try {
      await migrate(db, { migrationsFolder: previous });
      const snapshots = fixtureSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
      // Only columns every migration has had, as the previous deploy might not write the rest.
      for (const snapshot of snapshots) {
        await client.query(
          `insert into projects (name, status, template_id, template_version, snapshot)
           values ('Stored', 'planned', $1, $2, $3)`,
          [snapshot.templateId, snapshot.templateVersion, snapshot],
        );
      }

      await migrate(db, { migrationsFolder });

      const { rows } = await client.query<{ count: number }>(
        'select count(*)::int as count from projects',
      );
      expect(rows[0]?.count).toBe(snapshots.length);
    } finally {
      rmSync(previous, { recursive: true, force: true });
      await client.close();
    }
  });
});
