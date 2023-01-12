export interface Parser {
  parse(input: string | Input | InputReader, oldTree?: Tree, options?: { bufferSize?: number, includedRanges?: Range[] }): Tree;
  parseTextBuffer(buffer: TextBuffer, oldTree?: Tree, options?: { syncTimeoutMicros?: number, includedRanges?: Range[] }): Tree | Promise<Tree>;
  parseTextBufferSync(buffer: TextBuffer, oldTree?: Tree, options?: { includedRanges?: Range[] }): Tree;
  getLanguage(): any;
  setLanguage(language: any): void;
  getLogger(): Logger;
  setLogger(logFunc: Logger): void;
  printDotGraphs(enabled: boolean): void;
}

export type Point = {
  row: number;
  column: number;
};

export type Range = {
  startIndex: number,
  endIndex: number,
  startPosition: Point,
  endPosition: Point
};

export type Edit = {
  startIndex: number;
  oldEndIndex: number;
  newEndIndex: number;
  startPosition: Point;
  oldEndPosition: Point;
  newEndPosition: Point;
};

export type Logger = (
  message: string,
  params: {[param: string]: string},
  type: "parse" | "lex"
) => void;

export type TextBuffer = Buffer;

export interface InputReader {
  (index: any, position: Point): string;
}

export interface Input {
  seek(index: number): void;
  read(): any;
}

interface SyntaxNodeBase {
  tree: Tree;
  type: string;
  typeId: string;
  isNamed: boolean;
  text: string;
  startPosition: Point;
  endPosition: Point;
  startIndex: number;
  endIndex: number;
  parent: SyntaxNode | null;
  children: Array<SyntaxNode>;
  namedChildren: Array<SyntaxNode>;
  childCount: number;
  namedChildCount: number;
  firstChild: SyntaxNode | null;
  firstNamedChild: SyntaxNode | null;
  lastChild: SyntaxNode | null;
  lastNamedChild: SyntaxNode | null;
  nextSibling: SyntaxNode | null;
  nextNamedSibling: SyntaxNode | null;
  previousSibling: SyntaxNode | null;
  previousNamedSibling: SyntaxNode | null;

  hasChanges(): boolean;
  hasError(): boolean;
  isMissing(): boolean;
  toString(): string;
  child(index: number): SyntaxNode | null;
  namedChild(index: number): SyntaxNode | null;
  firstChildForIndex(index: number): SyntaxNode | null;
  firstNamedChildForIndex(index: number): SyntaxNode | null;

  descendantForIndex(index: number): SyntaxNode;
  descendantForIndex(startIndex: number, endIndex: number): SyntaxNode;
  namedDescendantForIndex(index: number): SyntaxNode;
  namedDescendantForIndex(startIndex: number, endIndex: number): SyntaxNode;
  descendantForPosition(position: Point): SyntaxNode;
  descendantForPosition(startPosition: Point, endPosition: Point): SyntaxNode;
  namedDescendantForPosition(position: Point): SyntaxNode;
  namedDescendantForPosition(startPosition: Point, endPosition: Point): SyntaxNode;
  descendantsOfType<T extends TypeString>(types: T | readonly T[], startPosition?: Point, endPosition?: Point): NodeOfType<T>[];

  closest<T extends SyntaxType>(types: T | readonly T[]): NamedNode<T> | null;
  walk(): TreeCursor;
}

export interface TreeCursor {
  nodeType: string;
  nodeText: string;
  nodeIsNamed: boolean;
  startPosition: Point;
  endPosition: Point;
  startIndex: number;
  endIndex: number;
  readonly currentNode: SyntaxNode;
  readonly currentFieldName: string;

  reset(node: SyntaxNode): void
  gotoParent(): boolean;
  gotoFirstChild(): boolean;
  gotoFirstChildForIndex(index: number): boolean;
  gotoNextSibling(): boolean;
}

export interface Tree {
  readonly rootNode: SyntaxNode;

