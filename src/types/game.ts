export type GameMode = 'ADVENTURE' | 'CONTEST';

export type InputModality = 'VOICE' | 'STYLUS' | 'KEYBOARD';

export type WordRole = 'ANCHOR' | 'GUIDED' | 'TRANSFER_PROBE';

export type ErrorBucket =
  | 'NONE'
  | 'ASR_SUSPECT'
  | 'UK_US_VARIANT_TRAP'
  | 'PHONETIC_PATTERN_ERROR'
  | 'AFFIX_JUNCTION_ERROR'
  | 'SYLLABLE_OMISSION'
  | 'MOTOR_SLIP';

export interface GraphemeChunk {
  grapheme: string;        // e.g., "kn", "ow", "l", "edge"
  phoneme: string;         // e.g., "/n/", "/ɒ/", "/l/", "/ɪdʒ/"
  startIndex: number;      // 0-indexed start letter position
  endIndex: number;        // 0-indexed inclusive end letter position
  isPatternFocus?: boolean;
  coachingHint?: string;   // Spoken by the Judge when this specific chunk mismatches
}

export interface WordTrap {
  misspelling: string;               // e.g., "practise" or "misterious"
  bucket: ErrorBucket;
  errorTileIndex: number;            // 0-indexed tile to highlight on the Sudoku board
  candidatePair?: [string, string];  // e.g., ["C", "S"] or ["Y", "I"] for Twin-Choice UI
  judgeResponse: string;             // Conversational Judge coaching line
  memoryTrick: string;               // Kid-friendly visual hook
}

export interface WordMeaning {
  partOfSpeech: 'noun' | 'verb' | 'adjective' | 'adverb';
  kidDefinition: string;             // Written for a 5-8 year-old comprehension level
  exampleSentence: string;           // Sentence spoken by the Judge
  blankedSentence: string;           // Displayed on screen with target word masked
}

export interface BeeWord {
  id: string;
  word: string;                      // Lowercase canonical US spelling
  syllables: string[];               // ["mys", "te", "ri", "ous"]
  phoneticRespelling: string;        // "mis-TEER-ee-us"
  difficulty: number;                // 1.0 (Easy) to 5.0 (Championship), 2.2 = CII Baseline
  patternId: string;                 // Links to PatternNode.patternId
  role: WordRole;                    // ANCHOR, GUIDED, or quarantined TRANSFER_PROBE
  meanings: WordMeaning[];
  graphemeMap: GraphemeChunk[];
  traps: WordTrap[];
  wordStory: string;                 // Optional 0-point etymology/fun fact for Curiosity Index
}

export interface PatternNode {
  patternId: string;
  title: string;
  badgeName: string;
  kidRule: string;
  recognitionCheck: {
    question: string;
    correctAnswer: string;
    distractors: string[];
  };
  anchorWordIds: string[];
  guidedWordIds: string[];
  transferProbeIds: string[];        // Strictly quarantined until recognitionPassed === true
  kind?: string;                     // Hidden grouping for the engine and parent report (never a menu)
  secret?: string;                   // One plain sentence a child can read: what makes this family's words tricky
}

export interface PatternMasteryState {
  patternId: string;
  recallScore: number;               // 0.0 to 1.0 across anchor/guided words
  recognitionPassed: boolean;        // Passed the post-word Pattern Detective question
  recognitionPassedAt?: number;      // Epoch ms (used to enforce >=24h delay before Transfer Probe)
  transferAttempts: number;
  transferSuccesses: number;
  recentPatternErrors: number;       // Count in rolling 10 opportunities (>=2 flags weakness)
  status: 'UNSEEN' | 'RECALL_ONLY' | 'RECOGNIZED' | 'TRANSFERRED' | 'NEEDS_COACHING';
}

export interface TileInputState {
  index: number;
  letter: string;                    // Uppercase A-Z or ''
  pencilCandidates: string[];        // Sudoku-style corner notes, e.g., ['C', 'S']
  modality: InputModality;
  asrConfidence?: number;
  asrAlternatives?: string[];        // Top-5 Web Speech N-best letter candidates
  isLockedHint?: boolean;
  isAsrSuspect?: boolean;
}

export interface CuriosityTelemetry {
  totalWordsSeen: number;
  voluntaryDefinitionRequests: number;
  voluntarySentenceRequests: number;
  voluntarySlowAudioRequests: number;
  wordStoriesOpened: number;         // Zero-point optional fun facts opened
  stretchWordsOffered: number;
  stretchWordsAccepted: number;
  thoughtfulEditsCount: number;      // Used pencil notes or edited tile before submitting
}

/** Casual-learning flash card: a funny sentence that hides a spelling hook inside the word. */
export interface WordCard {
  wordId: string;
  emoji: string;                     // Placeholder scene until real illustrations exist
  hook: string;                      // Smaller word hiding inside the target, e.g. "ice" in practice
  synonyms: string[];
  sentence: string;                  // *asterisks* mark the word and its hook
}
