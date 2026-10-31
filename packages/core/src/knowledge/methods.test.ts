import { describe, expect, it } from 'vitest';
import { TEMPLATES } from '../templates/index.ts';
import type { Operation, OperationType } from '../templates/operations.ts';
import { VERDICT_WORDS } from '../testing.ts';
import { EXPERT_CHECK_CATEGORIES, ExpertCheckCategory, FLAG_CATEGORY_IDS } from './categories.ts';
import {
  fillMethodText,
  METHOD_VALUES,
  METHODS,
  Method,
  methodsFor,
  methodsUsing,
  placeholders,
} from './methods.ts';
import { findSkill, SKILLS, Skill } from './skills.ts';
import { findToolType } from './tools.ts';

const methods = METHODS.map((m) => Method.parse(m));
// METHOD_VALUES's type requires a key for every operation type.
const TYPES = Object.keys(METHOD_VALUES) as OperationType[];

function texts(m: Method): string[] {
  return [
    m.name,
    ...m.tools.map((t) => t.use),
    ...m.setup,
    ...m.technique,
    ...m.mistakes,
    ...m.safety.map((s) => s.text),
    ...m.flags.flatMap((f) => [f.ask, f.why]),
  ];
}

describe('methods', () => {
  it('parses every entry, with unique IDs', () => {
    for (const m of METHODS) expect(Method.safeParse(m).error, m.id).toBeUndefined();
    expect(new Set(methods.map((m) => m.id)).size).toBe(methods.length);
  });

  it('has at least two methods for every operation type, grouped by type', () => {
    for (const type of TYPES) expect(methodsFor(type).length, type).toBeGreaterThanOrEqual(2);
    const runs = methods.map((m) => m.operation).filter((t, i, all) => all[i - 1] !== t);
    expect(new Set(runs).size).toBe(runs.length);
  });

  it('names library tools, and capabilities that belong to them and cover a value of the same kind', () => {
    for (const m of methods) {
      const values = METHOD_VALUES[m.operation] as Record<string, { kind: string }>;
      for (const choice of m.tools.flatMap((t) => t.anyOf)) {
        const tool = findToolType(choice.tool);
        expect(tool, `${m.id}: ${choice.tool}`).toBeDefined();
        for (const need of choice.needs) {
          const field = tool?.capabilities.find((c) => c.id === need.capability);
          const where = `${m.id}: ${choice.tool}.${need.capability} >= ${need.atLeast}`;
          expect(field, where).toBeDefined();
          expect(values[need.atLeast]?.kind, where).toBe(field?.kind);
          if (need.passes === 2) expect(field?.kind, where).toBe('length');
        }
      }
    }
  });

  it('uses skills from the list, and every skill is used', () => {
    for (const m of methods)
      for (const s of m.skills) expect(findSkill(s), `${m.id}: ${s}`).toBeDefined();
    const used = new Set(methods.flatMap((m) => m.skills));
    expect(SKILLS.map((s) => s.id).filter((id) => !used.has(id))).toEqual([]);
  });

  it('compares each method only with others for the same operation, one way', () => {
    for (const m of methods) {
      for (const [list, other] of [
        [m.easierThan, 'easierThan'],
        [m.moreAccurateThan, 'moreAccurateThan'],
      ] as const) {
        for (const id of list) {
          const them = methods.find((x) => x.id === id);
          expect(them?.operation, `${m.id} ${other} ${id}`).toBe(m.operation);
          expect(them?.[other], `${id} ${other} ${m.id} too`).not.toContain(m.id);
        }
      }
    }
  });

  it('names only values its operation type has, in every piece of text', () => {
    for (const m of methods) {
      const values = METHOD_VALUES[m.operation];
      for (const text of texts(m)) {
        for (const name of placeholders(text))
          expect(values, `${m.id}: {${name}}`).toHaveProperty(name);
      }
    }
  });

  it('cites a source for every safety note', () => {
    for (const m of methods)
      for (const s of m.safety) expect(s.sources.length, m.id).toBeGreaterThan(0);
  });

  // docs/design/content.md, Word list.
  it('uses none of the words the content guide rules out', () => {
    const never = /\b(simply|just|easy|obviously|please|warning|danger|caution|default)\b/i;
    for (const m of methods) {
      for (const text of texts(m)) {
        expect(text, m.id).not.toMatch(never);
        expect(text, m.id).not.toMatch(VERDICT_WORDS);
      }
    }
  });

  // The angled line's short point, from the long point: width · tan(setting). Hand check for a
  // 3-1/2" face at 20°: 3.5 · 0.36397 = 1.274, which is 1-1/4" to the sixteenth (20.38/16).
  // A 5-1/2" face: 5.5 · 0.36397 = 2.002, which is 2".
  it('fills the offset for an angled line, rounded only for display', () => {
    const miter: Operation = {
      id: 'part/end-0',
      type: 'miter',
      partId: 'part',
      count: 2,
      end: 0,
      setting: 20,
      width: 3.5,
      thickness: 3.5,
    };
    expect(METHOD_VALUES.miter.offset?.of(miter)).toBeCloseTo(1.274, 3);
    expect(fillMethodText('measure {offset}', miter)).toBe('measure 1-1/4"');
    expect(fillMethodText('measure {offset}', { ...miter, width: 5.5 })).toBe('measure 2"');
    expect(fillMethodText('Set the saw to {setting}. Cut {count}.', miter)).toBe(
      'Set the saw to 20.0°. Cut 2.',
    );
    expect(() => fillMethodText('{depth}', miter)).toThrow('miter has no value {depth}');
  });

  it("fills every method's text for every operation the templates' worked examples produce", () => {
    for (const template of TEMPLATES) {
      for (const example of template.examples) {
        const result = template.generate(example.params, example.structuralInputs);
        if (!result.ok) throw new Error(`${template.id} example does not generate`);
        const ops = template.plan(result.output).operations ?? [];
        expect(ops.length, template.id).toBeGreaterThan(0);
        for (const op of ops) {
          for (const m of methodsFor(op.type)) {
            for (const text of texts(m)) expect(fillMethodText(text, op)).not.toMatch(/[{}]/);
          }
        }
      }
    }
  });
});

