import type { SourceRange } from "../ast.js";
import type { ParseDiagnostic } from "../diagnostic.js";

export type TzrV2ParseResult =
  | { readonly ok: true; readonly document: TzrV2Document; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly ParseDiagnostic[] };

export type TzrV2ConditionParseResult =
  | { readonly ok: true; readonly expression: TzrV2ConditionExpression; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly ParseDiagnostic[] };

export interface TzrV2ParseOptions {
  readonly filePath?: string;
}

export interface TzrV2Document {
  readonly type: "TzrV2Document";
  readonly filePath: string;
  readonly sourceLines: readonly string[];
  readonly declarations: readonly TzrV2TopLevelDeclaration[];
}

export type TzrV2TopLevelDeclaration =
  | TzrV2TitleDeclaration
  | TzrV2CharacterDeclaration
  | TzrV2SceneDeclaration;

export interface TzrV2TitleDeclaration {
  readonly type: "TitleDeclaration";
  readonly title: string;
  readonly loc: SourceRange;
}

export interface TzrV2CharacterDeclaration {
  readonly type: "CharacterDeclaration";
  readonly id: string;
  readonly name: string;
  readonly loc: SourceRange;
}

export interface TzrV2SceneDeclaration {
  readonly type: "SceneDeclaration";
  readonly id: string;
  readonly title?: string;
  readonly body: readonly TzrV2SceneStatement[];
  readonly loc: SourceRange;
}

export type TzrV2SceneStatement =
  | TzrV2NarrationStatement
  | TzrV2DialogueStatement
  | TzrV2ChoiceStatement
  | TzrV2IfStatement
  | TzrV2SetStatement
  | TzrV2AddStatement
  | TzrV2CallStatement
  | TzrV2WaitStatement
  | TzrV2BgStatement
  | TzrV2ShowStatement
  | TzrV2HideStatement
  | TzrV2ClearVisualStatement
  | TzrV2BgmStatement
  | TzrV2StopBgmStatement
  | TzrV2SeStatement
  | TzrV2VoiceStatement
  | TzrV2JumpStatement
  | TzrV2EndStatement;

export interface TzrV2NarrationStatement {
  readonly type: "NarrationStatement";
  readonly meta?: TzrV2TextBlockMeta;
  readonly lines: readonly TzrV2TextBlockItem[];
  readonly loc: SourceRange;
}

export interface TzrV2DialogueStatement {
  readonly type: "DialogueStatement";
  readonly speaker: string;
  readonly meta?: TzrV2TextBlockMeta;
  readonly lines: readonly TzrV2TextBlockItem[];
  readonly explicit: boolean;
  readonly loc: SourceRange;
}

export interface TzrV2ChoiceStatement {
  readonly type: "ChoiceStatement";
  readonly question: string;
  readonly items: readonly TzrV2ChoiceItem[];
  readonly loc: SourceRange;
}

export interface TzrV2ChoiceItem {
  readonly type: "ChoiceItem";
  readonly label: string;
  readonly id?: string;
  readonly condition?: TzrV2ConditionExpression;
  readonly body: readonly TzrV2SceneStatement[];
  readonly loc: SourceRange;
}

export interface TzrV2IfStatement {
  readonly type: "IfStatement";
  readonly condition: TzrV2ConditionExpression;
  readonly thenBranch: readonly TzrV2SceneStatement[];
  readonly elifBranches: readonly TzrV2ElifBranch[];
  readonly elseBranch?: readonly TzrV2SceneStatement[];
  readonly loc: SourceRange;
}

export interface TzrV2ElifBranch {
  readonly type: "ElifBranch";
  readonly condition: TzrV2ConditionExpression;
  readonly body: readonly TzrV2SceneStatement[];
  readonly loc: SourceRange;
}

export interface TzrV2SetStatement {
  readonly type: "SetStatement";
  readonly target: TzrV2StatePath;
  readonly value: TzrV2ValueExpression;
  readonly loc: SourceRange;
}

