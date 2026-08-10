"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import CefrTextTypeControls from "@/app/_components/CefrTextTypeControls";
import { parseCefrLevel, parseTextType, type CefrLevel, type TextType } from "@/lib/cefr";
import type { OutputVariant } from "@/lib/contracts/generation";
import {
  buildWordinessSeedFromVariants,
  normalizeWordinessSeed,
} from "@/lib/contracts/wordiness";
import styles from "./wordiness.module.css";

type ApiGame = {
  file: string;
  title: string;
  desc: string;
  tags: string[];
  seedable: boolean;
  order: number;
};

type ApiResponse = {
  files?: ApiGame[];
  fileCount?: number;
};

type GameGroup = {
  key: string;
  title: string;
  desc: string;
  tags: string[];
  order: number;
  files: string[];
  base?: ApiGame;
  seeded?: ApiGame;
};

function cleanTitle(value: string): string {
  return value
    .replace(/\bPbdq\b/gi, "p/b/d/q")
    .replace(/\bLego\b/g, "LEGO")
    .replace(/\bWh\b/g, "WH")
    .replace(/\bTts\b/g, "TTS")
    .replace(/\bDj\b/g, "DJ")
    .replace(/\bStart Stop\b/gi, "Start–Stop")
    .replace(/\bWH Question\b/gi, "WH-Question")
    .trim();
}

