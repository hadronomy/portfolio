/** A byte-budgeted LRU. Keys contain digests only, never source PDFs. */
export class ByteCache<A> {
  private readonly entries = new Map<string, { value: A; bytes: number }>();
  private retained = 0;

  constructor(readonly budget: number) {}

  get bytes() {
    return this.retained;
  }

  get(key: string): A | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: A, valueBytes: number) {
    const old = this.entries.get(key);
    if (old) {
      this.retained -= old.bytes;
      this.entries.delete(key);
    }
    // Include UTF-16 keys and a conservative allowance for entry overhead.
    const bytes = valueBytes + key.length * 2 + 256;
    if (bytes > this.budget) return;
    while (this.retained + bytes > this.budget) {
      const oldest = this.entries.entries().next().value;
      if (!oldest) break;
      this.entries.delete(oldest[0]);
      this.retained -= oldest[1].bytes;
    }
    this.entries.set(key, { value, bytes });
    this.retained += bytes;
  }
}
