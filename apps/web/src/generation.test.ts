import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { parseSync } from 'vite';
import { describe, expect, it } from 'vitest';

// Numbers in core, shown from the API (AGENTS.md, hard rule 6; ARCHITECTURE.md): the web app
// shows the snapshot, drawings and suggestions the API sends and never makes them itself. This
// fails when a source file outside tests imports a core function that generates, or calls a method
// that does. Core is parsed and each call followed through its imports, so a function that reaches
// a template's `generate` by any route is found without a list to keep. The bundle still carries
// the generation code, because the template definitions hold it; the owner chose this test over
// splitting core's exports (ARCHITECTURE.md has the measured share of the main chunk).

const root = new URL('../../..', import.meta.url).pathname;
const coreSrc = join(root, 'packages/core/src');

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === 'node_modules' || name === 'test' ? [] : files(path, pattern);
    }
    return pattern.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** A template definition's members that generate: the contract's, before any are found. */
const GENERATION = ['generate', 'drawings', 'assembly', 'steps'];

/**
 * Reads stored outputs into a plan's tables. It computes nothing new, but it is template code
 * running in the browser, so only these files may call it.
 */
const PLAN_READERS = ['apps/web/src/lib/plan.ts', 'apps/web/src/ui/Catalog.tsx'];

// The parser's tree is ESTree with TypeScript nodes; only the fields read here are typed.
interface Node {
  type: string;
  [field: string]: unknown;
}
const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';

function children(node: Node): Node[] {
  return Object.values(node).flatMap((v) =>
    Array.isArray(v) ? v.filter(isNode) : isNode(v) ? [v] : [],
  );
}

const FUNCTION = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);
const nameOf = (node: unknown) =>
  isNode(node) && node.type === 'Identifier' ? (node.name as string) : null;

/** What a name in a module stands for: a declaration there, or another module's export. */
type Binding = { file: string; name: string } | { namespace: string };

interface Module {
  /** Imported names, by local name. */
  imports: Map<string, Binding>;
  /** Exported names, by exported name. `export *` sources are listed apart. */
  exports: Map<string, Binding>;
  starExports: string[];
}

/** A function body to follow: a top-level function, or a member of an object literal. */
interface Unit {
  key: string;
  name: string;
  member: boolean;
  /** Called by name, unresolved yet. */
  calls: string[];
  /** Called as `x.name(`, with `x` when it is a plain identifier. */
  methods: { object: string | null; name: string }[];
}

function parse(file: string) {
  const result = parseSync(file, readFileSync(file, 'utf8'));
  if (result.errors.length > 0) throw new Error(`${file} does not parse`);
  return result;
}

function moduleOf(
  file: string,
  parsed: ReturnType<typeof parse>,
  resolveRequest: (r: string) => string | null,
): Module {
  const imports = new Map<string, Binding>();
  for (const entry of parsed.module.staticImports) {
    const from = resolveRequest(entry.moduleRequest.value);
    if (!from) continue;
    for (const e of entry.entries) {
      if (e.isType) continue;
      imports.set(
        e.localName.value,
        e.importName.kind === 'Name' && e.importName.name
          ? { file: from, name: e.importName.name }
          : { namespace: from },
      );
    }
  }
  const exports = new Map<string, Binding>();
  const starExports: string[] = [];
  for (const e of parsed.module.staticExports.flatMap((s) => s.entries)) {
    if (e.isType) continue;
    const from = e.moduleRequest ? resolveRequest(e.moduleRequest.value) : null;
    if (e.moduleRequest && !from) continue;
    if (e.importName.kind === 'AllButDefault' && from) starExports.push(from);
    else if (e.exportName.name && from) {
      exports.set(
        e.exportName.name,
        e.importName.kind === 'All'
          ? { namespace: from }
          : { file: from, name: e.importName.name ?? '' },
      );
    } else if (e.exportName.name && e.localName.name) {
      exports.set(e.exportName.name, { file, name: e.localName.name });
    }
  }
  return { imports, exports, starExports };
}

