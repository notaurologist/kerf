// The shape of a JSON value: every path with the type found there, with array positions folded
// into `[]`. Two snapshots with the same shape have the same fields, whatever their numbers. Used
// to catch a change to what a template stores that has no snapshot upgrade (decision 0014).

function typeOf(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

export function shapeOf(value: unknown): string[] {
  const paths = new Set<string>();
  const walk = (v: unknown, path: string) => {
    paths.add(`${path}: ${typeOf(v)}`);
    if (Array.isArray(v)) {
      for (const item of v) walk(item, `${path}[]`);
    } else if (typeof v === 'object' && v !== null) {
      for (const [key, child] of Object.entries(v)) walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(JSON.parse(JSON.stringify(value)), '');
  return [...paths].sort();
}
