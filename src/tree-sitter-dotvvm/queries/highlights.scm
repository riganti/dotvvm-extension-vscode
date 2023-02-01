; html stuff from https://github.com/nvim-treesitter/nvim-treesitter/blob/master/queries/html_tags/highlights.scm

(tag_name) @tag
(erroneous_end_tag_name) @error
(doctype) @constant
(attribute_name_html) @attribute
(attribute_name_js_event) @attribute
(attribute_name_property) @property
(attribute_name_attached_property) @property
(attribute_value) @string
[ (html_comment) (dotvvm_comment) ] @comment

((html_element (start_tag (tag_name) @_tag) (html_text) @text.title)
 (#match? @_tag "^(h[0-9]|title)$"))

((html_element (start_tag (tag_name) @_tag) (html_text) @text.strong)
 (#match? @_tag "^(strong|b)$"))

((html_element (start_tag (tag_name) @_tag) (html_text) @text.emphasis)
 (#match? @_tag "^(em|i)$"))

((html_element (start_tag (tag_name) @_tag) (html_text) @text.strike)
 (#match? @_tag "^(s|del)$"))

((html_element (start_tag (tag_name) @_tag) (html_text) @text.underline)
 (#eq? @_tag "u"))

((html_element (start_tag (tag_name) @_tag) (html_text) @text.literal)
 (#match? @_tag "^(code|kbd)$"))

((attribute
   (attribute_name_html) @_attr
   (attribute_value) @text.uri)
 (#match? @_attr "^(href|src)$"))

[
  "<"
  ">"
  "</"
] @punctuation.bracket

(binding_name) @keyword

(directive_name) @keyword
(directive_viewModel name: "viewModel" @keyword)
(directive_baseType name: "baseType" @keyword)
(directive_js name: "js" @keyword)
(directive_masterPage name: "masterPage" @keyword)
(directive_property name: "property" @keyword)
(directive_service name: "service" @keyword)
(directive_import name: "import" @keyword)

((cs_identifier) @keyword
 (#match? @keyword "^(void|string|object|byte|sbyte|ushort|short|char|uint|int|ulong|long|float|double|decimal|nint|nuint)$"))
(cs_lambda_expression "=>" @operator)
(dotvvm_keyword_expression) @variable.builtin
(cs_identifier) @variable
(cs_string_quote_body) @string
(cs_string_apos_body) @string
(cs_interpolated_string_expression) @string
(cs_interpolation
  "{" @punctuation.special
  "}" @punctuation.special) @embedded
[ (cs_null_literal) (cs_boolean_literal) ] @constant.builtin
(cs_await_expression "await" @keyword)
(cs_binary_expression operator: _ @operator)
(cs_assignment_expression operator: _ @operator)
(cs_prefix_unary_expression operator: _ @operator)
(cs_conditional_expression "?" @operator ":" @operator)
[ (cs_real_literal) (cs_integer_literal) ] @number

(literal_binding
  "{{" @punctuation.special
  "}}" @punctuation.special)
(attribute_binding
  "{" @punctuation.special
  "}" @punctuation.special)