/** The calls in a function body, leaving out object members, which are units of their own. */
function callsIn(body: Node, unit: Unit, members: Unit[], file: string) {
  const visit = (node: Node) => {
    if (node.type === 'Property' && isNode(node.value)) {
      const name = nameOf(node.key);
      const value = node.value;
      if (name && (FUNCTION.has(value.type) || value.type === 'Identifier')) {
        members.push(memberUnit(name, value, members, file, node.start as number));
        return;
      }
    }
    if (node.type === 'MethodDefinition' && isNode(node.value)) {
      const name = nameOf(node.key);
      if (name) {
        members.push(memberUnit(name, node.value, members, file, node.start as number));
        return;
      }
    }
    if (node.type === 'CallExpression' && isNode(node.callee)) {
      const callee = node.callee;
      const name = nameOf(callee);
      if (name) unit.calls.push(name);
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const method = nameOf(callee.property);
        if (method) unit.methods.push({ object: nameOf(callee.object), name: method });
      }
    }
    for (const child of children(node)) visit(child);
  };
  visit(body);
}

function memberUnit(name: string, value: Node, members: Unit[], file: string, start: number): Unit {
  const unit: Unit = { key: `${file}:${start}`, name, member: true, calls: [], methods: [] };
  // A member set to a function by name stands for that function.
  if (value.type === 'Identifier') unit.calls.push(value.name as string);
  else callsIn(value, unit, members, file);
  return unit;
}

/** Each core file's module record and units, with top-level functions keyed `file#name`. */
function readCore() {
  const modules = new Map<string, Module>();
  const units = new Map<string, { file: string; units: Unit[] }>();
  for (const file of files(coreSrc, /\.ts$/)) {
    const parsed = parse(file);
    modules.set(
      file,
      moduleOf(file, parsed, (r) => (r.startsWith('.') ? resolve(dirname(file), r) : null)),
    );
    const found: Unit[] = [];
    for (const statement of parsed.program.body as unknown as Node[]) {
      const declaration =
        statement.type.startsWith('Export') && isNode(statement.declaration)
          ? statement.declaration
          : statement;
      const declared =
        declaration.type === 'FunctionDeclaration'
          ? [{ name: nameOf(declaration.id), body: declaration }]
          : declaration.type === 'VariableDeclaration'
            ? (declaration.declarations as Node[]).map((d) => ({
                name: nameOf(d.id),
                body: d.init,
              }))
            : [];
      for (const { name, body } of declared) {
        if (!isNode(body)) continue;
        if (name && FUNCTION.has(body.type)) {
          const unit: Unit = {
            key: `${file}#${name}`,
            name,
            member: false,
            calls: [],
            methods: [],
          };
          callsIn(body, unit, found, file);
          found.push(unit);
        } else {
          // Not a function itself, such as a template definition: only its members are followed.
          callsIn(body, { key: '', name: '', member: false, calls: [], methods: [] }, found, file);
        }
      }
      if (declaration.type === 'ClassDeclaration') {
        callsIn(
          declaration,
          { key: '', name: '', member: false, calls: [], methods: [] },
          found,
          file,
        );
      }
    }
    units.set(file, { file, units: found });
  }

  /** The declaration a name stands for, following imports and re-exports. */
  function binding(file: string, name: string): Binding {
    return modules.get(file)?.imports.get(name) ?? { file, name };
  }
  function exported(file: string, name: string, seen = new Set<string>()): Binding | null {
    if (seen.has(file)) return null;
    seen.add(file);
    const module = modules.get(file);
    if (!module) return null;
    const direct = module.exports.get(name);
    if (direct)
      return 'namespace' in direct ? direct : declarationOf(direct.file, direct.name, seen);
    for (const from of module.starExports) {
      const found = exported(from, name, seen);
      if (found) return found;
    }
    return null;
  }
  function declarationOf(file: string, name: string, seen = new Set<string>()): Binding | null {
    const b = binding(file, name);
    if ('namespace' in b) return b;
    if (b.file === file) return b;
    return exported(b.file, b.name, seen);
  }
  return { modules, units: [...units.values()], declarationOf, exported };
}

const core = readCore();
const keyOf = (b: Binding | null) => (b && !('namespace' in b) ? `${b.file}#${b.name}` : null);

