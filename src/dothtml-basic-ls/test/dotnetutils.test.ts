import * as assert from 'assert';
import { parseTypeName, KnownDotnetTypes } from '../src/lib/dotnetUtils';

describe('dotnet utils', () => {
    describe('#parseTypeName', () => {
        it('parses simple name with assembly', () => {
            const result = parseTypeName("DotVVM.Framework.Binding.Expressions.IValueBinding, DotVVM.Framework")
            assert.deepStrictEqual(result, {
                assembly: "DotVVM.Framework",
                fullName: "DotVVM.Framework.Binding.Expressions.IValueBinding",
                kind: "simple",
                name: "IValueBinding",
                namespace: "DotVVM.Framework.Binding.Expressions"
            });
        });
        it('parses array', () => {
            const result = parseTypeName("System.String[]")
            assert.deepStrictEqual(result, {
                kind: 'array',
                assembly: undefined,
                dimension: 1,
                elementType: {
                  kind: 'simple',
                  assembly: undefined,
                  fullName: 'System.String',
                  name: 'String',
                  namespace: 'System'
                },
                fullName: 'System.String[]',
                name: 'String[]',
                namespace: 'System'
            });
        });
        it('parses reference', () => {
            const result = parseTypeName("System.Int32&")
            assert.deepStrictEqual(result, {
                kind: 'reference',
                assembly: undefined,
                elementType: {
                  kind: 'simple',
                  assembly: undefined,
                  fullName: 'System.Int32',
                  name: 'Int32',
                  namespace: 'System'
                },
                fullName: 'System.Int32&',
                name: 'Int32&',
                namespace: 'System'
            });
        });
        it('parses nullable`1', () => {
            const result = parseTypeName("System.Nullable`1")
            assert.deepStrictEqual(result?.name, "Nullable`1");
        })
        it('parses nullable<T>', () => {
            const result = parseTypeName("System.Nullable`1[[System.Boolean, CoreLibrary]]")
            assert.deepStrictEqual(result, {
                assembly: undefined,
                fullName: 'System.Nullable`1[[System.Boolean]]',
                kind: 'generic',
                name: 'Nullable`1[[Boolean]]',
                namespace: 'System',
                typeArgs: [ {
                    assembly: 'CoreLibrary',
                    fullName: 'System.Boolean',
                    kind: 'simple',
                    name: 'Boolean',
                    namespace: 'System'
                } ]
            });
        })
        it('parses dictionary', () => {
            const result = parseTypeName("System.Collections.Generic.Dictionary`2[[System.String, CoreLibrary],[System.String, CoreLibrary]]")
            assert.deepStrictEqual(result, {
                assembly: undefined,
                fullName: 'System.Collections.Generic.Dictionary`2[[System.String],[System.String]]',
                kind: 'generic',
                name: 'Dictionary`2[[String],[String]]',
                namespace: 'System.Collections.Generic',
                typeArgs: [ {
                    assembly: 'CoreLibrary',
                    fullName: 'System.String',
                    kind: 'simple',
                    name: 'String',
                    namespace: 'System'
                },{
                    assembly: 'CoreLibrary',
                    fullName: 'System.String',
                    kind: 'simple',
                    name: 'String',
                    namespace: 'System'
                } ]
            });
        })
    })
});
