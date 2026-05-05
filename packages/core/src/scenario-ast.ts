import type { SourceRange } from "./ast.js";
import type { ParseDiagnostic } from "./diagnostic.js";

export type TzrParseResult =
  | { readonly ok: true; readonly document: TzrDocument; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly ParseDiagnostic[] };

export type TzrConditionParseResult =
  | { readonly ok: true; readonly expression: TzrConditionExpression; readonly errors: readonly [] }
  | { readonly ok: false; readonly errors: readonly ParseDiagnostic[] };

export interface TzrParseOptions {
  readonly filePath?: string;
}

export interface TzrDocument {
  readonly type: "TzrDocument";
  readonly filePath: string;
  readonly sourceLines: readonly string[];
  readonly declarations: readonly TzrTopLevelDeclaration[];
}

export type TzrTopLevelDeclaration =
  | TzrTitleDeclaration
  | TzrCharacterDeclaration
  | TzrSceneDeclaration;

export interface TzrTitleDeclaration {
  readonly type: "TitleDeclaration";
  readonly title: string;
  readonly loc: SourceRange;
}

export interface TzrCharacterDeclaration {
  readonly type: "CharacterDeclaration";
  readonly id: string;
  readonly name: string;
  readonly loc: SourceRange;
}

export interface TzrSceneDeclaration {
  readonly type: "SceneDeclaration";
  readonly id: string;
  readonly title?: string;
  readonly body: readonly TzrSceneStatement[];
  readonly loc: SourceRange;
}

export type TzrSceneStatement =
  | TzrNarrationStatement
  | TzrDialogueStatement
  | TzrChoiceStatement
  | TzrIfStatement
  | TzrSetStatement
  | TzrAddStatement
  | TzrCallStatement
  | TzrWaitStatement
  | TzrBgStatement
  | TzrShowStatement
  | TzrHideStatement
  | TzrClearVisualStatement
  | TzrBgmStatement
  | TzrStopBgmStatement
  | TzrSeStatement
  | TzrVoiceStatement
  | TzrSystemUnlockStatement
  | TzrJumpStatement
  | TzrEndStatement;

export interface TzrNarrationStatement {
  readonly type: "NarrationStatement";
  readonly meta?: TzrTextBlockMeta;
  readonly lines: readonly TzrTextBlockItem[];
  readonly loc: SourceRange;
}

export interface TzrDialogueStatement {
  readonly type: "DialogueStatement";
  readonly speaker: string;
  readonly meta?: TzrTextBlockMeta;
  readonly lines: readonly TzrTextBlockItem[];
  readonly explicit: boolean;
  readonly loc: SourceRange;
}

export interface TzrChoiceStatement {
  readonly type: "ChoiceStatement";
  readonly question: string;
  readonly items: readonly TzrChoiceItem[];
  readonly loc: SourceRange;
}

export interface TzrChoiceItem {
  readonly type: "ChoiceItem";
  readonly label: string;
  readonly id?: string;
  readonly condition?: TzrConditionExpression;
  readonly body: readonly TzrSceneStatement[];
  readonly loc: SourceRange;
}

export interface TzrIfStatement {
  readonly type: "IfStatement";
  readonly condition: TzrConditionExpression;
  readonly thenBranch: readonly TzrSceneStatement[];
  readonly elifBranches: readonly TzrElifBranch[];
  readonly elseBranch?: readonly TzrSceneStatement[];
  readonly loc: SourceRange;
}

export interface TzrElifBranch {
  readonly type: "ElifBranch";
  readonly condition: TzrConditionExpression;
  readonly body: readonly TzrSceneStatement[];
  readonly loc: SourceRange;
}

export interface TzrSetStatement {
  readonly type: "SetStatement";
  readonly target: TzrStatePath;
  readonly value: TzrValueExpression;
  readonly loc: SourceRange;
}

export interface TzrAddStatement {
  readonly type: "AddStatement";
  readonly target: TzrStatePath;
  readonly value: TzrNumberValue;
  readonly loc: SourceRange;
}