describe('skills', () => {
  it('parses every entry, with unique IDs and names', () => {
    for (const s of SKILLS) expect(Skill.safeParse(s).error, s.id).toBeUndefined();
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    expect(new Set(SKILLS.map((s) => s.name)).size).toBe(SKILLS.length);
  });
});

describe('expert-check categories', () => {
  it('parses every entry, one for each category, in order', () => {
    for (const c of EXPERT_CHECK_CATEGORIES) {
      expect(ExpertCheckCategory.safeParse(c).error, c.id).toBeUndefined();
    }
    expect(EXPERT_CHECK_CATEGORIES.map((c) => c.id)).toEqual([...FLAG_CATEGORY_IDS]);
  });

  // Load-bearing design points at Kerf's own structural checks and checklist, which carry their
  // sources; every other category describes a hazard and cites where it is described.
  it('cites a source for every category but load-bearing design', () => {
    expect(EXPERT_CHECK_CATEGORIES.filter((c) => c.sources.length === 0).map((c) => c.id)).toEqual([
      'load-bearing',
    ]);
  });
});

describe('methodsUsing', () => {
  it('lists each method that can use a tool, with what the tool does there', () => {
    const uses = methodsUsing('miter-saw');
    expect(uses.map((u) => [u.method.operation, u.method.name])).toEqual([
      ['crosscut', 'With a miter saw'],
      ['miter', 'With a miter saw'],
    ]);
    expect(uses[0]?.use).toBe('cutting');
    // A tool that can stand in for another in a requirement counts too.
    expect(methodsUsing('rafter-square').length).toBe(methodsUsing('combination-square').length);
  });

  it('lists none for a tool no method uses', () => {
    expect(methodsUsing('table-saw')).toEqual([]);
  });
});
