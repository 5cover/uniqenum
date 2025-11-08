import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/g.js';


describe('generators module', () => {
    it('generates combinations', () => {
        const c = Array.from(g.combinations(3));
        assert.deepEqual(c, [
            [0, 1],
            [0, 2],
            [1, 2],
        ]);
    });
});

