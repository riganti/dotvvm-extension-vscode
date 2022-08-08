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

module.exports = grammar({
    name: 'dotvvm',
    conflicts: $ => [
        [ $.cs_type_name ]
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
  
    rules: {
        source_file: $ => seq(prec(10, optional($.directives)), optional($.markup)),

        markup: $ => seq(
            field('content', choice(
                $.doctype,
                $.html_element,
                $._comment,
                $.script_element,
                $.style_element,
                $.erroneous_end_tag,    
                alias($.html_text_document_start, $.html_text)
            )),
            repeat(field('content', $._node))
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
        directive_name: $ => $._identifier_token,
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
            optional(seq("=", field('initializer', $.cs_expr))),
            repeat(seq(",", field('attribute', $.directive_property_attribute_assignment)))
        ),
        directive_property_attribute_assignment: $ => seq(
            field('type', $.cs_type_name),
            '.',
            field('field_name', $.cs_identifier),
            '=',
            optional(seq(field('value', $.cs_literal)))
        ),

        // TODO:
        cs_literal: $ => $.cs_literal_number,
        cs_literal_number: $ => /\d+([uU]?[lL]?|[mMdDfF])?/,
        cs_expr: $ => choice($.cs_identifier, $.cs_literal, $.cs_expr_array_initializer),
        cs_expr_array_initializer: $ => seq('[', commaSep(field('element', $.cs_expr)), ']'),

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
        _node: $ => choice(
            $.doctype,
            $._comment,
            $.html_text,
            $.html_element,
            $.script_element,
            $.style_element,
            $.erroneous_end_tag
        ),
      
        html_element: $ => choice(
            seq(
                field('start', $.start_tag),
                field('content', repeat($._node)),
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

        html_text: $ => /[^<>\s]([^<>]*[^<>\s])?/,
        html_text_document_start: $ => /[^<>\s@]([^<>]*[^<>\s])?/,
        _quoted_attribute_value: $ => choice(
            seq("'", optional(choice(field('binding', $.attribute_binding), field('value', alias(/[^']+/, $.attribute_value)))), "'"),
            seq('"', optional(choice(field('binding', $.attribute_binding), field('value', alias(/[^"]+/, $.attribute_value)))), '"')
        ),
        attribute: $ => seq(
            field('name', $.attribute_name),
            optional(seq(
              '=',
              choice(
                field('value', $.attribute_value),
                field('binding', $.attribute_binding),
                $._quoted_attribute_value
              )
            ))
          ),
        attribute_name: $ => /[^<>"'/=\s]+/,
        attribute_value: $ => /[^<>"'=\s]+/,
        attribute_binding: $ => seq("{", field('name', $.binding_name), ":", field('expr', $.binding_expr), "}"),
        binding_name: $ => choice("value", "command", "staticCommand", "resource", "controlCommand", "controlProperty", /\w+/),
        binding_expr: $ => /.*/, // TODO: expressions

        // C# bindings and types
        // some stuff is from https://github.com/tree-sitter/tree-sitter-c-sharp/blob/master/grammar.js
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
        _identifier_token: $ => token(seq(optional('@'), /[\p{L}\p{Nl}_][\p{L}\p{Nl}\p{Nd}\p{Pc}\p{Cf}\p{Mn}\p{Mc}]*/)),
        cs_type_argument_list: $ => seq(
            '<',
            choice(
            repeat(','),
            commaSep1($._cs_type),
            ),
            '>'
        ),

        cs_identifier: $ => $._identifier_token,

        space: $ => /\s+/,
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
