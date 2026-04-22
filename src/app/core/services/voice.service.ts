import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';
import {
  ProcessChunkResponse, VoiceSession, VoiceStatus, VoiceTabKey,
} from '../models/voice.model';

/**
 * MEDOCS Voice / AI Scribe client.
 *
 *   - Uses `capacitor-voice-recorder` which wraps native AVAudioRecorder / MediaRecorder
 *     on iOS / Android and falls back to Web's MediaRecorder in the browser.
 *   - Chunk rotation: every `environment.voiceRecorder.chunkMs` we stop → upload →
 *     restart so the user sees transcription fill in progressively. capacitor-voice-recorder
 *     doesn't expose mid-recording data frames, so stop+start is the supported pattern.
 *   - Uploads are multipart to `POST /api/medocs-voice/process-chunk`. The server
 *     returns `{ transcription, extractedData }`; callers wire `onChunk(resp)` so a
 *     store (EncounterStore) can patch vitals / CC / HPI fields.
 *   - A KeepAwake wake-lock prevents the device from sleeping while recording.
 *
 * The service exposes signals — no streams — so templates can bind directly
 * without pipes.
 */
@Injectable({ providedIn: 'root' })
export class VoiceService {
  private readonly http = inject(HttpClient);
  private readonly log = inject(LoggerService);
  private readonly base = environment.apiBaseUrl;

  /* ============================================================
     Reactive state
     ============================================================ */
  readonly status = signal<VoiceStatus>('idle');
  readonly session = signal<VoiceSession | null>(null);
  readonly transcript = signal<string>('');
  readonly errorMsg = signal<string | null>(null);

  /* ============================================================
     Internal
     ============================================================ */
  private rotationTimer: number | null = null;
  private clockTimer: number | null = null;
  private currentChunkStartedAt = 0;
  private chunkInFlight: Promise<void> | null = null;
  private isRecorderActive = false;
  private handleChunkResponse: ((resp: ProcessChunkResponse) => void) | null = null;

  /** One-time permission probe. Safe to call multiple times. */
  async requestPermission(): Promise<boolean> {
    try {
      const res = await VoiceRecorder.requestAudioRecordingPermission();
      return !!res?.value;
    } catch (e) {
      this.log.warn('Voice', 'permission request failed', e);
      return false;
    }
  }

  async hasPermission(): Promise<boolean> {
    try {
      const r = await VoiceRecorder.hasAudioRecordingPermission();
      return !!r?.value;
    } catch {
      return false;
    }
  }

  async canRecord(): Promise<boolean> {
    try {
      const r = await VoiceRecorder.canDeviceVoiceRecord();
      return !!r?.value;
    } catch {
      return false;
    }
  }

  /* ============================================================
     Start / stop
     ============================================================ */
  async start(
    ctx: { tabKey: VoiceTabKey; patientId: number; encounterId?: number | null },
    onChunk: (resp: ProcessChunkResponse) => void,
  ): Promise<boolean> {
    if (this.status() === 'recording' || this.status() === 'starting') return false;
    this.errorMsg.set(null);
    this.handleChunkResponse = onChunk;

    // Permission gate
    this.status.set('requesting-permission');
    const granted = (await this.hasPermission()) || (await this.requestPermission());
    if (!granted) {
      this.status.set('permission-denied');
      this.errorMsg.set('Microphone permission is required for AI Scribe.');
      return false;
    }

    // Capability check
    const ok = await this.canRecord();
    if (!ok) {
      this.status.set('error');
      this.errorMsg.set('This device cannot record audio.');
      return false;
    }

    this.status.set('starting');

    // Initialize session
    this.session.set({
      tabKey: ctx.tabKey,
      startedAt: Date.now(),
      sequenceNumber: 0,
      totalSeconds: 0,
      transcript: '',
    });
    this.transcript.set('');

    // Begin recording + keep device awake
    try {
      await VoiceRecorder.startRecording();
      this.isRecorderActive = true;
      this.currentChunkStartedAt = Date.now();
      await this.tryKeepAwake(true);
    } catch (e) {
      this.log.warn('Voice', 'startRecording failed', e);
      this.status.set('error');
      this.errorMsg.set('Could not start recording.');
      this.isRecorderActive = false;
      return false;
    }

    this.status.set('recording');
    this.scheduleRotation(ctx);
    this.scheduleClock();
    return true;
  }