export interface TzrV2AddStatement {
  readonly type: "AddStatement";
  readonly target: TzrV2StatePath;
  readonly value: TzrV2NumberValue;
  readonly loc: SourceRange;
}

export interface TzrV2StatePath {
  readonly type: "StatePath";
  readonly path: string;
  readonly root: "scenario";
  readonly loc: SourceRange;
}

export type TzrV2ValueExpression =
  | TzrV2StringValue
  | TzrV2NumberValue
  | TzrV2BooleanValue
  | TzrV2NullValue
  | TzrV2VariableReferenceValue;

export interface TzrV2StringValue {
  readonly type: "StringValue";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2NumberValue {
  readonly type: "NumberValue";
  readonly value: number;
  readonly loc: SourceRange;
}

export interface TzrV2BooleanValue {
  readonly type: "BooleanValue";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrV2NullValue {
  readonly type: "NullValue";
  readonly value: null;
  readonly loc: SourceRange;
}

export interface TzrV2VariableReferenceValue {
  readonly type: "VariableReferenceValue";
  readonly path: string;
  readonly root: "scenario" | "system";
  readonly loc: SourceRange;
}

export interface TzrV2CallStatement {
  readonly type: "CallStatement";
  readonly name: string;
  readonly args: readonly TzrV2NamedArgument[];
  readonly loc: SourceRange;
}

export interface TzrV2WaitStatement {
  readonly type: "WaitStatement";
  readonly name: string;
  readonly args: readonly TzrV2NamedArgument[];
  readonly loc: SourceRange;
}

export interface TzrV2NamedArgument {
  readonly type: "NamedArgument";
  readonly name: string;
  readonly value: TzrV2ArgumentValue;
  readonly loc: SourceRange;
}

export type TzrV2ArgumentValue =
  | TzrV2StringValue
  | TzrV2NumberValue
  | TzrV2BooleanValue
  | TzrV2NullValue
  | TzrV2IdentifierValue
  | TzrV2VariableReferenceValue;

export interface TzrV2IdentifierValue {
  readonly type: "IdentifierValue";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2BgStatement {
  readonly type: "BgStatement";
  readonly assetRef: TzrV2VisualAssetRef;
  readonly transition?: TzrV2VisualTransition;
  readonly loc: SourceRange;
}

export interface TzrV2ShowStatement {
  readonly type: "ShowStatement";
  readonly assetRef: TzrV2VisualAssetRef;
  readonly placement: TzrV2VisualPlacement;
  readonly transition?: TzrV2VisualTransition;
  readonly loc: SourceRange;
}

export interface TzrV2HideStatement {
  readonly type: "HideStatement";
  readonly assetRef: TzrV2VisualAssetRef;
  readonly transition?: TzrV2VisualTransition;
  readonly loc: SourceRange;
}

export interface TzrV2ClearVisualStatement {
  readonly type: "ClearVisualStatement";
  readonly target: "sprites" | "bg";
  readonly transition?: TzrV2VisualTransition;
  readonly loc: SourceRange;
}

export type TzrV2VisualAssetRef = TzrV2VisualIdentifierAssetRef | TzrV2VisualStringAssetRef;

export interface TzrV2VisualIdentifierAssetRef {
  readonly type: "VisualIdentifierAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2VisualStringAssetRef {
  readonly type: "VisualStringAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export type TzrV2VisualPlacement = TzrV2VisualNamedPlacement | TzrV2VisualCoordinatePlacement;

export interface TzrV2VisualNamedPlacement {
  readonly type: "VisualNamedPlacement";
  readonly value: "left" | "center" | "right";
  readonly loc: SourceRange;
}

export interface TzrV2VisualCoordinatePlacement {
  readonly type: "VisualCoordinatePlacement";
  readonly x: number;
  readonly y: number;
  readonly loc: SourceRange;
}

export type TzrV2VisualTransitionName = "fade" | "dissolve";

export interface TzrV2VisualTransition {
  readonly type: "VisualTransition";
  readonly name: TzrV2VisualTransitionName;
  readonly duration: number;
  readonly loc: SourceRange;
}

export interface TzrV2BgmStatement {
  readonly type: "BgmStatement";
  readonly assetRef: TzrV2AudioAssetRef;
  readonly loc: SourceRange;
}

export interface TzrV2StopBgmStatement {
  readonly type: "StopBgmStatement";
  readonly loc: SourceRange;
}

export interface TzrV2SeStatement {
  readonly type: "SeStatement";
  readonly assetRef: TzrV2AudioAssetRef;
  readonly loc: SourceRange;
}

export interface TzrV2VoiceStatement {
  readonly type: "VoiceStatement";
  readonly assetRef: TzrV2AudioAssetRef;
  readonly loc: SourceRange;
}

export type TzrV2AudioAssetRef = TzrV2AudioIdentifierAssetRef | TzrV2AudioStringAssetRef;

export interface TzrV2AudioIdentifierAssetRef {
  readonly type: "AudioIdentifierAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2AudioStringAssetRef {
  readonly type: "AudioStringAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2JumpStatement {
  readonly type: "JumpStatement";
  readonly target: string;
  readonly loc: SourceRange;
}

export interface TzrV2EndStatement {
  readonly type: "EndStatement";
  readonly loc: SourceRange;
}

export type TzrV2ConditionExpression =
  | TzrV2ConditionReference
  | TzrV2ConditionLiteral
  | TzrV2ConditionUnaryExpression
  | TzrV2ConditionBinaryExpression
  | TzrV2ConditionComparisonExpression;

export interface TzrV2ConditionReference {
  readonly type: "ConditionReference";
  readonly path: string;
  readonly root: "scenario" | "system";
  readonly loc: SourceRange;
}

export type TzrV2ConditionLiteral =
  | TzrV2ConditionStringLiteral
  | TzrV2ConditionNumberLiteral
  | TzrV2ConditionBooleanLiteral
  | TzrV2ConditionNullLiteral;

export interface TzrV2ConditionStringLiteral {
  readonly type: "ConditionStringLiteral";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2ConditionNumberLiteral {
  readonly type: "ConditionNumberLiteral";
  readonly value: number;
  readonly loc: SourceRange;
}

export interface TzrV2ConditionBooleanLiteral {
  readonly type: "ConditionBooleanLiteral";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrV2ConditionNullLiteral {
  readonly type: "ConditionNullLiteral";
  readonly value: null;
  readonly loc: SourceRange;
}

export interface TzrV2ConditionUnaryExpression {
  readonly type: "ConditionUnaryExpression";
  readonly operator: "not";
  readonly expression: TzrV2ConditionExpression;
  readonly loc: SourceRange;
}

export interface TzrV2ConditionBinaryExpression {
  readonly type: "ConditionBinaryExpression";
  readonly operator: "and" | "or";
  readonly left: TzrV2ConditionExpression;
  readonly right: TzrV2ConditionExpression;
  readonly loc: SourceRange;
}

export interface TzrV2ConditionComparisonExpression {
  readonly type: "ConditionComparisonExpression";
  readonly operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
  readonly left: TzrV2ConditionExpression;
  readonly right: TzrV2ConditionExpression;
  readonly loc: SourceRange;
}

export type TzrV2TextBlockItem = TzrV2TextLine | TzrV2TextClickWait | TzrV2TextPageBreak;

export interface TzrV2TextLine {
  readonly type: "TextLine";
  readonly text: string;
  readonly inline: readonly TzrV2InlineNode[];
  readonly loc: SourceRange;
}

export interface TzrV2TextClickWait {
  readonly type: "TextClickWait";
  readonly loc: SourceRange;
}

export interface TzrV2TextPageBreak {
  readonly type: "TextPageBreak";
  readonly loc: SourceRange;
}

export interface TzrV2TextBlockMeta {
  readonly type: "TextBlockMeta";
  readonly attributes: readonly TzrV2TextBlockMetaAttribute[];
  readonly loc: SourceRange;
}

export type TzrV2TextBlockMetaAttribute =
  | TzrV2TextBlockColorMetaAttribute
  | TzrV2TextBlockBooleanMetaAttribute
  | TzrV2TextBlockNumberMetaAttribute
  | TzrV2TextBlockMoodMetaAttribute;

export interface TzrV2TextBlockColorMetaAttribute {
  readonly type: "TextBlockColorMetaAttribute";
  readonly name: "color";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2TextBlockBooleanMetaAttribute {
  readonly type: "TextBlockBooleanMetaAttribute";
  readonly name: "bold" | "italic";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrV2TextBlockNumberMetaAttribute {
  readonly type: "TextBlockNumberMetaAttribute";
  readonly name: "size" | "delay";
  readonly value: number;
  readonly loc: SourceRange;
}

export interface TzrV2TextBlockMoodMetaAttribute {
  readonly type: "TextBlockMoodMetaAttribute";
  readonly name: "mood";
  readonly value: string;
  readonly valueKind: "identifier" | "string";
  readonly loc: SourceRange;
}

export type TzrV2InlineNode =
  | TzrV2InlineText
  | TzrV2InlineTextSpan
  | TzrV2InlineDelaySpan
  | TzrV2InlineWaitEvent
  | TzrV2InlineSeEvent
  | TzrV2InlineVoiceEvent;

export interface TzrV2InlineText {
  readonly type: "InlineText";
  readonly text: string;
  readonly loc: SourceRange;
}

export interface TzrV2InlineTextSpan {
  readonly type: "InlineTextSpan";
  readonly attributes: readonly TzrV2InlineTextAttribute[];
  readonly children: readonly TzrV2InlineNode[];
  readonly text: string;
  readonly loc: SourceRange;
}

export interface TzrV2InlineDelaySpan {
  readonly type: "InlineDelaySpan";
  readonly ms: number;
  readonly children: readonly TzrV2InlineNode[];
  readonly text: string;
  readonly loc: SourceRange;
}

export interface TzrV2InlineWaitEvent {
  readonly type: "InlineWaitEvent";
  readonly ms: number;
  readonly text: "";
  readonly loc: SourceRange;
}

export interface TzrV2InlineSeEvent {
  readonly type: "InlineSeEvent";
  readonly assetId: TzrV2InlineAssetId;
  readonly text: "";
  readonly loc: SourceRange;
}

export interface TzrV2InlineVoiceEvent {
  readonly type: "InlineVoiceEvent";
  readonly assetId: TzrV2InlineAssetId;
  readonly text: "";
  readonly loc: SourceRange;
}

export type TzrV2InlineAssetId =
  | TzrV2InlineIdentifierAssetId
  | TzrV2InlineStringAssetId
  | TzrV2InlineVariableAssetId;

export interface TzrV2InlineIdentifierAssetId {
  readonly type: "InlineIdentifierAssetId";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2InlineStringAssetId {
  readonly type: "InlineStringAssetId";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2InlineVariableAssetId {
  readonly type: "InlineVariableAssetId";
  readonly path: string;
  readonly loc: SourceRange;
}

export type TzrV2InlineTextAttribute =
  | TzrV2InlineTextColorAttribute
  | TzrV2InlineTextBooleanAttribute
  | TzrV2InlineTextSizeAttribute;

export interface TzrV2InlineTextColorAttribute {
  readonly type: "InlineTextColorAttribute";
  readonly name: "color";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrV2InlineTextBooleanAttribute {
  readonly type: "InlineTextBooleanAttribute";
  readonly name: "bold" | "italic";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrV2InlineTextSizeAttribute {
  readonly type: "InlineTextSizeAttribute";
  readonly name: "size";
  readonly value: number;
  readonly loc: SourceRange;
}
