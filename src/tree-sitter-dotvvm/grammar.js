const EMPTY_ELEMENTS = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'menuitem',
    'meta',
    'param',
    'source',
    'track',
    'wbr'
];
const predefinedAttributes = [
    // this is just to make easier to use tree-sitter queries
    // maybe it also makes the parsing faster
    "style", "class", "id", "name", "for", "data-bind"
]
const PREC = {
    DOT: 18,
    INVOCATION: 18,
    POSTFIX: 18,
    PREFIX: 17,
    UNARY: 17,
    CAST: 17,
    RANGE: 16,
    SWITCH: 15,
    WITH: 14,
    MULT: 13,
    ADD: 12,
    SHIFT: 11,
    REL: 10,
    EQUAL: 9,
    AND: 8,
    XOR: 7,
    OR: 6,
    LOGAND: 5,
    LOGOR: 4,
    COALESCING: 3,
    COND: 2,
    ASSIGN: 1,
    SELECT: 0,
    SEMICOLON: -1,
};

function directiveSyntax(name, value, opt ={} ) {
    name = field('name', name)
    if (value == null) {
        return seq(
            '@',
            name
        )
    }
    value = field('value', value)
    if (opt.optional)
        value = optional(value)
    return seq(
        '@',
        name,
        value
    )
}

const decimalDigitSequence = /([0-9][0-9_]*[0-9]|[0-9])/
const csharpIdentifierFirstLetter = /[\p{L}\p{Nl}_]/
const csharpIdentifierRest = /[\p{L}\p{Nl}\p{Nd}\p{Pc}\p{Cf}\p{Mn}\p{Mc}]*/
const csharpIdentifier = new RegExp(csharpIdentifierFirstLetter.source + csharpIdentifierRest.source)

