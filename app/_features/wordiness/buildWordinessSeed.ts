import type { CefrLevel, TextType } from "@/lib/cefr";
import type { OutputVariant } from "@/lib/contracts/generation";
import {
  buildWordinessSeedFromVariants,
  normalizeWordinessSeed,
  selectWordinessSeedVariant,
  type WordinessGameSeed,
  type WordinessSeed,
  type WordinessSeedMeta,
} from "@/lib/contracts/wordiness";

export type { WordinessGameSeed, WordinessSeed, WordinessSeedMeta };
export { buildWordinessSeedFromVariants, normalizeWordinessSeed, selectWordinessSeedVariant };

export function buildWordinessSeedFromText(
  text: string,
  sourceOrMeta?: string | Partial<WordinessSeedMeta>,
  options: {
    cefrLevel?: CefrLevel;
    textType?: TextType;
    activeVariant?: OutputVariant;
  } = {},
): WordinessSeed {
  const source = typeof sourceOrMeta === "string" ? sourceOrMeta : sourceOrMeta?.source;
  const title = typeof sourceOrMeta === "object" ? sourceOrMeta.title : undefined;
  return buildWordinessSeedFromVariants({
    standard: text,
    supported: text,
    source,
    title,
    cefrLevel: options.cefrLevel,
    textType: options.textType,
    activeVariant: options.activeVariant,
  });
}
