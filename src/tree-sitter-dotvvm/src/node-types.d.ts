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
  | "binding_name"
  | "cs_array_type"
  | "cs_identifier"
  | "cs_namespace"
  | "cs_nullable_type"
  | "cs_tuple_element"
  | "cs_tuple_type"
  | "cs_type_argument_list"
  | "cs_type_name"
  | "directive_assembly_qualified_name"
  | "directive_baseType"
  | "directive_general"
  | "directive_import"
  | "directive_masterPage"
  | "directive_name"
  | "directive_service"
  | "directive_type_alias"
  | "directive_viewModel"
  | "directives"
  | "doctype"
  | "end_tag"
  | "erroneous_end_tag"
  | "html_element"
  | "markup"
  | "script_element"
  | "self_closing_tag"
  | "source_file"
  | "start_tag"
  | "style_element"
  | "attribute_name"
  | "attribute_value"
  | "binding_expr"
  | "directive_general_value"
  | "dotvvm_comment"
  | "erroneous_end_tag_name"
  | "html_comment"
  | "html_text"
  | "raw_text"
  | "tag_name"

export type UnnamedType =
  | "\n"
  | " "
  | "\""
  | "'"
  | "("
  | ")"
  | ","
  | ", "
  | "."
  | "/>"
  | ":"
  | "<"
  | "<!"
  | "</"
  | "="
  | ">"
  | "?"
  | "@"
  | "["
  | "]"
  | "baseType"
  | "command"
  | "controlCommand"
  | "controlProperty"
  | "import"
  | "js"
  | "masterPage"
  | "resource"
  | "service"
  | "staticCommand"
  | "value"
  | "viewModel"
  | "{"
  | "}"
  ;

export type TypeString = SyntaxType | UnnamedType;

export type SyntaxNode = 
  | AttributeNode
  | AttributeBindingNode
  | BindingNameNode
  | CsArrayTypeNode
  | CsIdentifierNode
  | CsNamespaceNode
  | CsNullableTypeNode
  | CsTupleElementNode
  | CsTupleTypeNode
  | CsTypeArgumentListNode
  | CsTypeNameNode
  | DirectiveAssemblyQualifiedNameNode
  | DirectiveBaseTypeNode
  | DirectiveGeneralNode
  | DirectiveImportNode
  | DirectiveMasterPageNode
  | DirectiveNameNode
  | DirectiveServiceNode
  | DirectiveTypeAliasNode
  | DirectiveViewModelNode
  | DirectivesNode
  | DoctypeNode
  | EndTagNode
  | ErroneousEndTagNode
  | HtmlElementNode
  | MarkupNode
  | ScriptElementNode
  | SelfClosingTagNode
  | SourceFileNode
  | StartTagNode
  | StyleElementNode
  | UnnamedNode<"\n">
  | UnnamedNode<" ">
  | UnnamedNode<"\"">
  | UnnamedNode<"'">
  | UnnamedNode<"(">
  | UnnamedNode<")">
  | UnnamedNode<",">
  | UnnamedNode<", ">
  | UnnamedNode<".">
  | UnnamedNode<"/>">
  | UnnamedNode<":">
  | UnnamedNode<"<">
  | UnnamedNode<"<!">
  | UnnamedNode<"</">
  | UnnamedNode<"=">
  | UnnamedNode<">">
  | UnnamedNode<"?">
  | UnnamedNode<"@">
  | UnnamedNode<"[">
  | UnnamedNode<"]">
  | AttributeNameNode
  | AttributeValueNode
  | UnnamedNode<"baseType">
  | BindingExprNode
  | UnnamedNode<"command">
  | UnnamedNode<"controlCommand">
  | UnnamedNode<"controlProperty">
  | DirectiveGeneralValueNode
  | DotvvmCommentNode
  | ErroneousEndTagNameNode
  | HtmlCommentNode
  | HtmlTextNode
  | UnnamedNode<"import">
  | UnnamedNode<"js">
  | UnnamedNode<"masterPage">
  | RawTextNode
  | UnnamedNode<"resource">
  | UnnamedNode<"service">
  | UnnamedNode<"staticCommand">
  | TagNameNode
  | UnnamedNode<"value">
  | UnnamedNode<"viewModel">
  | UnnamedNode<"{">
  | UnnamedNode<"}">
  | ErrorNode
  ;

