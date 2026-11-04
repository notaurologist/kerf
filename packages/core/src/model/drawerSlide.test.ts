import { describe, expect, it } from 'vitest';
import { Citation, SOURCES } from '../design-values/sources.ts';
import { BRAND_NAMES, VERDICT_WORDS, withoutBrandExceptions } from '../testing.ts';
import {
  DRAWER_SLIDE_SOURCES,
  DrawerSlide,
  drawerBox,
  drawerSlideFields,
  drawerSlideItem,
  longestSlideWithin,
  TYPICAL_DRAWER_SLIDE,
  typicalDrawerSlideSuggestions,
} from './drawerSlide.ts';
import { formValues, type TemplateForm, visibleFields } from './form.ts';
import { needsConfirming, suggestedValues } from './questions.ts';

// The typical figures (TYPICAL_DRAWER_SLIDE): 1/2" each side, lengths 10" to 28" every 2".
const typical = DrawerSlide.parse({ sideClearance: 0.5, shortest: 10, longest: 28, step: 2 });

describe('a drawer box on side-mount slides', () => {
  it("is the opening's width less the clearance on each side", () => {
    // The workbench's example (docs/templates/workbench.md): upper openings
    // (44-3/8 − 3/4) / 2 = 21-13/16 wide, so 21-13/16 − 2 × 1/2 = 20-13/16 boxes; the lower
    // opening 44-3/8, so 43-3/8.
    const upper = drawerBox({ width: 21.8125, depth: 22.5 }, typical, 'slides');
    expect(upper).toEqual({
      status: 'sized',
      size: { width: 20.8125, depth: 22, slideLength: 22 },
    });
    const lower = drawerBox({ width: 44.375, depth: 22.5 }, typical, 'slides');
    expect(lower.status === 'sized' && lower.size.width).toBe(43.375);
  });

  it('is as deep as the longest slide sold that fits the depth', () => {
    // 10, 12, ..., 28: 22-1/2 takes 22; just under 22 takes 20; exactly 10 takes 10; 30 is past
    // the longest, which is 28.
    const depth = (d: number) => longestSlideWithin(typical as Required<DrawerSlide>, d);
    expect(depth(22.5)).toBe(22);
    expect(depth(21.9375)).toBe(20);
    expect(depth(22)).toBe(22);
    expect(depth(10)).toBe(10);
    expect(depth(30)).toBe(28);
    expect(depth(9.9375)).toBeUndefined();
  });

  it('steps from the shortest length, in any step', () => {
    // Slides sold 250 mm to 550 mm every 50 mm, entered in inches: 9.8425 to 21.6535 every
    // 1.9685. A 16" depth takes 250 + 3 × 50 = 400 mm = 15.7480", since 450 mm is 17.7165".
    const metric = { shortest: 250 / 25.4, longest: 550 / 25.4, step: 50 / 25.4 };
    expect(longestSlideWithin(metric, 16)).toBeCloseTo(400 / 25.4, 10);
    // An odd shortest: 15" to 21" every 2" gives 15, 17, 19, 21, so 20" takes 19.
    expect(longestSlideWithin({ shortest: 15, longest: 21, step: 2 }, 20)).toBe(19);
    // A longest off the steps: 10" to 27" every 2" ends at 26.
    expect(longestSlideWithin({ shortest: 10, longest: 27, step: 2 }, 40)).toBe(26);
  });

  it('takes the one length bought, with no step', () => {
    const bought = { sideClearance: 0.5, shortest: 18, longest: 18 };
    expect(drawerBox({ width: 16, depth: 20 }, bought, 'slides')).toEqual({
      status: 'sized',
      size: { width: 15, depth: 18, slideLength: 18 },
    });
    expect(drawerBox({ width: 16, depth: 17.5 }, bought, 'slides').status).toBe('refused');
  });

  it('needs every figure, with nothing defaulted', () => {
    expect(drawerBox({ width: 20, depth: 22 }, {}, 'slides')).toEqual({
      status: 'input-needed',
      missing: [
        { key: 'slides.sideClearance', label: 'Clearance each side' },
        { key: 'slides.shortest', label: 'Shortest length sold' },
        { key: 'slides.longest', label: 'Longest length sold' },
        { key: 'slides.step', label: 'Lengths sold every' },
      ],
    });
    const { sideClearance: _, ...noClearance } = typical;
    expect(drawerBox({ width: 20, depth: 22 }, noClearance, 'slides')).toEqual({
      status: 'input-needed',
      missing: [{ key: 'slides.sideClearance', label: 'Clearance each side' }],
    });
    const { step: __, ...noStep } = typical;
    expect(drawerBox({ width: 20, depth: 22 }, noStep, 'slides')).toEqual({
      status: 'input-needed',
      missing: [{ key: 'slides.step', label: 'Lengths sold every' }],
    });
  });

  it('refuses an opening too narrow or too shallow, or lengths the wrong way round', () => {
    expect(drawerBox({ width: 1, depth: 8 }, typical, 'slides')).toEqual({
      status: 'refused',
      issues: [
        {
          code: 'drawer-opening-narrow',
          message:
            'The opening is 1" wide, no wider than the slides\' clearance of 1/2" on each side.',
          params: ['slides.sideClearance'],
        },
        {
          code: 'drawer-opening-shallow',
          message: 'The opening leaves 8" for the box, shorter than the shortest slide sold, 10".',
          params: ['slides.shortest'],
        },
      ],
    });
    const backwards = { ...typical, shortest: 28, longest: 10 };
    const result = drawerBox({ width: 20, depth: 22 }, backwards, 'slides');
    expect(result.status === 'refused' && result.issues.map((i) => i.code)).toEqual([
      'slide-lengths',
    ]);
  });

  it('is listed with its length and clearance', () => {
    expect(
      drawerSlideItem({ id: 'slides-22', name: 'Drawer slides', group: 'Hardware' }, 2, 22, 0.5),
    ).toEqual({
      id: 'slides-22',
      name: 'Drawer slides',
      group: 'Hardware',
      quantity: 2,
      structural: false,
      notes: [
        'Pairs of side-mount slides 22" long, one pair for each box.',
        'Each takes 1/2" on each side of its box, so check the slides you buy say the same before building the boxes.',
      ],
    });
  });
});