  edit(delta: Edit): Tree;
  walk(): TreeCursor;
  getChangedRanges(other: Tree): Range[];
  getEditedRange(other: Tree): Range;
  printDotGraph(): void;
}

export interface QueryMatch {
  pattern: number,
  captures: QueryCapture[],
}

export interface QueryCapture {
  name: string,
  text?: string,
  node: SyntaxNode,
  setProperties?: {[prop: string]: string | null},
  assertedProperties?: {[prop: string]: string | null},
  refutedProperties?: {[prop: string]: string | null},
}

export interface Query {
  readonly predicates: { [name: string]: Function }[];
  readonly setProperties: any[];
  readonly assertedProperties: any[];
  readonly refutedProperties: any[];

  constructor(language: any, source: string | Buffer);

  matches(rootNode: SyntaxNode, startPosition?: Point, endPosition?: Point): QueryMatch[];
  captures(rootNode: SyntaxNode, startPosition?: Point, endPosition?: Point): QueryCapture[];
}

interface NamedNodeBase<TChild extends SyntaxNode = SyntaxNode> extends SyntaxNodeBase {
    isNamed: true;
    namedChildren: TChild[];
}

/** An unnamed node with the given type string. */
export interface UnnamedNode<T extends string = string> extends SyntaxNodeBase {
  type: T;
  isNamed: false;
}

type PickNamedType<Node, T extends string> = Node extends { type: T; isNamed: true } ? Node : never;

type PickType<Node, T extends string> = Node extends { type: T } ? Node : never;

/** A named node with the given `type` string. */
export type NamedNode<T extends SyntaxType = SyntaxType> = PickNamedType<SyntaxNode, T>;

/**
 * A node with the given `type` string.
 *
 * Note that this matches both named and unnamed nodes. Use `NamedNode<T>` to pick only named nodes.
 */
export type NodeOfType<T extends string> = PickType<SyntaxNode, T>;

interface TreeCursorOfType<S extends string, T extends SyntaxNodeBase> {
  nodeType: S;
  currentNode: T;
}

type TreeCursorRecord = { [K in TypeString]: TreeCursorOfType<K, NodeOfType<K>> };

/**
 * A tree cursor whose `nodeType` correlates with `currentNode`.
 *
 * The typing becomes invalid once the underlying cursor is mutated.
 *
 * The intention is to cast a `TreeCursor` to `TypedTreeCursor` before
 * switching on `nodeType`.
 *
 * For example:
 * ```ts
 * let cursor = root.walk();
 * while (cursor.gotoNextSibling()) {
 *   const c = cursor as TypedTreeCursor;
 *   switch (c.nodeType) {
 *     case SyntaxType.Foo: {
 *       let node = c.currentNode; // Typed as FooNode.
 *       break;
 *     }
 *   }
 * }
 * ```
 */
export type TypedTreeCursor = TreeCursorRecord[keyof TreeCursorRecord];

export interface ErrorNode extends NamedNodeBase {
    type: "ERROR";
    hasError(): true;
}