export interface AttributeNode extends NamedNodeBase {
  type: "attribute";
  bindingNode?: AttributeBindingNode;
  nameNode: AttributeNameNode;
  valueNode?: AttributeValueNode;
}

export interface AttributeBindingNode extends NamedNodeBase<BindingExprNode | BindingNameNode> {
  type: "attribute_binding";
  firstNamedChild: BindingExprNode | BindingNameNode;
  lastNamedChild: BindingExprNode | BindingNameNode;
}

export interface BindingNameNode extends NamedNodeBase {
  type: "binding_name";
}

export interface CsArrayTypeNode extends NamedNodeBase {
  type: "cs_array_type";
  rankNodes: UnnamedNode<",">[];
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface CsIdentifierNode extends NamedNodeBase {
  type: "cs_identifier";
}

export interface CsNamespaceNode extends NamedNodeBase {
  type: "cs_namespace";
}

export interface CsNullableTypeNode extends NamedNodeBase {
  type: "cs_nullable_type";
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
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
  namespaceNode?: CsNamespaceNode;
  typeArgsNode?: CsTypeArgumentListNode;
  typeNameNode: CsIdentifierNode;
}

export interface DirectiveAssemblyQualifiedNameNode extends NamedNodeBase {
  type: "directive_assembly_qualified_name";
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface DirectiveBaseTypeNode extends NamedNodeBase<DirectiveAssemblyQualifiedNameNode> {
  type: "directive_baseType";
  firstNamedChild: DirectiveAssemblyQualifiedNameNode;
  lastNamedChild: DirectiveAssemblyQualifiedNameNode;
}

export interface DirectiveGeneralNode extends NamedNodeBase {
  type: "directive_general";
  nameNode: DirectiveNameNode;
  valueNode?: DirectiveGeneralValueNode;
}

export interface DirectiveImportNode extends NamedNodeBase<CsNamespaceNode | DirectiveTypeAliasNode> {
  type: "directive_import";
  firstNamedChild: CsNamespaceNode | DirectiveTypeAliasNode;
  lastNamedChild: CsNamespaceNode | DirectiveTypeAliasNode;
}

export interface DirectiveMasterPageNode extends NamedNodeBase {
  type: "directive_masterPage";
  valueNode: DirectiveGeneralValueNode;
}

export interface DirectiveNameNode extends NamedNodeBase {
  type: "directive_name";
}

export interface DirectiveServiceNode extends NamedNodeBase<DirectiveTypeAliasNode> {
  type: "directive_service";
  firstNamedChild: DirectiveTypeAliasNode;
  lastNamedChild: DirectiveTypeAliasNode;
}

export interface DirectiveTypeAliasNode extends NamedNodeBase<DirectiveAssemblyQualifiedNameNode> {
  type: "directive_type_alias";
  aliasNode: CsIdentifierNode;
  firstNamedChild: DirectiveAssemblyQualifiedNameNode;
  lastNamedChild: DirectiveAssemblyQualifiedNameNode;
}

export interface DirectiveViewModelNode extends NamedNodeBase<DirectiveAssemblyQualifiedNameNode> {
  type: "directive_viewModel";
  firstNamedChild: DirectiveAssemblyQualifiedNameNode;
  lastNamedChild: DirectiveAssemblyQualifiedNameNode;
}

export interface DirectivesNode extends NamedNodeBase<DirectiveBaseTypeNode | DirectiveGeneralNode | DirectiveImportNode | DirectiveMasterPageNode | DirectiveServiceNode | DirectiveViewModelNode> {
  type: "directives";
  firstNamedChild: DirectiveBaseTypeNode | DirectiveGeneralNode | DirectiveImportNode | DirectiveMasterPageNode | DirectiveServiceNode | DirectiveViewModelNode;
  lastNamedChild: DirectiveBaseTypeNode | DirectiveGeneralNode | DirectiveImportNode | DirectiveMasterPageNode | DirectiveServiceNode | DirectiveViewModelNode;
}

export interface DoctypeNode extends NamedNodeBase {
  type: "doctype";
}

export interface EndTagNode extends NamedNodeBase {
  type: "end_tag";
  nameNode: TagNameNode;
}

export interface ErroneousEndTagNode extends NamedNodeBase {
  type: "erroneous_end_tag";
  nameNode: ErroneousEndTagNameNode;
}

export interface HtmlElementNode extends NamedNodeBase<DoctypeNode | DotvvmCommentNode | EndTagNode | ErroneousEndTagNode | HtmlCommentNode | HtmlElementNode | HtmlTextNode | ScriptElementNode | SelfClosingTagNode | StartTagNode | StyleElementNode> {
  type: "html_element";
  firstNamedChild: DoctypeNode | DotvvmCommentNode | EndTagNode | ErroneousEndTagNode | HtmlCommentNode | HtmlElementNode | HtmlTextNode | ScriptElementNode | SelfClosingTagNode | StartTagNode | StyleElementNode;
  lastNamedChild: DoctypeNode | DotvvmCommentNode | EndTagNode | ErroneousEndTagNode | HtmlCommentNode | HtmlElementNode | HtmlTextNode | ScriptElementNode | SelfClosingTagNode | StartTagNode | StyleElementNode;
}

export interface MarkupNode extends NamedNodeBase<DoctypeNode | DotvvmCommentNode | ErroneousEndTagNode | HtmlCommentNode | HtmlElementNode | HtmlTextNode | ScriptElementNode | StyleElementNode> {
  type: "markup";
  firstNamedChild: DoctypeNode | DotvvmCommentNode | ErroneousEndTagNode | HtmlCommentNode | HtmlElementNode | HtmlTextNode | ScriptElementNode | StyleElementNode;
  lastNamedChild: DoctypeNode | DotvvmCommentNode | ErroneousEndTagNode | HtmlCommentNode | HtmlElementNode | HtmlTextNode | ScriptElementNode | StyleElementNode;
}

export interface ScriptElementNode extends NamedNodeBase<EndTagNode | RawTextNode | StartTagNode> {
  type: "script_element";
  firstNamedChild: EndTagNode | RawTextNode | StartTagNode;
  lastNamedChild: EndTagNode | RawTextNode | StartTagNode;
}

export interface SelfClosingTagNode extends NamedNodeBase<AttributeNode> {
  type: "self_closing_tag";
  nameNode: TagNameNode;
}

export interface SourceFileNode extends NamedNodeBase<DirectivesNode | MarkupNode> {
  type: "source_file";
}

export interface StartTagNode extends NamedNodeBase<AttributeNode | TagNameNode> {
  type: "start_tag";
  nameNode?: TagNameNode;
}

export interface StyleElementNode extends NamedNodeBase<EndTagNode | RawTextNode | StartTagNode> {
  type: "style_element";
  firstNamedChild: EndTagNode | RawTextNode | StartTagNode;
  lastNamedChild: EndTagNode | RawTextNode | StartTagNode;
}

export interface AttributeNameNode extends NamedNodeBase {
  type: "attribute_name";
}

export interface AttributeValueNode extends NamedNodeBase {
  type: "attribute_value";
}

export interface BindingExprNode extends NamedNodeBase {
  type: "binding_expr";
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

export interface HtmlTextNode extends NamedNodeBase {
  type: "html_text";
}

export interface RawTextNode extends NamedNodeBase {
  type: "raw_text";
}

export interface TagNameNode extends NamedNodeBase {
  type: "tag_name";
}