/** Core's generating functions, by key, and the member names that generate. */
function generating() {
  const found = new Set<string>();
  const methods = new Set(GENERATION);
  const all = core.units.flatMap(({ file, units }) => units.map((unit) => ({ file, unit })));
  for (const { file, unit } of all) {
    const inTemplate = relative(coreSrc, file).startsWith('templates/');
    if (GENERATION.includes(unit.name) && (unit.member || inTemplate)) found.add(unit.key);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const { file, unit } of all) {
      if (found.has(unit.key)) continue;
      const reaches =
        unit.calls.some((name) => {
          const key = keyOf(core.declarationOf(file, name));
          return key !== null && found.has(key);
        }) ||
        unit.methods.some(({ object, name }) => {
          const ns = object ? core.declarationOf(file, object) : null;
          if (ns && 'namespace' in ns) {
            const key = keyOf(core.exported(ns.namespace, name));
            return key !== null && found.has(key);
          }
          return methods.has(name);
        });
      if (reaches) {
        found.add(unit.key);
        if (unit.member) methods.add(unit.name);
        grew = true;
      }
    }
  }
  return { found, methods };
}

const { found: forbidden, methods: forbiddenMethods } = generating();
const coreEntry = (request: string) =>
  request === '@kerf/core'
    ? join(coreSrc, 'index.ts')
    : request === '@kerf/core/testing'
      ? join(coreSrc, 'testing.ts')
      : null;

/** What a web source file uses that generates, in words for the failure. */
function generationIn(file: string): string[] {
  const parsed = parse(join(root, file));
  const { imports } = moduleOf(file, parsed, coreEntry);
  const uses: string[] = [];
  for (const b of imports.values()) {
    if ('namespace' in b) continue;
    const key = keyOf(core.exported(b.file, b.name));
    if (key && forbidden.has(key)) uses.push(`imports ${b.name}`);
  }
  const visit = (node: Node) => {
    if (node.type === 'MemberExpression' && !node.computed) {
      const object = nameOf(node.object);
      const property = nameOf(node.property);
      const imported = object ? imports.get(object) : undefined;
      const ns =
        imported && !('namespace' in imported)
          ? core.exported(imported.file, imported.name)
          : imported;
      if (property && ns && 'namespace' in ns) {
        const key = keyOf(core.exported(ns.namespace, property));
        if (key && forbidden.has(key)) uses.push(`uses ${object}.${property}`);
      }
    }
    if (node.type === 'CallExpression' && isNode(node.callee)) {
      const callee = node.callee;
      const method =
        callee.type === 'MemberExpression' && !callee.computed ? nameOf(callee.property) : null;
      if (method && forbiddenMethods.has(method)) uses.push(`calls .${method}(`);
      if (method === 'plan' && !PLAN_READERS.includes(file)) uses.push('calls .plan(');
    }
    for (const child of children(node)) visit(child);
  };
  visit(parsed.program as unknown as Node);
  return uses;
}

const sources = files(join(root, 'apps/web/src'), /\.tsx?$/).map((f) => relative(root, f));
/** The names of the top-level functions among some units. */
const names = (keys: Iterable<string>) => [...keys].flatMap((k) => k.split('#')[1] ?? []);

describe('generation in the web app', () => {
  it("finds core's generating functions, through imports as well as methods", () => {
    expect(names(forbidden)).toEqual(
      expect.arrayContaining([
        'createSnapshot',
        'projectDrawings',
        'stepDrawings',
        'stepDrawing',
        'planSteps',
        'progressItems',
        'progressSummary',
        // Lays bolts out by calling the swing set's imported `generate` (#420).
        'boltSuggestions',
      ]),
    );
    expect(names(forbidden)).not.toContain('formatLength');
    expect(names(forbidden)).not.toContain('suggestedValues');
    // The swing set's starting questions reach `generate` through the bolt suggestions.
    expect([...forbiddenMethods]).toEqual(expect.arrayContaining([...GENERATION, 'suggest']));
    expect(forbiddenMethods.has('plan')).toBe(false);
    expect(sources.length).toBeGreaterThan(40);
  });

  it('reads a plan only where the allowance says', () => {
    for (const file of PLAN_READERS) expect(sources).toContain(file);
  });

  it.each(sources)('%s generates nothing', (file) => {
    expect(generationIn(file), file).toEqual([]);
  });
});