export type SyntaxType = 
  | "ERROR"
  | "attribute"
  | "attribute_binding"
  | "attribute_name_attached_property"
  | "attribute_name_html"
  | "attribute_name_property"
  | "binding_expr"
  | "binding_name"
  | "cs_argument"
  | "cs_array_type"
  | "cs_assignment_expression"
  | "cs_await_expression"
  | "cs_binary_expression"
  | "cs_block_expression"
  | "cs_block_variable_def"
  | "cs_boolean_literal"
  | "cs_conditional_expression"
  | "cs_element_access_expression"
  | "cs_identifier"
  | "cs_interpolated_string_expression"
  | "cs_interpolated_string_text"
  | "cs_interpolation"
  | "cs_invocation_expression"
  | "cs_member_access_expression"
  | "cs_namespace"
  | "cs_nullable_type"
  | "cs_parenthesized_expression"
  | "cs_string_apos_body"
  | "cs_string_literal"
  | "cs_string_quote_body"
  | "cs_tuple_element"
  | "cs_tuple_type"
  | "cs_type_argument_list"
  | "cs_type_name"
  | "directive_assembly_qualified_name"
  | "directive_baseType"
  | "directive_general"
  | "directive_import"
  | "directive_js"
  | "directive_masterPage"
  | "directive_name"
  | "directive_property"
  | "directive_property_attribute_assignment"
  | "directive_property_value"
  | "directive_service"
  | "directive_type_alias"
  | "directive_viewModel"
  | "directives"
  | "doctype"
  | "dotvvm_keyword_expression"
  | "end_tag"
  | "erroneous_end_tag"
  | "html_element"
  | "html_text"
  | "literal_binding"
  | "markup"
  | "script_element"
  | "self_closing_tag"
  | "source_file"
  | "start_tag"
  | "style_element"
  | "attribute_name_js_event"
  | "attribute_value"
  | "cs_integer_literal"
  | "cs_null_literal"
  | "cs_real_literal"
  | "directive_general_value"
  | "dotvvm_comment"
  | "erroneous_end_tag_name"
  | "html_comment"
  | "raw_text"
  | "tag_name"

export type UnnamedType =
  | "\n"
  | "!="
  | "\""
  | "$\""
  | "%"
  | "%="
  | "&"
  | "&&"
  | "&="
  | "'"
  | "("
  | ")"
  | "*"
  | "*="
  | "+"
  | "+="
  | ","
  | ", "
  | "-"
  | "-="
  | "."
  | "/"
  | "/="
  | "/>"
  | ":"
  | ";"
  | "<"
  | "<!"
  | "</"
  | "<<"
  | "<<="
  | "<="
  | "="
  | "=="
  | ">"
  | ">="
  | ">>"
  | ">>="
  | "?"
  | "?."
  | "??"
  | "??="
  | "@"
  | "DOCTYPE"
  | "["
  | "]"
  | "^"
  | "^="
  | "_collection"
  | "_control"
  | "_index"
  | "_page"
  | "_parent"
  | "_root"
  | "_this"
  | "area"
  | "await"
  | "base"
  | "baseType"
  | "br"
  | "class"
  | "col"
  | "command"
  | "controlCommand"
  | "controlProperty"
  | "data-bind"
  | "embed"
  | "false"
  | "for"
  | "hr"
  | "id"
  | "img"
  | "import"
  | "input"
  | "js"
  | "keygen"
  | "link"
  | "masterPage"
  | "menuitem"
  | "meta"
  | "name"
  | "param"
  | "property"
  | "resource"
  | "service"
  | "source"
  | "staticCommand"
  | "style"
  | "track"
  | "true"
  | "value"
  | "var"
  | "viewModel"
  | "wbr"
  | "{"
  | "{{"
  | "|"
  | "|="
  | "||"
  | "}"
  | "}}"
  ;

export type TypeString = SyntaxType | UnnamedType;

