export interface Parser {
  parse(input: string | Input, previousTree?: Tree, options?: {bufferSize?: number, includedRanges?: Range[]}): Tree;
  getLanguage(): any;
  setLanguage(language: any): void;
  getLogger(): Logger;
  setLogger(logFunc: Logger): void;
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

export interface Input {
  seek(index: number): void;
  read(): any;
}

interface SyntaxNodeBase {
  tree: Tree;
  type: string;
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
  readonly currentNode: SyntaxNode

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
}

interface NamedNodeBase extends SyntaxNodeBase {
    isNamed: true;
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
    type: SyntaxType.ERROR;
    hasError(): true;
}

export const enum SyntaxType {
  ERROR = "ERROR",
  Attribute = "attribute",
  AttributeBinding = "attribute_binding",
  BindingName = "binding_name",
  CsArrayType = "cs_array_type",
  CsIdentifier = "cs_identifier",
  CsNamespace = "cs_namespace",
  CsNullableType = "cs_nullable_type",
  CsTupleElement = "cs_tuple_element",
  CsTupleType = "cs_tuple_type",
  CsTypeArgumentList = "cs_type_argument_list",
  CsTypeName = "cs_type_name",
  DirectiveAssemblyQualifiedName = "directive_assembly_qualified_name",
  DirectiveBaseType = "directive_baseType",
  DirectiveGeneral = "directive_general",
  DirectiveImport = "directive_import",
  DirectiveMasterPage = "directive_masterPage",
  DirectiveName = "directive_name",
  DirectiveService = "directive_service",
  DirectiveTypeAlias = "directive_type_alias",
  DirectiveViewModel = "directive_viewModel",
  Directives = "directives",
  Doctype = "doctype",
  EndTag = "end_tag",
  ErroneousEndTag = "erroneous_end_tag",
  HtmlElement = "html_element",
  Markup = "markup",
  ScriptElement = "script_element",
  SelfClosingTag = "self_closing_tag",
  SourceFile = "source_file",
  StartTag = "start_tag",
  StyleElement = "style_element",
  AttributeName = "attribute_name",
  AttributeValue = "attribute_value",
  BindingExpr = "binding_expr",
  DirectiveGeneralValue = "directive_general_value",
  DotvvmComment = "dotvvm_comment",
  ErroneousEndTagName = "erroneous_end_tag_name",
  HtmlComment = "html_comment",
  HtmlText = "html_text",
  RawText = "raw_text",
  TagName = "tag_name",
}

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

export type TypeString = `${SyntaxType}` | UnnamedType;

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
  type: SyntaxType.Attribute;
  bindingNode?: AttributeBindingNode;
  nameNode: AttributeNameNode;
  valueNode?: AttributeValueNode;
}

export interface AttributeBindingNode extends NamedNodeBase {
  type: SyntaxType.AttributeBinding;
}

export interface BindingNameNode extends NamedNodeBase {
  type: SyntaxType.BindingName;
}