function groupGames(games: ApiGame[]): GameGroup[] {
  const groups = new Map<string, GameGroup>();
  for (const game of games) {
    const dedicatedSeed = /-seeded\.(html|htm)$/i.test(game.file);
    const key = cleanTitle(game.title).toLocaleLowerCase();
    const group = groups.get(key) ?? {
      key,
      title: cleanTitle(game.title),
      desc: game.desc,
      tags: [],
      order: game.order,
      files: [],
    };
    group.order = Math.min(group.order, game.order);
    group.desc = group.desc || game.desc;
    group.tags = Array.from(new Set([...group.tags, ...game.tags].filter((tag) => tag !== "seeded")));
    group.files.push(game.file);
    if (!dedicatedSeed && (!group.base || game.order < group.base.order)) group.base = game;
    if ((game.seedable || dedicatedSeed) && (!group.seeded || game.order < group.seeded.order)) group.seeded = game;
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function tagLabel(tag: string): string {
  return tag
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function WordinessHubPage() {
  const [games, setGames] = useState<ApiGame[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>("B1");
  const [textType, setTextType] = useState<TextType>("article");
  const [variant, setVariant] = useState<OutputVariant>("standard");
  const [standardText, setStandardText] = useState("");
  const [supportedText, setSupportedText] = useState("");
  const [seedTitle, setSeedTitle] = useState("");
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("wordiness_seed_json");
      if (raw) {
        const seed = normalizeWordinessSeed(JSON.parse(raw));
        setCefrLevel(parseCefrLevel(seed.cefrLevel));
        setTextType(parseTextType(seed.textType));
        setVariant(seed.activeVariant);
        setStandardText(seed.variants.standard.text);
        setSupportedText(seed.variants.supported.text);
        setSeedTitle(seed.meta.title || "");
      }
    } catch {
      // A damaged old seed must not block Wordiness.
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/wordiness?ts=${Date.now()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Wordiness library request failed: ${response.status}`);
        return response.json() as Promise<ApiResponse>;
      })
      .then((data) => {
        setGames(Array.isArray(data.files) ? data.files : []);
        setLoadError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setGames([]);
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (!standardText.trim() && !supportedText.trim()) {
      try { localStorage.removeItem("wordiness_seed_json"); } catch {}
      return;
    }
    const seed = buildWordinessSeedFromVariants({
      standard: standardText,
      supported: supportedText,
      cefrLevel,
      textType,
      activeVariant: variant,
      source: "wordiness-hub",
      title: seedTitle || undefined,
    });
    try { localStorage.setItem("wordiness_seed_json", JSON.stringify(seed)); } catch {}
  }, [cefrLevel, loaded, seedTitle, standardText, supportedText, textType, variant]);

  const groupedGames = useMemo(() => groupGames(games), [games]);
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    groupedGames.forEach((game) => game.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort((a, b) => tagLabel(a).localeCompare(tagLabel(b)));
  }, [groupedGames]);
  const filteredGames = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return groupedGames.filter((game) => {
      if (selectedTag && !game.tags.includes(selectedTag)) return false;
      if (!search) return true;
      return [game.title, game.desc, ...game.tags, ...game.files].join(" ").toLocaleLowerCase().includes(search);
    });
  }, [groupedGames, query, selectedTag]);

  const activeText = variant === "standard"
    ? (standardText || supportedText)
    : (supportedText || standardText);
  const hasActiveSeed = Boolean(activeText.trim());

  function setActiveText(value: string) {
    if (variant === "standard") setStandardText(value);
    else setSupportedText(value);
  }

  function saveSeed(activeVariant = variant) {
    const seed = buildWordinessSeedFromVariants({
      standard: standardText,
      supported: supportedText,
      cefrLevel,
      textType,
      activeVariant,
      source: "wordiness-hub",
      title: seedTitle || undefined,
    });
    try { localStorage.setItem("wordiness_seed_json", JSON.stringify(seed)); } catch {}
  }

  function launch(game: ApiGame, includeSeed = false) {
    if (includeSeed && hasActiveSeed) saveSeed(variant);
    const hash = includeSeed ? `#use-seed=1&variant=${variant}` : "#standalone=1";
    window.open(`/wordiness/${game.file}${hash}`, "_blank", "noopener,noreferrer");
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Image className={styles.mark} src="/wordiness/aontas-esl-mark.svg" alt="Aontas ESL" width={54} height={54} priority />
          <div>
            <a className={styles.back} href="/pack">← Reading Studio</a>
            <h1 className={styles.title}>Wordiness Hub</h1>
            <p className={styles.subtitle}>
              Focused language games from the KNS Wordiness suite, adapted to the Aontas ESL CEFR spine.
              Open a standalone game or carry the current Standard/Supported Reading text straight into a seeded activity.
            </p>
          </div>
          <div className={styles.count} aria-label={`${groupedGames.length} activities from ${games.length} game files`}>
            <strong>{groupedGames.length}</strong>
            <span>activities</span>
          </div>
        </header>

        <section className={styles.panel} aria-labelledby="wordiness-seed-heading">
          <div className={styles.seedTop}>
            <div>
              <h2 id="wordiness-seed-heading">Use the current text</h2>
              <p>Reading Studio loads both routes automatically. Choose which route a seeded game should use, or paste/replace the text here.</p>
            </div>
            <span className={`${styles.status} ${hasActiveSeed ? styles.ready : ""}`}>
              {hasActiveSeed ? `Ready · ${cefrLevel} · ${variant === "supported" ? "Supported" : "Standard"}` : "No text added"}
            </span>
          </div>

          <CefrTextTypeControls
            cefrLevel={cefrLevel}
            setCefrLevel={setCefrLevel}
            textType={textType}
            setTextType={setTextType}
          />

          <div className={styles.routeRow}>
            <strong>Game text:</strong>
            {(["standard", "supported"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={`${styles.routeButton} ${variant === mode ? styles.routeActive : ""}`}
                onClick={() => setVariant(mode)}
                aria-pressed={variant === mode}
              >
                {mode === "standard" ? "Standard" : "Supported"}
              </button>
            ))}
            <button type="button" className={styles.secondary} onClick={() => setSupportedText(standardText)} disabled={!standardText.trim()}>
              Copy Standard → Supported
            </button>
            <button type="button" className={styles.secondary} onClick={() => { setStandardText(""); setSupportedText(""); setSeedTitle(""); }} disabled={!standardText && !supportedText}>
              Clear both
            </button>
          </div>

          <textarea
            className={styles.textarea}
            value={activeText}
            onChange={(event) => setActiveText(event.target.value)}
            placeholder={`Paste ${variant} text here…`}
            aria-label={`${variant} text for seeded Wordiness games`}
          />
          {variant === "supported" && !supportedText.trim() && standardText.trim() && (
            <div className={styles.hint}>Supported text is currently falling back to Standard. Type here to create a separate Supported route.</div>
          )}

          <div className={styles.toolbar} role="search" aria-label="Find a Wordiness activity">
            <input className={styles.input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activities…" />
            <select className={styles.select} value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
              <option value="">All skills</option>
              {allTags.map((tag) => <option key={tag} value={tag}>{tagLabel(tag)}</option>)}
            </select>
            <button type="button" className={styles.secondary} onClick={() => { setQuery(""); setSelectedTag(""); }} disabled={!query && !selectedTag}>
              Clear filters
            </button>
          </div>
        </section>

        <div className={styles.results}>
          <span>Showing <strong>{filteredGames.length}</strong> of {groupedGames.length} activities</span>
          <span>{games.length} live game files detected</span>
        </div>

        {loadError ? (
          <section className={styles.empty} role="alert">
            <h2>Wordiness library could not be loaded</h2>
            <p>Check the imported files under public/wordiness and retry.</p>
          </section>
        ) : filteredGames.length === 0 ? (
          <section className={styles.empty}><h2>No matching activities</h2><p>Try a different search word or skill filter.</p></section>
        ) : (
          <section className={styles.grid} aria-label="Wordiness activities">
            {filteredGames.map((game) => {
              const base = game.base;
              const seeded = game.seeded;
              return (
                <article className={styles.card} key={game.key}>
                  <h2>{game.title}</h2>
                  <p>{game.desc || "Focused language practice activity."}</p>
                  <div className={styles.tags}>{game.tags.slice(0, 7).map((tag) => <span className={styles.tag} key={tag}>{tagLabel(tag)}</span>)}</div>
                  <div className={styles.actions}>
                    {base && <button type="button" className={styles.button} onClick={() => launch(base)}>Open game</button>}
                    {seeded && (
                      <button type="button" className={`${styles.button} ${styles.seeded}`} onClick={() => launch(seeded, true)} disabled={!hasActiveSeed}>
                        Use {variant === "supported" ? "Supported" : "Standard"} text
                      </button>
                    )}
                    {!base && seeded && !hasActiveSeed && <span className={styles.hint}>Add text above to unlock</span>}
                  </div>
                  <div className={styles.fileCount}>{game.files.length} file{game.files.length === 1 ? "" : "s"}</div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