export type SyntaxNode = 
  | AttributeNameNode
  | CommentNode
  | CsExpressionNode
  | HtmlNodeNode
  | AttributeNode
  | AttributeBindingNode
  | AttributeNameAttachedPropertyNode
  | AttributeNameHtmlNode
  | AttributeNamePropertyNode
  | BindingExprNode
  | BindingNameNode
  | CsArgumentNode
  | CsArrayTypeNode
  | CsAssignmentExpressionNode
  | CsAwaitExpressionNode
  | CsBinaryExpressionNode
  | CsBlockExpressionNode
  | CsBlockVariableDefNode
  | CsBooleanLiteralNode
  | CsConditionalExpressionNode
  | CsElementAccessExpressionNode
  | CsIdentifierNode
  | CsInterpolatedStringExpressionNode
  | CsInterpolatedStringTextNode
  | CsInterpolationNode
  | CsInvocationExpressionNode
  | CsMemberAccessExpressionNode
  | CsNamespaceNode
  | CsNullableTypeNode
  | CsParenthesizedExpressionNode
  | CsStringAposBodyNode
  | CsStringLiteralNode
  | CsStringQuoteBodyNode
  | CsTupleElementNode
  | CsTupleTypeNode
  | CsTypeArgumentListNode
  | CsTypeNameNode
  | DirectiveAssemblyQualifiedNameNode
  | DirectiveBaseTypeNode
  | DirectiveGeneralNode
  | DirectiveImportNode
  | DirectiveJsNode
  | DirectiveMasterPageNode
  | DirectiveNameNode
  | DirectivePropertyNode
  | DirectivePropertyAttributeAssignmentNode
  | DirectivePropertyValueNode
  | DirectiveServiceNode
  | DirectiveTypeAliasNode
  | DirectiveViewModelNode
  | DirectivesNode
  | DoctypeNode
  | DotvvmKeywordExpressionNode
  | EndTagNode
  | ErroneousEndTagNode
  | HtmlElementNode
  | HtmlTextNode
  | LiteralBindingNode
  | MarkupNode
  | ScriptElementNode
  | SelfClosingTagNode
  | SourceFileNode
  | StartTagNode
  | StyleElementNode
  | UnnamedNode<"\n">
  | UnnamedNode<"!=">
  | UnnamedNode<"\"">
  | UnnamedNode<"$\"">
  | UnnamedNode<"%">
  | UnnamedNode<"%=">
  | UnnamedNode<"&">
  | UnnamedNode<"&&">
  | UnnamedNode<"&=">
  | UnnamedNode<"'">
  | UnnamedNode<"(">
  | UnnamedNode<")">
  | UnnamedNode<"*">
  | UnnamedNode<"*=">
  | UnnamedNode<"+">
  | UnnamedNode<"+=">
  | UnnamedNode<",">
  | UnnamedNode<", ">
  | UnnamedNode<"-">
  | UnnamedNode<"-=">
  | UnnamedNode<".">
  | UnnamedNode<"/">
  | UnnamedNode<"/=">
  | UnnamedNode<"/>">
  | UnnamedNode<":">
  | UnnamedNode<";">
  | UnnamedNode<"<">
  | UnnamedNode<"<!">
  | UnnamedNode<"</">
  | UnnamedNode<"<<">
  | UnnamedNode<"<<=">
  | UnnamedNode<"<=">
  | UnnamedNode<"=">
  | UnnamedNode<"==">
  | UnnamedNode<">">
  | UnnamedNode<">=">
  | UnnamedNode<">>">
  | UnnamedNode<">>=">
  | UnnamedNode<"?">
  | UnnamedNode<"?.">
  | UnnamedNode<"??">
  | UnnamedNode<"??=">
  | UnnamedNode<"@">
  | UnnamedNode<"DOCTYPE">
  | UnnamedNode<"[">
  | UnnamedNode<"]">
  | UnnamedNode<"^">
  | UnnamedNode<"^=">
  | UnnamedNode<"_collection">
  | UnnamedNode<"_control">
  | UnnamedNode<"_index">
  | UnnamedNode<"_page">
  | UnnamedNode<"_parent">
  | UnnamedNode<"_root">
  | UnnamedNode<"_this">
  | UnnamedNode<"area">
  | AttributeNameJsEventNode
  | AttributeValueNode
  | UnnamedNode<"await">
  | UnnamedNode<"base">
  | UnnamedNode<"baseType">
  | UnnamedNode<"br">
  | UnnamedNode<"class">
  | UnnamedNode<"col">
  | UnnamedNode<"command">
  | UnnamedNode<"controlCommand">
  | UnnamedNode<"controlProperty">
  | CsIntegerLiteralNode
  | CsNullLiteralNode
  | CsRealLiteralNode
  | UnnamedNode<"data-bind">
  | DirectiveGeneralValueNode
  | DotvvmCommentNode
  | UnnamedNode<"embed">
  | ErroneousEndTagNameNode
  | UnnamedNode<"false">
  | UnnamedNode<"for">
  | UnnamedNode<"hr">
  | HtmlCommentNode
  | UnnamedNode<"id">
  | UnnamedNode<"img">
  | UnnamedNode<"import">
  | UnnamedNode<"input">
  | UnnamedNode<"js">
  | UnnamedNode<"keygen">
  | UnnamedNode<"link">
  | UnnamedNode<"masterPage">
  | UnnamedNode<"menuitem">
  | UnnamedNode<"meta">
  | UnnamedNode<"name">
  | UnnamedNode<"param">
  | UnnamedNode<"property">
  | RawTextNode
  | UnnamedNode<"resource">
  | UnnamedNode<"service">
  | UnnamedNode<"source">
  | UnnamedNode<"staticCommand">
  | UnnamedNode<"style">
  | TagNameNode
  | UnnamedNode<"track">
  | UnnamedNode<"true">
  | UnnamedNode<"value">
  | UnnamedNode<"var">
  | UnnamedNode<"viewModel">
  | UnnamedNode<"wbr">
  | UnnamedNode<"{">
  | UnnamedNode<"{{">
  | UnnamedNode<"|">
  | UnnamedNode<"|=">
  | UnnamedNode<"||">
  | UnnamedNode<"}">
  | UnnamedNode<"}}">
  | ErrorNode
  ;

