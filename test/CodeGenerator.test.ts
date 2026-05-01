import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CCodeGenerator } from '../src/CodeGenerator.js';
import { DEFAULT_NAMES } from '../src/const.js';
import { StringWriter } from '../src/writing.js';

describe('CCodeGenerator', () => {
    it('keeps assertion macros policy-only and separates them at the call site', () => {
        const generator = new CCodeGenerator({ names: DEFAULT_NAMES });
        assert.match(generator.inits.uniqenum, /#define _UNIQA\(N,n,t,\.\.\.\)_Static_assert/);
        assert.match(StringWriter.ret(generator.uniqenum, 2), /}\w+;_UNIQA/);
    });
});