module.exports = grammar({
    name: 'dotvvm',
    conflicts: $ => [
        [ $.cs_type_name ],
        [ $.cs_type_name, $._cs_expression ],
        [ $.cs_parameter, $._cs_expression ], // lambda functions
    ],
    externals: $ => [
        $._start_tag_name,
        $._script_start_tag_name,
        $._style_start_tag_name,
        $._end_tag_name,
        $.erroneous_end_tag_name,
        '/>',
        $._implicit_end_tag,
        $.raw_text,
        $.html_comment,
        $.dotvvm_comment,
    ],

    supertypes: $ => [ $._attribute_name, $._cs_expression, $._comment, $._html_node ],
  
    rules: {
        source_file: $ => seq(prec(10,
            optional(field('directives',$.directives))),
            optional(field('markup', $.markup))),

        markup: $ => seq(
            field('content', choice(
                $.doctype,
                $.html_element,
               $._comment,
                $.script_element,
                $.style_element,
                $.erroneous_end_tag,
                $.literal_binding, 
                alias($.html_text_document_start, $.html_text)
            )),
            repeat(field('content', $._html_node))
        ),

        directives: $ => repeat1(seq(
            choice(
                field('general_directive', $.directive_general),
                field('masterPage', $.directive_masterPage),
                field('viewModel', $.directive_viewModel),
                field('baseType', $.directive_baseType),
                field('service', $.directive_service),
                field('import', $.directive_import),
                field('js', $.directive_js),
                field('property', $.directive_property),
                // $._comment
            ),
            "\n"
        )),
        directive_general: $ => directiveSyntax($.directive_name, $.directive_general_value, { optional: true }),
        directive_name: $ => csharpIdentifier,
        directive_general_value: $ => /[^\r\n]+/,
        directive_viewModel: $ => directiveSyntax("viewModel", $.directive_assembly_qualified_name),
        directive_baseType: $ => directiveSyntax("baseType", $.directive_assembly_qualified_name),
        directive_js: $ => directiveSyntax("js", $.directive_general_value),
        directive_masterPage: $ => directiveSyntax("masterPage", $.directive_general_value),
        directive_property: $ => directiveSyntax("property", $.directive_property_value),
        directive_service: $ => directiveSyntax("service", $.directive_type_alias),
        directive_import: $ => directiveSyntax("import", choice($.directive_type_alias, $.cs_namespace)),

        directive_assembly_qualified_name: $ => seq(field('type', $._cs_type), optional(seq(", ", field('assembly', /[\w0-9.]+/)))),
        directive_type_alias: $ => seq(field('alias', $.cs_identifier), "=", $.directive_assembly_qualified_name),
        directive_property_value: $ => seq(
            field('type', $.cs_type_name),
            field('name', $.cs_identifier),
            optional(seq("=", field('initializer', $._cs_expression))),
            repeat(seq(",", field('attribute', $.directive_property_attribute_assignment)))
        ),
        directive_property_attribute_assignment: $ => seq(
            field('type', $.cs_type_name),
            '.',
            field('field_name', $.cs_identifier),
            '=',
            optional(seq(field('value', $._cs_literal)))
        ),

        // HTML-like markup
        // taken from https://github.com/tree-sitter/tree-sitter-html/blob/master/grammar.js
        // Licensed under The MIT License (MIT), Copyright (c) 2014 Max Brunsfeld
        
        // // comment handling simplification - split into words or other chunks not containing `-`
        // // then the --> will be  a separate token, so it can catch is automatically
        // // so --++--> won't end the comment, but things `-- -->`, `a-->`, ... will work correctly
        // html_comment: $ => seq("<!--", repeat(/[^-]+|\S+/), "-->"), // TODO: use the external scanner?
        // server_comment: $ => seq("<%--", repeat(/[^-]+|\S+/), "--%>"),
        _comment: $ => choice($.html_comment, $.dotvvm_comment),
        _empty_element_tag_name: $ => choice(...EMPTY_ELEMENTS.map(caseInsensitive)),
        // tag_name: $ => /[\w\-_.:]+/,
        doctype: $ => seq(
            '<!',
            caseInsensitive('DOCTYPE'),
            field('doctype', /[^>]+/),
            '>'
        ),
        _html_node: $ => choice(
            $.doctype,
            $._comment,
            $.html_text,
            $.html_element,
            $.script_element,
            $.style_element,
            $.erroneous_end_tag,
            $.literal_binding
        ),
      
        html_element: $ => choice(
            seq(
                field('start', $.start_tag),
                field('content', repeat($._html_node)),
                field('end', choice($.end_tag, $._implicit_end_tag))
            ),
            // $.empty_element_tag,
            field('self_closing', $.self_closing_tag)
        ),
    
        script_element: $ => seq(
            field('start', alias($.script_start_tag, $.start_tag)),
            optional(field('content', $.raw_text)),
            field('end', $.end_tag)
        ),
    
        style_element: $ => seq(
            field('start', alias($.style_start_tag, $.start_tag)),
            optional(field('content', $.raw_text)),
            field('end', $.end_tag)
        ),
    
        start_tag: $ => seq(
            '<',
            field('name', alias($._start_tag_name, $.tag_name)),
            repeat(field('attribute', $.attribute)),
            '>'
        ),
        // empty_element_tag: $ => seq(
        //     '<',
        //     alias($._empty_element_tag_name, $.tag_name),
        //     repeat($.attribute),
        //     '>'
        // ),
    
        script_start_tag: $ => seq(
            '<',
            field('name', alias($._script_start_tag_name, $.tag_name)),
            repeat(field('attribute', $.attribute)),
            '>'
        ),
    
        style_start_tag: $ => seq(
            '<',
            field('name', alias($._style_start_tag_name, $.tag_name)),
            repeat(field('attribute', $.attribute)),
            '>'
        ),
    
        self_closing_tag: $ => seq(
            '<',
            field('name', alias($._start_tag_name, $.tag_name)),
            repeat(field('attribute', $.attribute)),
            '/>'
        ),
    
        end_tag: $ => seq(
            '</',
            field('name', alias($._end_tag_name, $.tag_name)),
            '>'
        ),
    
        erroneous_end_tag: $ => seq(
            '</',
            field('name', $.erroneous_end_tag_name),
            '>'
        ),

        _html_normal_text: $ => /[^<>{\s]([^{<>]*[^{<>\s])?/,
        _html_lonely_lt: $ => /[<>]\s/,
        _html_lonely_brace: $ => /\{[^{]/,
        html_text: $ => prec.left(-1, 
            repeat1(choice($._html_normal_text, $._html_lonely_lt, $._html_lonely_brace))
        ),
        html_text_document_start: $ =>
            repeat1(seq(
                /[^<>\s@{]|\{[^{]/,
                choice($._html_normal_text, $._html_lonely_lt, $._html_lonely_brace))
            ),
        _quoted_attribute_value: $ => choice(
            seq("'", optional(choice(field('binding', $.attribute_binding), field('value', alias(/[^'{][^']*/, $.attribute_value)))), "'"),
            seq('"', optional(choice(field('binding', $.attribute_binding), field('value', alias(/[^"{][^"]*/, $.attribute_value)))), '"')
        ),
        attribute: $ => seq(
            field('name', $._attribute_name),
            optional(seq(
              token.immediate('='),
              choice(
                field('value', $.attribute_value),
                field('binding', $.attribute_binding),
                $._quoted_attribute_value
              )
            ))
        ),
        attribute_name_js_event: $ => /on[a-zA-Z]+/,
        attribute_name_attached_property: $ => seq(
            field('class', new RegExp('\\p{Lu}' + csharpIdentifierRest.source)),
            ".",
            field('property', csharpIdentifier)
        ),
        attribute_name_property: $ => new RegExp('\\p{Lu}' + csharpIdentifierRest.source), // probably DotVVM property: starts with uppercase letter
        attribute_name_html: $ => choice(...predefinedAttributes, /[^A-Z.<>}{"'/=\s][^<>}{"'./=\s]*/), // probably html: doesn't start with uppercase letter
        _attribute_name: $ => choice($.attribute_name_js_event, $.attribute_name_property, $.attribute_name_attached_property, $.attribute_name_html),
        attribute_value: $ => /[^<>"'=\s{][^<>"'=\s]+/,
        attribute_binding: $ => seq(choice("{", "{{"), field('name', $.binding_name), ":", field('expr', optional($.binding_expr)), choice("}", "}}")),
        literal_binding: $ => prec(100, seq("{{", field('name', $.binding_name), ":", field('expr', $.binding_expr), "}}")),
        binding_name: $ => choice("value", "command", "staticCommand", "resource", "controlCommand", "controlProperty", /\w+/),
        binding_expr: $ => field('expr', $._cs_expression),

        // non-standard C# syntax
        cs_arrayinit_expression: $ => seq('[', commaSep(field('element', $._cs_expression)), ']'),
        cs_block_variable_def: $ => prec.left(seq("var", field('name', $.cs_identifier), "=", field('value', $._cs_expression))),
        cs_block_expression: $ =>
            prec.left(PREC.SEMICOLON, seq(
                repeat1(seq(
                    field('body', choice($._cs_expression, $.cs_block_variable_def)),
                    ';')),
                field('returns', $._cs_expression)
            )),
        dotvvm_keyword_expression: $ =>
            choice("_this", "_control", "_page", "_index", "_collection", "_root", "_parent", /_parent\d+/),

        // C# bindings and types
        // from https://github.com/tree-sitter/tree-sitter-c-sharp/blob/master/grammar.js
        // Licensed under The MIT License (MIT), Copyright (c) 2014 Max Brunsfeld
        cs_type_name: $ => seq(
            repeat(seq(field('name', $.cs_identifier), '.')),
            field('name', $.cs_identifier),
            optional(field('type_args', $.cs_type_argument_list))
        ),
        _cs_type: $ => choice(
            $.cs_array_type,
            $.cs_type_name,
            $.cs_nullable_type,
            $.cs_tuple_type,
        ),
        cs_array_type: $ => prec(PREC.POSTFIX, seq(
            field('type', $._cs_type),
            "[",
            field('rank', repeat(',')),
            "]"
        )),
        cs_nullable_type: $ => seq(field('type', $._cs_type), '?'),
        //   cs_pointer_type: $ => prec(PREC.POSTFIX, seq(field('type', $._cs_type), '*')),
        cs_namespace: $ => seq(repeat(seq($._identifier_token, '.')), $._identifier_token),
        cs_tuple_type: $ => seq(
            '(',
            $.cs_tuple_element,
            ',',
            commaSep1($.cs_tuple_element),
            ')'
        ),
        cs_tuple_element: $ => prec.left(seq(
            field('type', $._cs_type),
            field('name', optional($.cs_identifier))
        )),

        // Unicode categories: L = Letter, Nl Letter_Number, = Nd = Decimal_Number, Pc = Connector_Punctuation, Cf = Format, Mn = Nonspacing_Mark, Mc = Spacing_Mark
        _identifier_token: $ => token(seq(optional('@'), csharpIdentifier)),
        cs_type_argument_list: $ => seq(
            '<',
            choice(
            repeat(','),
            commaSep1($._cs_type),
            ),
            '>'
        ),

        cs_null_literal: $ => 'null',
        cs_boolean_literal: $ => choice(
            'true',
            'false'
        ),

        cs_identifier: $ => $._identifier_token,
        cs_integer_literal: $ => token(seq(
            choice(
              decimalDigitSequence, // Decimal
              (/0[xX][0-9a-fA-F_]*[0-9a-fA-F]+/), // Hex
              (/0[bB][01_]*[01]+/) // Binary
            ),
            optional(/u|U|l|L|ul|UL|uL|Ul|lu|LU|Lu|lU/)
          )),
      
        cs_real_literal: $ => {
            const suffix = /[fFdDmM]/;
            const exponent = /[eE][+-]?[0-9][0-9_]*/;
            return token(choice(
              seq(
                decimalDigitSequence,
                '.',
                decimalDigitSequence,
                optional(exponent),
                optional(suffix)
              ),
              seq(
                '.',
                decimalDigitSequence,
                optional(exponent),
                optional(suffix)
              ),
              seq(
                decimalDigitSequence,
                exponent,
                optional(suffix)
              ),
              seq(
                decimalDigitSequence,
                suffix
              )
            ))
        },
        _cs_escape_sequence: $ => token(choice(
            /\\x[0-9a-fA-F][0-9a-fA-F]?[0-9a-fA-F]?[0-9a-fA-F]?/,
            /\\u[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/,
            /\\U[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]/,
            /\\[^xuU]/,
        )),
        cs_string_quote_body: $ => repeat1(choice(
            token.immediate(prec(1, /[^"\\\n]+/)),
            $._cs_escape_sequence
        )),
        cs_string_apos_body: $ => repeat1(choice(
            token.immediate(prec(1, /[^'\\\n]+/)),
            $._cs_escape_sequence
        )),
        cs_string_literal: $ => choice(
            seq(
                '"',
                field('body', optional($.cs_string_quote_body)),
                '"'
            ),
            seq(
                "'",
                field('body', optional($.cs_string_apos_body)),
                "'"
            )
        ),
        _cs_literal: $ => choice(
            $.cs_null_literal,
            $.cs_boolean_literal,
            // Don't combine real and integer literals together
            $.cs_real_literal,
            $.cs_integer_literal,
            // Or strings and verbatim strings
            $.cs_string_literal,
            // $.verbatim_string_literal // TODO: do we support this?
        ),

        cs_binary_expression: $ => choice(
            ...[
                ['&&', PREC.LOGAND], // logical_and_expression
                ['||', PREC.LOGOR], // logical_or_expression
                ['>>', PREC.SHIFT], // right_shift_expression
                ['<<', PREC.SHIFT], // left_shift_expression
                ['&', PREC.AND],  // bitwise_and_expression
                ['^', PREC.XOR], // exclusive_or_expression
                ['|', PREC.OR], // bitwise_or_expression
                ['+', PREC.ADD], // add_expression
                ['-', PREC.ADD], // subtract_expression
                ['*', PREC.MULT], // multiply_expression
                ['/', PREC.MULT], // divide_expression
                ['%', PREC.MULT], // modulo_expression
                ['<', PREC.REL], // less_than_expression
                ['<=', PREC.REL], // less_than_or_equal_expression
                ['==', PREC.EQUAL], // equals_expression
                ['!=', PREC.EQUAL], // not_equals_expression
                ['>=', PREC.REL], // greater_than_or_equal_expression
                ['>', PREC.REL] //  greater_than_expression
            ].map(([operator, precedence]) =>
                prec.left(precedence, seq(
                    field('left', $._cs_expression),
                    field('operator', operator),
                    field('right', $._cs_expression)
                ))
            ),
            prec.right(PREC.COALESCING, seq(
                field('left', $._cs_expression),
                field('operator', '??'), // coalesce_expression
                field('right', $._cs_expression)
            ))
        ),
        cs_prefix_unary_expression: $ => prec.right(PREC.UNARY, choice(
            ...[
              '!',    
              '+',    
              '-',    
              '~'            
            ].map(operator => seq(field('operator', operator), field('expression', $._cs_expression))))),

        cs_member_access_expression: $ => prec(PREC.DOT, seq(
            field('expression', choice($._cs_expression)),
            choice('.', '?.'),// choice('.', '->'),
            field('name', $.cs_identifier)
        )),
        cs_parenthesized_expression: $ => seq('(', $._cs_expression, ')'),
        cs_assignment_expression: $ => prec.right(seq(
            field('left', $._cs_expression),
            field('operator', $._cs_assignment_operator),
            field('right', $._cs_expression)
        )),
        _cs_assignment_operator: $ => choice('=', '+=', '-=', '*=', '/=', '%=', '&=', '^=', '|=', '<<=', '>>=', '??='),
        cs_await_expression: $ => prec.right(PREC.UNARY, seq('await', $._cs_expression)),
        cs_conditional_expression: $ => prec.right(PREC.COND, seq(
            field('condition', $._cs_expression),
            '?',
            field('consequence', $._cs_expression),
            ':',
            field('alternative', $._cs_expression)
        )),
        cs_element_access_expression: $ => prec.right(PREC.UNARY, seq(
            field('expression', $._cs_expression),
            '[',
            commaSep1(field('subscript', $._cs_expression)),
            ']'
        )),
        cs_invocation_expression: $ => prec.left(PREC.INVOCATION, seq(
            field('function', $._cs_expression),
            '(',
            commaSep( field('argument', $.cs_argument)),
            ')'
        )),
        cs_argument: $ => prec(1, seq(
            optional(seq(field('name', $.cs_identifier), ':')),
            // optional(choice('ref', 'out', 'in')),
            field('expression', $._cs_expression),
        )),
        cs_interpolated_string_expression: $ => choice(
            seq('$"', repeat($._cs_interpolated_string_content), '"'),
            // seq('$@"', repeat($._interpolated_verbatim_string_content), '"'),
            // seq('@$"', repeat($._interpolated_verbatim_string_content), '"'),
        ),
        _cs_interpolated_string_content: $ => choice(
            $.cs_interpolated_string_text,
            $.cs_interpolation
        ),
        cs_interpolated_string_text: $ => choice(
            '{{',
            token.immediate(prec(1, /[^{"\\\n]+/)),
            $._cs_escape_sequence
        ),
        cs_interpolation: $ => seq(
            '{',
            field('expression', $._cs_expression),
            optional(seq(',', field('alignment_clause', $._cs_expression))),
            optional(seq(':', field('format_clause', /[^}"]+/))),
            '}'
        ),

        _cs_parameter_list: $ => seq(
            '(',
            commaSep($.cs_parameter),
            ')'
        ),

        cs_parameter: $ => seq(
            optional(field('type', $.cs_type_name)),
            field('name', $.cs_identifier)
        ),

        cs_lambda_expression: $ => prec(-1, seq(
            choice(
                field('parameters', $._cs_parameter_list),
                field('single_parameter', $.cs_identifier)
            ),
            '=>',
            field('body', $._cs_expression)
        )),


        _cs_expression: $ => choice(
            // $.anonymous_method_expression,
            // $.anonymous_object_creation_expression,
            // $.array_creation_expression,
            // $.as_expression,
            $.cs_assignment_expression,
            $.cs_await_expression,
            // $.base_expression,
            $.cs_binary_expression,
            // $.cast_expression,
            // $.checked_expression,
            $.cs_conditional_expression,
            // $.default_expression,
            $.cs_element_access_expression,
            // $.element_binding_expression,
            // $.implicit_array_creation_expression,
            // $.implicit_object_creation_expression,
            // $.implicit_stack_alloc_array_creation_expression,
            // $.initializer_expression,
            $.cs_interpolated_string_expression,
            $.cs_invocation_expression,
            // $.is_expression,
            // $.is_pattern_expression,
            $.cs_lambda_expression,
            // $.make_ref_expression,
            $.cs_member_access_expression,
            // $.object_creation_expression,
            $.cs_parenthesized_expression,
            // $.postfix_unary_expression,
            $.cs_prefix_unary_expression,
            // $.query_expression,
            // $.range_expression,
            // $.ref_expression,
            // $.ref_type_expression,
            // $.ref_value_expression,
            // $.size_of_expression,
            // $.stack_alloc_array_creation_expression,
            // $.switch_expression,
            // $.this_expression,
            // $.throw_expression,
            // $.tuple_expression,
            // $.type_of_expression,
            // $.with_expression,
      
            // $._simple_name,
            $.cs_identifier,
            $._cs_literal,
            $.cs_block_expression,
            $.dotvvm_keyword_expression,
        ),
    }
});

function commaSep(rule) {
    return optional(commaSep1(rule))
}

function commaSep1(rule) {
    return seq(
        rule,
        repeat(seq(
            ',',
            rule
        ))
    )
}

// https://github.com/tree-sitter/tree-sitter/issues/122#issuecomment-356370963
function caseInsensitive (keyword) {
    return new RegExp(keyword
      .split('')
      .map(letter => `[${letter.toLowerCase()}${letter.toUpperCase()}]`)
      .join('')
    )
}