export type AttributeNameNode = 
  | AttributeNameAttachedPropertyNode
  | AttributeNameHtmlNode
  | AttributeNameJsEventNode
  | AttributeNamePropertyNode
  ;

export type CommentNode = 
  | DotvvmCommentNode
  | HtmlCommentNode
  ;

export type CsExpressionNode = 
  | CsAssignmentExpressionNode
  | CsAwaitExpressionNode
  | CsBinaryExpressionNode
  | CsBlockExpressionNode
  | CsBooleanLiteralNode
  | CsConditionalExpressionNode
  | CsElementAccessExpressionNode
  | CsIdentifierNode
  | CsIntegerLiteralNode
  | CsInterpolatedStringExpressionNode
  | CsInvocationExpressionNode
  | CsMemberAccessExpressionNode
  | CsNullLiteralNode
  | CsParenthesizedExpressionNode
  | CsRealLiteralNode
  | CsStringLiteralNode
  | DotvvmKeywordExpressionNode
  ;

export type HtmlNodeNode = 
  | CommentNode
  | DoctypeNode
  | ErroneousEndTagNode
  | HtmlElementNode
  | HtmlTextNode
  | LiteralBindingNode
  | ScriptElementNode
  | StyleElementNode
  ;

export interface AttributeNode extends NamedNodeBase {
  type: "attribute";
  bindingNode?: AttributeBindingNode;
  nameNode: AttributeNameNode;
  valueNode?: AttributeValueNode;
}

export interface AttributeBindingNode extends NamedNodeBase {
  type: "attribute_binding";
  exprNode?: BindingExprNode;
  nameNode: BindingNameNode;
}

export interface AttributeNameAttachedPropertyNode extends NamedNodeBase {
  type: "attribute_name_attached_property";
}

export interface AttributeNameHtmlNode extends NamedNodeBase {
  type: "attribute_name_html";
}

export interface AttributeNamePropertyNode extends NamedNodeBase {
  type: "attribute_name_property";
}

export interface BindingExprNode extends NamedNodeBase {
  type: "binding_expr";
  exprNode: CsExpressionNode;
}

export interface BindingNameNode extends NamedNodeBase {
  type: "binding_name";
}

export interface CsArgumentNode extends NamedNodeBase {
  type: "cs_argument";
  expressionNode: CsExpressionNode;
  nameNode?: CsIdentifierNode;
}

