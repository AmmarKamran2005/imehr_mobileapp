/* ============================================================
   Unified Voice Bar / MEDOCS Voice Scribe shapes.
   Matches ehr-system/Controllers/MedocsVoiceController.cs ProcessChunk().
   ============================================================ */

/** Which step's voice bar is sending — drives server-side extraction. */
export type VoiceTabKey = 'vitals' | 'history' | 'cc-hpi' | 'telehealth';

export interface ProcessChunkRequest {
  /** Multipart file — caller builds FormData. */
  audio: Blob;
  mimeType: string;
  tabKey: VoiceTabKey;
  /** Monotonic per recording session. */
  sequenceNumber: number;
  durationSeconds: number;
  /** Last transcription so the AI has continuity across chunks. */
  previousContext?: string;
  patientId: number;
  encounterId?: number | null;
}

/** What the server returns for a processed chunk. */
export interface ProcessChunkResponse {
  success: boolean;
  transcription?: string;
  /** Structured per-tab fields the client should patch into state. */
  extractedData?: Record<string, unknown>;
  sequenceNumber?: number;
  durationSeconds?: number;
  errorMessage?: string;
}

/** UI-facing voice recorder state. */
export type VoiceStatus =
  | 'idle'
  | 'requesting-permission'
  | 'permission-denied'
  | 'starting'
  | 'recording'
  | 'processing'
  | 'error';

export interface VoiceSession {
  tabKey: VoiceTabKey;
  startedAt: number;           // epoch ms
  sequenceNumber: number;      // increments per chunk
  totalSeconds: number;
  transcript: string;          // accumulated
  lastChunkAt?: number;
}