  /** Stop the session, flush the final chunk. */
  async stop(ctx: { patientId: number; encounterId?: number | null }): Promise<void> {
    if (this.status() !== 'recording') return;
    this.status.set('processing');
    this.clearTimers();
    await this.flushFinalChunk(ctx);
    await this.tryKeepAwake(false);
    this.handleChunkResponse = null;
    this.status.set('idle');
  }

  /** Called by the UI when leaving the encounter mid-session. */
  async cancel(): Promise<void> {
    this.clearTimers();
    if (this.isRecorderActive) {
      try { await VoiceRecorder.stopRecording(); } catch { /* ignore */ }
      this.isRecorderActive = false;
    }
    await this.tryKeepAwake(false);
    this.status.set('idle');
    this.session.set(null);
    this.transcript.set('');
    this.handleChunkResponse = null;
  }

  /* ============================================================
     Rotation + clock
     ============================================================ */
  private scheduleRotation(ctx: { tabKey: VoiceTabKey; patientId: number; encounterId?: number | null }): void {
    if (this.rotationTimer != null) clearInterval(this.rotationTimer);
    this.rotationTimer = window.setInterval(() => {
      void this.rotate(ctx);
    }, environment.voiceRecorder.chunkMs);
  }

  private scheduleClock(): void {
    if (this.clockTimer != null) clearInterval(this.clockTimer);
    this.clockTimer = window.setInterval(() => {
      const s = this.session();
      if (!s) return;
      this.session.set({ ...s, totalSeconds: Math.round((Date.now() - s.startedAt) / 1000) });
      // Hard safety cap
      if (Date.now() - s.startedAt >= environment.voiceRecorder.maxSessionMs) {
        this.log.warn('Voice', 'hit max session cap — auto-stopping');
        void this.stop({ patientId: 0 }); // patientId unused for stop if chunk pipeline handles it
      }
    }, 1000);
  }

  private clearTimers(): void {
    if (this.rotationTimer != null) { clearInterval(this.rotationTimer); this.rotationTimer = null; }
    if (this.clockTimer != null) { clearInterval(this.clockTimer); this.clockTimer = null; }
  }

  /**
   * Rotate: stop → grab recording → restart → upload previous chunk.
   * If an upload is already in flight, we skip this rotation (back-pressure).
   */
  private async rotate(ctx: { tabKey: VoiceTabKey; patientId: number; encounterId?: number | null }): Promise<void> {
    if (!this.isRecorderActive) return;
    if (this.chunkInFlight) return; // skip, we're still uploading

    const chunkStartedAt = this.currentChunkStartedAt;
    let result: { value?: { recordDataBase64?: string; mimeType?: string; msDuration?: number } };
    try {
      result = await VoiceRecorder.stopRecording();
    } catch (e) {
      this.log.warn('Voice', 'rotate stop failed', e);
      return;
    }
    this.isRecorderActive = false;

    try {
      await VoiceRecorder.startRecording();
      this.isRecorderActive = true;
      this.currentChunkStartedAt = Date.now();
    } catch (e) {
      this.log.warn('Voice', 'rotate restart failed — session ends', e);
      this.status.set('error');
      this.errorMsg.set('Microphone dropped out. Please try again.');
      return;
    }

    const data = result?.value;
    if (!data?.recordDataBase64) return;

    this.chunkInFlight = this.uploadChunk({
      base64: data.recordDataBase64,
      mimeType: data.mimeType ?? 'audio/aac',
      durationSeconds: Math.round(((data.msDuration ?? (Date.now() - chunkStartedAt)) / 1000)),
      tabKey: ctx.tabKey,
      patientId: ctx.patientId,
      encounterId: ctx.encounterId ?? null,
    }).finally(() => { this.chunkInFlight = null; });
  }