describe('the slide fields', () => {
  const fields = drawerSlideFields('slides');
  const form: TemplateForm = {
    params: [{ title: 'Drawers', fields }],
    structuralInputs: [],
  };

  it('are confirmed by the owner, each saying where to read its value', () => {
    expect(fields.map((f) => f.path)).toEqual([
      'slides.sideClearance',
      'slides.shortest',
      'slides.longest',
      'slides.step',
    ]);
    for (const f of fields) {
      expect(f.confirmed, f.path).toBe(true);
      expect(f.help, f.path).toMatch(/instructions|package|list/);
    }
  });

  it('ask for the step only when more than one length is sold', () => {
    const shown = (shortest: string, longest: string) =>
      visibleFields(form.params, {
        ...formValues(form.params, {}),
        'slides.shortest': shortest,
        'slides.longest': longest,
      }).map((f) => f.path);
    expect(shown('10', '28')).toContain('slides.step');
    expect(shown('', '')).toContain('slides.step');
    expect(shown('18', '18')).not.toContain('slides.step');
  });

  it('take the typical figures as suggestions that wait for confirming', () => {
    const suggestions = typicalDrawerSlideSuggestions('slides');
    expect(suggestions.map((s) => [s.path, s.value, s.basis.kind])).toEqual([
      ['slides.sideClearance', 0.5, 'source'],
      ['slides.shortest', 10, 'source'],
      ['slides.longest', 28, 'source'],
      ['slides.step', 2, 'source'],
    ]);
    for (const s of suggestions) expect(needsConfirming(form, s), s.path).toBe(true);
    const { params, about } = suggestedValues(form, suggestions);
    expect(params).toEqual({
      'slides.sideClearance': '1/2',
      'slides.shortest': '10',
      'slides.longest': '28',
      'slides.step': '2',
    });
    expect(about.get('params slides.sideClearance')?.about).toMatch(
      /^Source: Woodcraft Magazine.*Woodsmith.*read November 4, 2026\. Typical figures until you buy slides\..*It stays a suggestion until you confirm it/,
    );
    expect(about.get('params slides.step')?.about).toMatch(/even lengths from 10" to 28"/);
  });

  it('cite sources Kerf lists', () => {
    for (const c of Object.values(DRAWER_SLIDE_SOURCES).flat()) {
      expect(Citation.parse(c).source in SOURCES).toBe(true);
    }
  });

  it('name no brands and no verdicts', () => {
    const text = JSON.stringify([
      fields,
      TYPICAL_DRAWER_SLIDE,
      SOURCES['woodcraft-drawer-slides-2014'],
      SOURCES['woodsmith-metal-drawer-slides-2019'],
      drawerSlideItem({ id: 'a', name: 'a', group: 'a' }, 1, 22, 0.5),
      drawerBox({ width: 1, depth: 8 }, typical, 'slides'),
    ]);
    expect(withoutBrandExceptions(text)).not.toMatch(BRAND_NAMES);
    expect(text).not.toMatch(VERDICT_WORDS);
  });
});
