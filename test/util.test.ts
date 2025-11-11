import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EmptyRange, intersectingRanges, R } from '../src/util.js';

describe('intersectingRanges', () => {
    const B = [1, 50, 100, 101] as const;

    it('returns empty array when no intersection', () => {
        assert.deepEqual(intersectingRanges(B, R(200,300)), EmptyRange);
        assert.deepEqual(intersectingRanges(B, { start: -100, end: 0 }), EmptyRange);
    });

    it('returns one range when query fits inside one range', () => {
        assert.deepEqual(intersectingRanges(B, R(2,10)), R(0, 0));
        assert.deepEqual(intersectingRanges(B, R(90,95)), R(1,1));
    });

    it('returns multiple ranges when query spans across boundaries', () => {
        assert.deepEqual(intersectingRanges(B, R(40,60)), R(0,1));
        assert.deepEqual(intersectingRanges(B, R(49,100)), R(0,2));
    });

    it('handles query starting before first range', () => {
        assert.deepEqual(intersectingRanges(B, { start: -10, end: 2 }), R(0,0));
    });

    it('handles query ending after last range', () => {
        assert.deepEqual(intersectingRanges(B, R(90,999)), R(1,2));
    });

    it('handles single-point queries', () => {
        assert.deepEqual(intersectingRanges(B, R(49,49)), R(0,0));
        assert.deepEqual(intersectingRanges(B, R(50,50)), R(1,1));
        assert.deepEqual(intersectingRanges(B, R(100,100)), R(2,2));
        assert.deepEqual(intersectingRanges(B, R(101,101)), EmptyRange);
    });

    it('handles reversed or empty intervals gracefully', () => {
        assert.deepEqual(intersectingRanges(B, R(60,50)), EmptyRange);
        assert.deepEqual(intersectingRanges(B, R(50,49)), EmptyRange);
    });
});