  private async flushFinalChunk(ctx: { patientId: number; encounterId?: number | null }): Promise<void> {
    if (!this.isRecorderActive) return;
    const s = this.session();
    const chunkStartedAt = this.currentChunkStartedAt;
    let result: { value?: { recordDataBase64?: string; mimeType?: string; msDuration?: number } };
    try {
      result = await VoiceRecorder.stopRecording();
    } catch (e) {
      this.log.warn('Voice', 'final stop failed', e);
      this.isRecorderActive = false;
      return;
    }
    this.isRecorderActive = false;

    const data = result?.value;
    if (!data?.recordDataBase64 || !s) return;

    if (this.chunkInFlight) { try { await this.chunkInFlight; } catch { /* ignore */ } }

    await this.uploadChunk({
      base64: data.recordDataBase64,
      mimeType: data.mimeType ?? 'audio/aac',
      durationSeconds: Math.round(((data.msDuration ?? (Date.now() - chunkStartedAt)) / 1000)),
      tabKey: s.tabKey,
      patientId: ctx.patientId,
      encounterId: ctx.encounterId ?? null,
    });
  }

  /* ============================================================
     Upload
     ============================================================ */
  private async uploadChunk(payload: {
    base64: string;
    mimeType: string;
    durationSeconds: number;
    tabKey: VoiceTabKey;
    patientId: number;
    encounterId: number | null;
  }): Promise<void> {
    const s = this.session();
    if (!s) return;
    const seq = s.sequenceNumber + 1;
    this.session.set({ ...s, sequenceNumber: seq, lastChunkAt: Date.now() });

    const blob = base64ToBlob(payload.base64, payload.mimeType);
    const form = new FormData();
    form.append('audio', blob, `chunk-${seq}.${mimeToExt(payload.mimeType)}`);
    form.append('tabKey', payload.tabKey);
    form.append('sequenceNumber', String(seq));
    form.append('durationSeconds', String(payload.durationSeconds));
    form.append('patientId', String(payload.patientId));
    if (payload.encounterId != null) form.append('encounterId', String(payload.encounterId));
    if (this.transcript()) form.append('previousContext', this.transcript().slice(-800));

    try {
      const resp = await firstValueFrom(
        this.http.post<ProcessChunkResponse>(
          `${this.base}/api/medocs-voice/process-chunk`,
          form,
        ),
      );
      if (resp?.transcription) {
        const combined = (this.transcript() + ' ' + resp.transcription).trim();
        this.transcript.set(combined);
        const cur = this.session();
        if (cur) this.session.set({ ...cur, transcript: combined });
      }
      this.handleChunkResponse?.(resp);
    } catch (e) {
      this.log.warn('Voice', `chunk ${seq} upload failed`, e);
    }
  }

  /* ============================================================
     Power
     ============================================================ */
  private async tryKeepAwake(on: boolean): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (on) await KeepAwake.keepAwake();
      else    await KeepAwake.allowSleep();
    } catch (e) {
      this.log.debug('Voice', 'KeepAwake ignored', e);
    }
  }
}

/* ============================================================
   Utilities
   ============================================================ */
function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function mimeToExt(mime: string): string {
  if (mime.includes('webm'))  return 'webm';
  if (mime.includes('ogg'))   return 'ogg';
  if (mime.includes('wav'))   return 'wav';
  if (mime.includes('mp4'))   return 'm4a';
  if (mime.includes('aac'))   return 'aac';
  return 'bin';
}

/** Also exported for tests. */
export { base64ToBlob as __base64ToBlob };
