import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeCString } from '../src/format.js';

// ------ Tests ------
describe('escapeCString', () => {
    it('handles basic named escapes and printable ASCII', () => {
        const src = String.fromCharCode(34) + String.fromCharCode(92) + 'Hello' + '\n' + '\r' + '\t';
        const got = escapeCString(src);
        // expected: \" \\ Hello \n \r \t
        assert.equal(got, '\\"\\\\Hello\\n\\r\\t');
    });

    it('uses octal for small control chars and pads when next is octal digit', () => {
        // char code 1 followed by '23' -> should pad to three octal digits: \00123
        const src = String.fromCharCode(1) + '23';
        assert.equal(escapeCString(src), '\\00123');

        // char code 1 followed by '8' -> '8' is not octal digit, minimal octal -> \18
        const src2 = String.fromCharCode(1) + '8';
        assert.equal(escapeCString(src2), '\\18');

        // char code 31 (0x1f) followed by 'A' -> octal for 31 is '37' -> not pad since 'A' not octal digit
        const src3 = String.fromCharCode(0x1f) + 'A';
        assert.equal(escapeCString(src3), '\\37A');

        // char code 0xFF (255) -> octal '377', always emits \377 then 'x'
        const src4 = String.fromCharCode(0xff) + 'x';
        assert.equal(escapeCString(src4), '\\377x');
    });

    it('splits surrogates for very large codepoints not followed by hex', () => {
        // 0x100000 followed by 'G' (not a hex digit/letter) -> separated in surrogates
        const ch = String.fromCodePoint(0x100000);
        const src = ch + 'G';
        assert.equal(escapeCString(src), '\\xdbc0\\xdc00G');
    });

    it('chooses \\u when conflict and cheaper than hex+split (e.g. 0x200 followed by hex char)', () => {
        // 0x200 has hex '200' (d=3). next is 'F' which is hex -> prefer \u0200F (6 chars)
        const src = String.fromCharCode(0x200) + 'F';
        assert.equal(escapeCString(src), '\\u0200F');
    });

    it('splits surrogates for very large codepoints followed by hex', () => {
        // codepoint with d = 6 hex digits -> 0x100000, next is 'f' (hex)
        const src = String.fromCodePoint(0x100000) + 'f';
        assert.equal(escapeCString(src), '\\xdbc0\\udc00f');
    });

    it('does not pad octal when next char not octal-digit (0-7)', () => {
        // code 5 (octal '5') followed by '9' -> '9' is not octal digit, don't pad
        const src = String.fromCharCode(5) + '9';
        assert.equal(escapeCString(src), '\\59');
    });

    it('pads octal when next char is octal-digit (0-7)', () => {
        // code 5 followed by '3' -> pad to \0053
        const src = String.fromCharCode(5) + '3';
        assert.equal(escapeCString(src), '\\0053');
    });

    it('escapes non-ascii >= 512 using hex or unicode decisions', () => {
        // char 0x200 followed by 'G' (not hex-start) -> \x200G
        let src = String.fromCharCode(0x200) + 'G';
        assert.equal(escapeCString(src), '\\x200G');

        // char 0x200 followed by 'A' (hex-start) -> choose \u
        src = String.fromCharCode(0x200) + 'A';
        assert.equal(escapeCString(src), '\\u0200A');
    });

    it('escapes BEL, backspace, vertical tab, form feed using named escapes', () => {
        const src = String.fromCharCode(7) + String.fromCharCode(8) + String.fromCharCode(11) + String.fromCharCode(12);
        assert.equal(escapeCString(src), '\\a\\b\\v\\f');
    });

    it('round-trips mixed complex example', () => {
        // Mix of tiny controls, ascii, bytes that force different branches and lookaheads
        const pieces = [
            String.fromCharCode(1), // octal, next is '2' -> will be padded
            '23', // continues
            '"', // quote
            String.fromCharCode(0x200), // needs \u0200 when followed by hex
            'F',
            String.fromCodePoint(0x100000), // large codepoint, followed by 'G' (not hex) -> \\xdbc0\\xdc00
            'G',
        ];
        const src = pieces.join('');
        const got = escapeCString(src);
        const expect = '\\00123\\"\\u0200F\\xdbc0\\xdc00G';
        assert.equal(got, expect);
    });
});
