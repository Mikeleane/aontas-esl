// Deprecated compatibility module.
// The canonical CEFR source of truth is lib/cefr.ts.
export {
  CEFR_LEVELS,
  TEXT_TYPES,
  buildCambridgeConstraints,
  buildCefrConstraints,
  cambridgeTextTypeSpec,
  cefrStyleGuide,
  getLengthTargets,
  getRegisterForTextType,
  getWordTarget,
  parseCefrLevel,
  parseTextType,
  textTypeSpec,
} from "./cefr";
export type { CefrLevel, Register, TextType, WordTarget } from "./cefr";