export interface CsArrayTypeNode extends NamedNodeBase {
  type: "cs_array_type";
  rankNodes: UnnamedNode<",">[];
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface CsAssignmentExpressionNode extends NamedNodeBase {
  type: "cs_assignment_expression";
  leftNode: CsExpressionNode;
  operatorNode: UnnamedNode<"%="> | UnnamedNode<"&="> | UnnamedNode<"*="> | UnnamedNode<"+="> | UnnamedNode<"-="> | UnnamedNode<"/="> | UnnamedNode<"<<="> | UnnamedNode<"="> | UnnamedNode<">>="> | UnnamedNode<"??="> | UnnamedNode<"^="> | UnnamedNode<"|=">;
  rightNode: CsExpressionNode;
}

export interface CsAwaitExpressionNode extends NamedNodeBase<CsExpressionNode> {
  type: "cs_await_expression";
  firstNamedChild: CsExpressionNode;
  lastNamedChild: CsExpressionNode;
}

export interface CsBinaryExpressionNode extends NamedNodeBase {
  type: "cs_binary_expression";
  leftNode: CsExpressionNode;
  operatorNode: UnnamedNode<"!="> | UnnamedNode<"%"> | UnnamedNode<"&"> | UnnamedNode<"&&"> | UnnamedNode<"*"> | UnnamedNode<"+"> | UnnamedNode<"-"> | UnnamedNode<"/"> | UnnamedNode<"<"> | UnnamedNode<"<<"> | UnnamedNode<"<="> | UnnamedNode<"=="> | UnnamedNode<">"> | UnnamedNode<">="> | UnnamedNode<">>"> | UnnamedNode<"??"> | UnnamedNode<"^"> | UnnamedNode<"|"> | UnnamedNode<"||">;
  rightNode: CsExpressionNode;
}

export interface CsBlockExpressionNode extends NamedNodeBase {
  type: "cs_block_expression";
  bodyNodes: (CsExpressionNode | CsBlockVariableDefNode)[];
  returnsNode: CsExpressionNode;
}

export interface CsBlockVariableDefNode extends NamedNodeBase {
  type: "cs_block_variable_def";
  nameNode: CsIdentifierNode;
  valueNode: CsExpressionNode;
}

export interface CsBooleanLiteralNode extends NamedNodeBase {
  type: "cs_boolean_literal";
}

export interface CsConditionalExpressionNode extends NamedNodeBase {
  type: "cs_conditional_expression";
  alternativeNode: CsExpressionNode;
  conditionNode: CsExpressionNode;
  consequenceNode: CsExpressionNode;
}

export interface CsElementAccessExpressionNode extends NamedNodeBase {
  type: "cs_element_access_expression";
  expressionNode: CsExpressionNode;
  subscriptNodes: CsExpressionNode[];
}

export interface CsIdentifierNode extends NamedNodeBase {
  type: "cs_identifier";
}

export interface CsInterpolatedStringExpressionNode extends NamedNodeBase<CsInterpolatedStringTextNode | CsInterpolationNode> {
  type: "cs_interpolated_string_expression";
}

export interface CsInterpolatedStringTextNode extends NamedNodeBase {
  type: "cs_interpolated_string_text";
}

export interface CsInterpolationNode extends NamedNodeBase {
  type: "cs_interpolation";
  alignmentClauseNode?: CsExpressionNode;
  expressionNode: CsExpressionNode;
}

export interface CsInvocationExpressionNode extends NamedNodeBase {
  type: "cs_invocation_expression";
  argumentNodes: CsArgumentNode[];
  functionNode: CsExpressionNode;
}

export interface CsMemberAccessExpressionNode extends NamedNodeBase {
  type: "cs_member_access_expression";
  expressionNode: CsExpressionNode;
  nameNode: CsIdentifierNode;
}

export interface CsNamespaceNode extends NamedNodeBase {
  type: "cs_namespace";
}

export interface CsNullableTypeNode extends NamedNodeBase {
  type: "cs_nullable_type";
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface CsParenthesizedExpressionNode extends NamedNodeBase<CsExpressionNode> {
  type: "cs_parenthesized_expression";
  firstNamedChild: CsExpressionNode;
  lastNamedChild: CsExpressionNode;
}

export interface CsStringAposBodyNode extends NamedNodeBase {
  type: "cs_string_apos_body";
}

export interface CsStringLiteralNode extends NamedNodeBase {
  type: "cs_string_literal";
  bodyNode?: CsStringAposBodyNode | CsStringQuoteBodyNode;
}

export interface CsStringQuoteBodyNode extends NamedNodeBase {
  type: "cs_string_quote_body";
}

export interface CsTupleElementNode extends NamedNodeBase {
  type: "cs_tuple_element";
  nameNode?: CsIdentifierNode;
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface CsTupleTypeNode extends NamedNodeBase<CsTupleElementNode> {
  type: "cs_tuple_type";
  firstNamedChild: CsTupleElementNode;
  lastNamedChild: CsTupleElementNode;
}

export interface CsTypeArgumentListNode extends NamedNodeBase<CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode> {
  type: "cs_type_argument_list";
}

export interface CsTypeNameNode extends NamedNodeBase {
  type: "cs_type_name";
  nameNodes: CsIdentifierNode[];
  typeArgsNode?: CsTypeArgumentListNode;
}

export interface DirectiveAssemblyQualifiedNameNode extends NamedNodeBase {
  type: "directive_assembly_qualified_name";
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface DirectiveBaseTypeNode extends NamedNodeBase {
  type: "directive_baseType";
  nameNode: UnnamedNode<"baseType">;
  valueNode: DirectiveAssemblyQualifiedNameNode;
}

export interface DirectiveGeneralNode extends NamedNodeBase {
  type: "directive_general";
  nameNode: DirectiveNameNode;
  valueNode?: DirectiveGeneralValueNode;
}

export interface DirectiveImportNode extends NamedNodeBase {
  type: "directive_import";
  nameNode: UnnamedNode<"import">;
  valueNode: CsNamespaceNode | DirectiveTypeAliasNode;
}

export interface DirectiveJsNode extends NamedNodeBase {
  type: "directive_js";
  nameNode: UnnamedNode<"js">;
  valueNode: DirectiveGeneralValueNode;
}

export interface DirectiveMasterPageNode extends NamedNodeBase {
  type: "directive_masterPage";
  nameNode: UnnamedNode<"masterPage">;
  valueNode: DirectiveGeneralValueNode;
}

export interface DirectiveNameNode extends NamedNodeBase {
  type: "directive_name";
}

export interface DirectivePropertyNode extends NamedNodeBase {
  type: "directive_property";
  nameNode: UnnamedNode<"property">;
  valueNode: DirectivePropertyValueNode;
}

export interface DirectivePropertyAttributeAssignmentNode extends NamedNodeBase {
  type: "directive_property_attribute_assignment";
  fieldNameNode: CsIdentifierNode;
  typeNode: CsTypeNameNode;
  valueNode?: CsBooleanLiteralNode | CsIntegerLiteralNode | CsNullLiteralNode | CsRealLiteralNode | CsStringLiteralNode;
}

export interface DirectivePropertyValueNode extends NamedNodeBase {
  type: "directive_property_value";
  attributeNodes: DirectivePropertyAttributeAssignmentNode[];
  initializerNode?: CsExpressionNode;
  nameNode: CsIdentifierNode;
  typeNode: CsTypeNameNode;
}

export interface DirectiveServiceNode extends NamedNodeBase {
  type: "directive_service";
  nameNode: UnnamedNode<"service">;
  valueNode: DirectiveTypeAliasNode;
}

export interface DirectiveTypeAliasNode extends NamedNodeBase<DirectiveAssemblyQualifiedNameNode> {
  type: "directive_type_alias";
  aliasNode: CsIdentifierNode;
  firstNamedChild: DirectiveAssemblyQualifiedNameNode;
  lastNamedChild: DirectiveAssemblyQualifiedNameNode;
}

export interface DirectiveViewModelNode extends NamedNodeBase {
  type: "directive_viewModel";
  nameNode: UnnamedNode<"viewModel">;
  valueNode: DirectiveAssemblyQualifiedNameNode;
}

export interface DirectivesNode extends NamedNodeBase {
  type: "directives";
  baseTypeNodes: DirectiveBaseTypeNode[];
  generalDirectiveNodes: DirectiveGeneralNode[];
  importNodes: DirectiveImportNode[];
  jsNodes: DirectiveJsNode[];
  masterPageNodes: DirectiveMasterPageNode[];
  propertyNodes: DirectivePropertyNode[];
  serviceNodes: DirectiveServiceNode[];
  viewModelNodes: DirectiveViewModelNode[];
}

export interface DoctypeNode extends NamedNodeBase {
  type: "doctype";
}

export interface DotvvmKeywordExpressionNode extends NamedNodeBase {
  type: "dotvvm_keyword_expression";
}

export interface EndTagNode extends NamedNodeBase {
  type: "end_tag";
  nameNode: TagNameNode;
}

export interface ErroneousEndTagNode extends NamedNodeBase {
  type: "erroneous_end_tag";
  nameNode: ErroneousEndTagNameNode;
}

export interface HtmlElementNode extends NamedNodeBase {
  type: "html_element";
  contentNodes: HtmlNodeNode[];
  endNode?: EndTagNode;
  selfClosingNode?: SelfClosingTagNode;
  startNode?: StartTagNode;
}

export interface HtmlTextNode extends NamedNodeBase {
  type: "html_text";
}

export interface LiteralBindingNode extends NamedNodeBase {
  type: "literal_binding";
  exprNode: BindingExprNode;
  nameNode: BindingNameNode;
}

export interface MarkupNode extends NamedNodeBase {
  type: "markup";
  contentNodes: HtmlNodeNode[];
}

export interface ScriptElementNode extends NamedNodeBase {
  type: "script_element";
  contentNode?: RawTextNode;
  endNode: EndTagNode;
  startNode: StartTagNode;
}

export interface SelfClosingTagNode extends NamedNodeBase {
  type: "self_closing_tag";
  attributeNodes: AttributeNode[];
  nameNode: TagNameNode;
}

export interface SourceFileNode extends NamedNodeBase {
  type: "source_file";
  directivesNode?: DirectivesNode;
  markupNode?: MarkupNode;
}

export interface StartTagNode extends NamedNodeBase {
  type: "start_tag";
  attributeNodes: AttributeNode[];
  nameNode: TagNameNode;
}

export interface StyleElementNode extends NamedNodeBase {
  type: "style_element";
  contentNode?: RawTextNode;
  endNode: EndTagNode;
  startNode: StartTagNode;
}

export interface AttributeNameJsEventNode extends NamedNodeBase {
  type: "attribute_name_js_event";
}

export interface AttributeValueNode extends NamedNodeBase {
  type: "attribute_value";
}

export interface CsIntegerLiteralNode extends NamedNodeBase {
  type: "cs_integer_literal";
}

export interface CsNullLiteralNode extends NamedNodeBase {
  type: "cs_null_literal";
}

export interface CsRealLiteralNode extends NamedNodeBase {
  type: "cs_real_literal";
}

export interface DirectiveGeneralValueNode extends NamedNodeBase {
  type: "directive_general_value";
}

export interface DotvvmCommentNode extends NamedNodeBase {
  type: "dotvvm_comment";
}

export interface ErroneousEndTagNameNode extends NamedNodeBase {
  type: "erroneous_end_tag_name";
}

export interface HtmlCommentNode extends NamedNodeBase {
  type: "html_comment";
}

export interface RawTextNode extends NamedNodeBase {
  type: "raw_text";
}

export interface TagNameNode extends NamedNodeBase {
  type: "tag_name";
}

