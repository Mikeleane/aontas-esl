export type ReadingMode = "standard" | "SUPPORTED";

export type ExerciseSide = {
  prompt: string;
  options?: string[];
};

export type ExerciseItem = {
  id: number | string;
  type: string;
  skill?: string;

  // Shared answer key (same for Standard + Supported)
  answer: any;
  answerIndex?: number;

  standard: ExerciseSide;
  SUPPORTED?: ExerciseSide;

  // Legacy alias
  adapted?: ExerciseSide;
};

// --- Materials ingestion + teacher context (future wiring) ---
// This matches the “Materials → Curriculum/Context → Generate/Export” workflow spec. :contentReference[oaicite:0]{index=0}
export type MaterialType = "link" | "text" | "image" | "pdf" | "docx" | "other";

export type Material = {
  id: string;
  type: MaterialType;
  title: string;

  // original inputs
  url?: string;
  rawText?: string;

  // files
  fileName?: string;
  mimeType?: string;
  fileDataUrl?: string; // for image preview / local persistence

  // extraction
  extractedText?: string;
  extractionStatus: "none" | "processing" | "done" | "needs_review" | "failed";

  // teacher choice
  useAsPrimaryText: boolean;
};

export type TeacherContext = {
  contextTags: string[];
  crossCurricularLinks: string[];
  authenticMaterialTypes: string[];

  localVocab: string; // newline-separated
  localGlossary: Array<{ term: string; note: string }>;

  useLocalContextExactly: boolean; // default true
  onlyUseProvidedFacts: boolean; // default true
};

export type ReadingPackData = {
  title: string;
  schoolClass?: number;
  stage?: number;

  // Prefer embedding as data URL for offline exports
  crest?: string;

  reading: {
    standard: string;
    SUPPORTED: string;
  };

  exercises: ExerciseItem[];

  // optional future extensions
  materials?: Material[];
  primaryMaterialId?: string;
  teacherContext?: TeacherContext;

  // pilot/internal use flag (non-blocking)
  pilotMode?: boolean;
};
