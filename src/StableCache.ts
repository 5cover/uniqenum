export class StableCache<TKey, TValue> {
    constructor(
        private readonly miss: (key: TKey) => TValue,
        private readonly maxSize = -1
    ) {}
    private readonly map = new Map<TKey, TValue>();

    get(key: TKey): TValue {
        let v = this.map.get(key);
        if (v !== undefined) return v;
        v = this.miss(key);
        if (this.maxSize < 0 || this.map.size < this.maxSize) this.map.set(key, v);
        return v;
    }
}
