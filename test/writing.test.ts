import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as r from '../src/writing.js';

describe('writing module', () => {
    it('writes simple sequence', () => {
        const wr = r.aggregateWrites(w => w('a')('b')('c'));
        assert.deepEqual(wr, ['a', 'b', 'c']);
    });
    it('writes joined sequence', () => {
        const seq = ['a', 'b', 'c'];
        const wr = r.aggregateWrites(r.join(':', seq, x => x));
        assert.deepEqual(wr, ['a', ':', 'b', ':', 'c']);
    });
});