export interface CsArrayTypeNode extends NamedNodeBase {
  type: SyntaxType.CsArrayType;
  rankNodes: UnnamedNode<",">[];
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface CsIdentifierNode extends NamedNodeBase {
  type: SyntaxType.CsIdentifier;
}

export interface CsNamespaceNode extends NamedNodeBase {
  type: SyntaxType.CsNamespace;
}

export interface CsNullableTypeNode extends NamedNodeBase {
  type: SyntaxType.CsNullableType;
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface CsTupleElementNode extends NamedNodeBase {
  type: SyntaxType.CsTupleElement;
  nameNode?: CsIdentifierNode;
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface CsTupleTypeNode extends NamedNodeBase {
  type: SyntaxType.CsTupleType;
}

export interface CsTypeArgumentListNode extends NamedNodeBase {
  type: SyntaxType.CsTypeArgumentList;
}

export interface CsTypeNameNode extends NamedNodeBase {
  type: SyntaxType.CsTypeName;
  namespaceNode?: CsNamespaceNode;
  type_argsNode?: CsTypeArgumentListNode;
  type_nameNode: CsIdentifierNode;
}

export interface DirectiveAssemblyQualifiedNameNode extends NamedNodeBase {
  type: SyntaxType.DirectiveAssemblyQualifiedName;
  typeNode: CsArrayTypeNode | CsNullableTypeNode | CsTupleTypeNode | CsTypeNameNode;
}

export interface DirectiveBaseTypeNode extends NamedNodeBase {
  type: SyntaxType.DirectiveBaseType;
}

export interface DirectiveGeneralNode extends NamedNodeBase {
  type: SyntaxType.DirectiveGeneral;
}

export interface DirectiveImportNode extends NamedNodeBase {
  type: SyntaxType.DirectiveImport;
}

export interface DirectiveMasterPageNode extends NamedNodeBase {
  type: SyntaxType.DirectiveMasterPage;
}

export interface DirectiveNameNode extends NamedNodeBase {
  type: SyntaxType.DirectiveName;
}

export interface DirectiveServiceNode extends NamedNodeBase {
  type: SyntaxType.DirectiveService;
}

export interface DirectiveTypeAliasNode extends NamedNodeBase {
  type: SyntaxType.DirectiveTypeAlias;
  aliasNode: CsIdentifierNode;
}

export interface DirectiveViewModelNode extends NamedNodeBase {
  type: SyntaxType.DirectiveViewModel;
}

export interface DirectivesNode extends NamedNodeBase {
  type: SyntaxType.Directives;
}

export interface DoctypeNode extends NamedNodeBase {
  type: SyntaxType.Doctype;
}

export interface EndTagNode extends NamedNodeBase {
  type: SyntaxType.EndTag;
  nameNode: TagNameNode;
}

export interface ErroneousEndTagNode extends NamedNodeBase {
  type: SyntaxType.ErroneousEndTag;
  nameNode: ErroneousEndTagNameNode;
}

export interface HtmlElementNode extends NamedNodeBase {
  type: SyntaxType.HtmlElement;
}

export interface MarkupNode extends NamedNodeBase {
  type: SyntaxType.Markup;
}

export interface ScriptElementNode extends NamedNodeBase {
  type: SyntaxType.ScriptElement;
}

export interface SelfClosingTagNode extends NamedNodeBase {
  type: SyntaxType.SelfClosingTag;
  nameNode: TagNameNode;
}

export interface SourceFileNode extends NamedNodeBase {
  type: SyntaxType.SourceFile;
}

export interface StartTagNode extends NamedNodeBase {
  type: SyntaxType.StartTag;
  nameNode?: TagNameNode;
}

export interface StyleElementNode extends NamedNodeBase {
  type: SyntaxType.StyleElement;
}

export interface AttributeNameNode extends NamedNodeBase {
  type: SyntaxType.AttributeName;
}

export interface AttributeValueNode extends NamedNodeBase {
  type: SyntaxType.AttributeValue;
}

export interface BindingExprNode extends NamedNodeBase {
  type: SyntaxType.BindingExpr;
}

export interface DirectiveGeneralValueNode extends NamedNodeBase {
  type: SyntaxType.DirectiveGeneralValue;
}

export interface DotvvmCommentNode extends NamedNodeBase {
  type: SyntaxType.DotvvmComment;
}

export interface ErroneousEndTagNameNode extends NamedNodeBase {
  type: SyntaxType.ErroneousEndTagName;
}

export interface HtmlCommentNode extends NamedNodeBase {
  type: SyntaxType.HtmlComment;
}

export interface HtmlTextNode extends NamedNodeBase {
  type: SyntaxType.HtmlText;
}

export interface RawTextNode extends NamedNodeBase {
  type: SyntaxType.RawText;
}

export interface TagNameNode extends NamedNodeBase {
  type: SyntaxType.TagName;
}