export interface TzrStatePath {
  readonly type: "StatePath";
  readonly path: string;
  readonly root: "scenario";
  readonly loc: SourceRange;
}

export type TzrValueExpression =
  | TzrStringValue
  | TzrNumberValue
  | TzrBooleanValue
  | TzrNullValue
  | TzrVariableReferenceValue;

export interface TzrStringValue {
  readonly type: "StringValue";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrNumberValue {
  readonly type: "NumberValue";
  readonly value: number;
  readonly loc: SourceRange;
}

export interface TzrBooleanValue {
  readonly type: "BooleanValue";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrNullValue {
  readonly type: "NullValue";
  readonly value: null;
  readonly loc: SourceRange;
}

export interface TzrVariableReferenceValue {
  readonly type: "VariableReferenceValue";
  readonly path: string;
  readonly root: "scenario" | "system";
  readonly loc: SourceRange;
}

export interface TzrCallStatement {
  readonly type: "CallStatement";
  readonly name: string;
  readonly args: readonly TzrNamedArgument[];
  readonly loc: SourceRange;
}

export interface TzrWaitStatement {
  readonly type: "WaitStatement";
  readonly name: string;
  readonly args: readonly TzrNamedArgument[];
  readonly loc: SourceRange;
}

export interface TzrNamedArgument {
  readonly type: "NamedArgument";
  readonly name: string;
  readonly value: TzrArgumentValue;
  readonly loc: SourceRange;
}

export type TzrArgumentValue =
  | TzrStringValue
  | TzrNumberValue
  | TzrBooleanValue
  | TzrNullValue
  | TzrIdentifierValue
  | TzrVariableReferenceValue;

export interface TzrIdentifierValue {
  readonly type: "IdentifierValue";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrBgStatement {
  readonly type: "BgStatement";
  readonly assetRef: TzrVisualAssetRef;
  readonly transition?: TzrVisualTransition;
  readonly loc: SourceRange;
}

export interface TzrShowStatement {
  readonly type: "ShowStatement";
  readonly assetRef: TzrVisualAssetRef;
  readonly placement: TzrVisualPlacement;
  readonly transition?: TzrVisualTransition;
  readonly loc: SourceRange;
}

export interface TzrHideStatement {
  readonly type: "HideStatement";
  readonly assetRef: TzrVisualAssetRef;
  readonly transition?: TzrVisualTransition;
  readonly loc: SourceRange;
}

export interface TzrClearVisualStatement {
  readonly type: "ClearVisualStatement";
  readonly target: "sprites" | "bg";
  readonly transition?: TzrVisualTransition;
  readonly loc: SourceRange;
}

export type TzrVisualAssetRef = TzrVisualIdentifierAssetRef | TzrVisualStringAssetRef;

export interface TzrVisualIdentifierAssetRef {
  readonly type: "VisualIdentifierAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrVisualStringAssetRef {
  readonly type: "VisualStringAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export type TzrVisualPlacement = TzrVisualNamedPlacement | TzrVisualCoordinatePlacement;

export interface TzrVisualNamedPlacement {
  readonly type: "VisualNamedPlacement";
  readonly value: "left" | "center" | "right";
  readonly loc: SourceRange;
}

export interface TzrVisualCoordinatePlacement {
  readonly type: "VisualCoordinatePlacement";
  readonly x: number;
  readonly y: number;
  readonly loc: SourceRange;
}

export type TzrVisualTransitionName = "fade" | "dissolve";

export interface TzrVisualTransition {
  readonly type: "VisualTransition";
  readonly name: TzrVisualTransitionName;
  readonly duration: number;
  readonly loc: SourceRange;
}

export interface TzrBgmStatement {
  readonly type: "BgmStatement";
  readonly assetRef: TzrAudioAssetRef;
  readonly loc: SourceRange;
}

export interface TzrStopBgmStatement {
  readonly type: "StopBgmStatement";
  readonly loc: SourceRange;
}

export interface TzrSeStatement {
  readonly type: "SeStatement";
  readonly assetRef: TzrAudioAssetRef;
  readonly loc: SourceRange;
}

export interface TzrVoiceStatement {
  readonly type: "VoiceStatement";
  readonly assetRef: TzrAudioAssetRef;
  readonly loc: SourceRange;
}

export type TzrAudioAssetRef = TzrAudioIdentifierAssetRef | TzrAudioStringAssetRef;

export interface TzrAudioIdentifierAssetRef {
  readonly type: "AudioIdentifierAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrAudioStringAssetRef {
  readonly type: "AudioStringAssetRef";
  readonly value: string;
  readonly loc: SourceRange;
}

export type TzrSystemUnlockKind = "ending" | "cg" | "achievement";

export interface TzrSystemUnlockStatement {
  readonly type: "SystemUnlockStatement";
  readonly kind: TzrSystemUnlockKind;
  readonly id: TzrSystemUnlockId;
  readonly loc: SourceRange;
}

export type TzrSystemUnlockId = TzrSystemUnlockIdentifierId | TzrSystemUnlockStringId;

export interface TzrSystemUnlockIdentifierId {
  readonly type: "SystemUnlockIdentifierId";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrSystemUnlockStringId {
  readonly type: "SystemUnlockStringId";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrJumpStatement {
  readonly type: "JumpStatement";
  readonly target: string;
  readonly loc: SourceRange;
}

export interface TzrEndStatement {
  readonly type: "EndStatement";
  readonly loc: SourceRange;
}

export type TzrConditionExpression =
  | TzrConditionReference
  | TzrConditionLiteral
  | TzrConditionUnaryExpression
  | TzrConditionBinaryExpression
  | TzrConditionComparisonExpression;

export interface TzrConditionReference {
  readonly type: "ConditionReference";
  readonly path: string;
  readonly root: "scenario" | "system";
  readonly loc: SourceRange;
}

export type TzrConditionLiteral =
  | TzrConditionStringLiteral
  | TzrConditionNumberLiteral
  | TzrConditionBooleanLiteral
  | TzrConditionNullLiteral;

export interface TzrConditionStringLiteral {
  readonly type: "ConditionStringLiteral";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrConditionNumberLiteral {
  readonly type: "ConditionNumberLiteral";
  readonly value: number;
  readonly loc: SourceRange;
}

export interface TzrConditionBooleanLiteral {
  readonly type: "ConditionBooleanLiteral";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrConditionNullLiteral {
  readonly type: "ConditionNullLiteral";
  readonly value: null;
  readonly loc: SourceRange;
}

export interface TzrConditionUnaryExpression {
  readonly type: "ConditionUnaryExpression";
  readonly operator: "not";
  readonly expression: TzrConditionExpression;
  readonly loc: SourceRange;
}

export interface TzrConditionBinaryExpression {
  readonly type: "ConditionBinaryExpression";
  readonly operator: "and" | "or";
  readonly left: TzrConditionExpression;
  readonly right: TzrConditionExpression;
  readonly loc: SourceRange;
}

export interface TzrConditionComparisonExpression {
  readonly type: "ConditionComparisonExpression";
  readonly operator: "==" | "!=" | ">=" | "<=" | ">" | "<";
  readonly left: TzrConditionExpression;
  readonly right: TzrConditionExpression;
  readonly loc: SourceRange;
}

export type TzrTextBlockItem = TzrTextLine | TzrTextClickWait | TzrTextPageBreak;

export interface TzrTextLine {
  readonly type: "TextLine";
  readonly text: string;
  readonly inline: readonly TzrInlineNode[];
  readonly loc: SourceRange;
}

export interface TzrTextClickWait {
  readonly type: "TextClickWait";
  readonly loc: SourceRange;
}

export interface TzrTextPageBreak {
  readonly type: "TextPageBreak";
  readonly loc: SourceRange;
}

export interface TzrTextBlockMeta {
  readonly type: "TextBlockMeta";
  readonly attributes: readonly TzrTextBlockMetaAttribute[];
  readonly loc: SourceRange;
}

export type TzrTextBlockMetaAttribute =
  | TzrTextBlockColorMetaAttribute
  | TzrTextBlockBooleanMetaAttribute
  | TzrTextBlockNumberMetaAttribute
  | TzrTextBlockMoodMetaAttribute;

export interface TzrTextBlockColorMetaAttribute {
  readonly type: "TextBlockColorMetaAttribute";
  readonly name: "color";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrTextBlockBooleanMetaAttribute {
  readonly type: "TextBlockBooleanMetaAttribute";
  readonly name: "bold" | "italic";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrTextBlockNumberMetaAttribute {
  readonly type: "TextBlockNumberMetaAttribute";
  readonly name: "size" | "delay";
  readonly value: number;
  readonly loc: SourceRange;
}

export interface TzrTextBlockMoodMetaAttribute {
  readonly type: "TextBlockMoodMetaAttribute";
  readonly name: "mood";
  readonly value: string;
  readonly valueKind: "identifier" | "string";
  readonly loc: SourceRange;
}

export type TzrInlineNode =
  | TzrInlineText
  | TzrInlineTextSpan
  | TzrInlineDelaySpan
  | TzrInlineWaitEvent
  | TzrInlineSeEvent
  | TzrInlineVoiceEvent;

export interface TzrInlineText {
  readonly type: "InlineText";
  readonly text: string;
  readonly loc: SourceRange;
}

export interface TzrInlineTextSpan {
  readonly type: "InlineTextSpan";
  readonly attributes: readonly TzrInlineTextAttribute[];
  readonly children: readonly TzrInlineNode[];
  readonly text: string;
  readonly loc: SourceRange;
}

export interface TzrInlineDelaySpan {
  readonly type: "InlineDelaySpan";
  readonly ms: number;
  readonly children: readonly TzrInlineNode[];
  readonly text: string;
  readonly loc: SourceRange;
}

export interface TzrInlineWaitEvent {
  readonly type: "InlineWaitEvent";
  readonly ms: number;
  readonly text: "";
  readonly loc: SourceRange;
}

export interface TzrInlineSeEvent {
  readonly type: "InlineSeEvent";
  readonly assetId: TzrInlineAssetId;
  readonly text: "";
  readonly loc: SourceRange;
}

export interface TzrInlineVoiceEvent {
  readonly type: "InlineVoiceEvent";
  readonly assetId: TzrInlineAssetId;
  readonly text: "";
  readonly loc: SourceRange;
}

export type TzrInlineAssetId =
  | TzrInlineIdentifierAssetId
  | TzrInlineStringAssetId
  | TzrInlineVariableAssetId;

export interface TzrInlineIdentifierAssetId {
  readonly type: "InlineIdentifierAssetId";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrInlineStringAssetId {
  readonly type: "InlineStringAssetId";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrInlineVariableAssetId {
  readonly type: "InlineVariableAssetId";
  readonly path: string;
  readonly loc: SourceRange;
}

export type TzrInlineTextAttribute =
  | TzrInlineTextColorAttribute
  | TzrInlineTextBooleanAttribute
  | TzrInlineTextSizeAttribute;

export interface TzrInlineTextColorAttribute {
  readonly type: "InlineTextColorAttribute";
  readonly name: "color";
  readonly value: string;
  readonly loc: SourceRange;
}

export interface TzrInlineTextBooleanAttribute {
  readonly type: "InlineTextBooleanAttribute";
  readonly name: "bold" | "italic";
  readonly value: boolean;
  readonly loc: SourceRange;
}

export interface TzrInlineTextSizeAttribute {
  readonly type: "InlineTextSizeAttribute";
  readonly name: "size";
  readonly value: number;
  readonly loc: SourceRange;
}
