// A dense square matrix of doubles, enough for frames of tens of joints.

export class Matrix {
  readonly size: number;
  private readonly data: Float64Array;

  constructor(size: number) {
    this.size = size;
    this.data = new Float64Array(size * size);
  }

  static from(rows: readonly (readonly number[])[]): Matrix {
    const m = new Matrix(rows.length);
    rows.forEach((row, i) => {
      if (row.length !== rows.length) throw new Error('Matrix rows must be square.');
      row.forEach((v, j) => {
        m.set(i, j, v);
      });
    });
    return m;
  }

  get(i: number, j: number): number {
    this.check(i, j);
    return this.data[i * this.size + j] as number;
  }

  set(i: number, j: number, value: number): void {
    this.check(i, j);
    this.data[i * this.size + j] = value;
  }

  add(i: number, j: number, value: number): void {
    this.set(i, j, this.get(i, j) + value);
  }

  times(v: readonly number[]): number[] {
    if (v.length !== this.size) throw new Error('Vector length does not match the matrix.');
    return Array.from({ length: this.size }, (_, i) => {
      let sum = 0;
      for (let j = 0; j < this.size; j++) sum += this.get(i, j) * (v[j] as number);
      return sum;
    });
  }

  /** Aᵀ·this·A for a square A of the same size. */
  congruent(a: Matrix): Matrix {
    const n = this.size;
    if (a.size !== n) throw new Error('Matrix sizes do not match.');
    const ka = new Matrix(n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) sum += this.get(i, k) * a.get(k, j);
        ka.set(i, j, sum);
      }
    const out = new Matrix(n);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) sum += a.get(k, i) * ka.get(k, j);
        out.set(i, j, sum);
      }
    return out;
  }

  rows(): number[][] {
    return Array.from({ length: this.size }, (_, i) =>
      Array.from({ length: this.size }, (_, j) => this.get(i, j)),
    );
  }

  private check(i: number, j: number): void {
    const inside = (k: number) => Number.isInteger(k) && k >= 0 && k < this.size;
    if (!inside(i) || !inside(j))
      throw new Error(`Index (${i}, ${j}) is outside a ${this.size} by ${this.size} matrix.`);
  }
}
