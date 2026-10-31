import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The release migrates while the previous deploy is still serving (decision 0014), so a migration
// must not remove or change anything that deploy reads or writes. Statements that can do that are
// allowed only with a comment saying why the previous deploy no longer depends on what they change.

const migrationsFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

const RISKY: { name: string; pattern: RegExp }[] = [
  { name: 'DROP', pattern: /\bDROP\b/i },
  { name: 'RENAME', pattern: /\bRENAME\b/i },
  { name: 'SET NOT NULL', pattern: /\bSET\s+NOT\s+NULL\b/i },
  { name: 'type change', pattern: /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i },
  {
    name: 'NOT NULL column without a default',
    pattern: /\bADD\s+COLUMN\b(?![^;]*\bDEFAULT\b)[^;]*\bNOT\s+NULL\b/i,
  },
];

/** Each statement that needs a comment and has none, with what makes it need one. */
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
