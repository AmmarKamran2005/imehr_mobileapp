import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { VoiceService } from 'src/app/core/services/voice.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import {
  NOTE_STATUS_LABELS, NOTE_TYPE_LABELS, NoteStatus, NoteType,
} from 'src/app/core/models/clinical-note.model';
import { ReferenceDrawerComponent } from '../components/reference-drawer.component';

/**
 * Step 3 — Clinical Note.
 *
 *   ⬌ Reference drawer (vitals / problems / CC · HPI summary — collapsible)
 *   ⬌ Template picker (SOAP / H&P / Progress / …)
 *   ⬌ Write Note / Record Session action row
 *   ⬌ 4-section SOAP editor (Subjective / Objective / Assessment / Plan)
 *   ⬌ Prior notes chip list for this appointment
 *
 * Record Session reuses VoiceService with `tabKey='note'` so the backend
 * drafts a full SOAP body and extractedData flows back into the sections
 * via `EncounterStore.applyVoiceChunk()`.
 *
 * Signing lives in the Checkout step (Phase 7) — this step only produces
 * drafts (NoteStatus.Draft).
 */
@Component({
  selector: 'app-step-note',
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon, ReferenceDrawerComponent],
  template: `
    <div class="pane">
      <h2 class="title">Clinical Note</h2>

      @if (!canEdit()) {
        <div class="readonly-hint">
          <ion-icon name="lock-closed-outline"></ion-icon>
          <p>Clinical notes are authored by the provider. You can view drafts below.</p>
        </div>
      }

      <app-reference-drawer></app-reference-drawer>

      <!-- Template picker -->
      <label class="field">
        <span class="field-label">Template</span>
        <div class="imehr-field select">
          <ion-icon name="document-text-outline"></ion-icon>
          <select
            [ngModel]="noteType()"
            (ngModelChange)="onTypeChange(+$event)"
            [disabled]="!canEdit()"
          >
            @for (opt of typeOptions; track opt.value) {
              <option [ngValue]="opt.value">{{ opt.label }}</option>
            }
          </select>
          <ion-icon name="chevron-down"></ion-icon>
        </div>
      </label>

      <!-- Action row: Write Note focus + Record Session -->
      @if (canEdit()) {
        <div class="actions">
          <button class="btn btn-secondary" (click)="focusSubjective()">
            <ion-icon name="create-outline"></ion-icon> Write Note
          </button>
          <button class="btn" [class.btn-primary]="!recording()" [class.btn-stop]="recording()" (click)="toggleRecordSession()">
            <ion-icon [name]="recording() ? 'stop' : 'mic'"></ion-icon>
            {{ recording() ? 'Stop' : 'Record Session' }}
          </button>
        </div>
      }

      <!-- Recording banner (visible while recording on this step) -->
      @if (recording()) {
        <div class="rec-banner">
          <span class="dot"></span>
          <div class="body">
            <p class="lead">Recording the session…</p>
            <p class="meta">
              {{ duration() }} · chunk {{ session()?.sequenceNumber ?? 0 }}
              @if (transcript()) { · AI is drafting as you speak }
            </p>
          </div>
          <button class="stop-btn" (click)="toggleRecordSession()" aria-label="Stop recording">
            <ion-icon name="stop"></ion-icon>
          </button>
        </div>
        @if (transcript()) {
          <details class="transcript">
            <summary>Live transcription</summary>
            <p>{{ transcript() }}</p>
          </details>
        }
      }

      <!-- SOAP sections -->
      <div class="section">
        <label class="section-label">Subjective</label>
        <textarea
          #subjectiveField
          rows="4"
          [ngModel]="sections().subjective"
          (ngModelChange)="patch('subjective', $event)"
          [readonly]="!canEdit()"
          placeholder="Chief concerns, HPI narrative, patient-reported symptoms…"
        ></textarea>
      </div>

      <div class="section">
        <label class="section-label">Objective</label>
        <textarea
          rows="4"
          [ngModel]="sections().objective"
          (ngModelChange)="patch('objective', $event)"
          [readonly]="!canEdit()"
          placeholder="Vitals, exam findings, lab / imaging results…"
        ></textarea>
      </div>

      <div class="section">
        <label class="section-label">Assessment</label>
        <textarea
          rows="3"
          [ngModel]="sections().assessment"
          (ngModelChange)="patch('assessment', $event)"
          [readonly]="!canEdit()"
          placeholder="Diagnoses, differential, clinical reasoning…"
        ></textarea>
      </div>

      <div class="section">
        <label class="section-label">Plan</label>
        <textarea
          rows="3"
          [ngModel]="sections().plan"
          (ngModelChange)="patch('plan', $event)"
          [readonly]="!canEdit()"
          placeholder="Treatment plan, medications, follow-up…"
        ></textarea>
      </div>

      <!-- Prior notes for this appointment -->
      @if (priorNotesOther().length) {
        <p class="pd-sec-title">Prior notes · this appointment</p>
        <ul class="prior">
          @for (n of priorNotesOther(); track n.clinicalNoteId) {
            <li>
              <div class="prior-main">
                <strong>{{ typeLabel(n.type) }}</strong>
                <span class="muted small">{{ (n.updatedAt ?? n.createdAt) | date:'MMM d · h:mm a' }}</span>
              </div>
              <span class="chip" [class.signed]="n.status === 2" [class.draft]="n.status === 0">
                {{ statusLabel(n.status) }}
              </span>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .pane { padding: 16px 16px 100px; max-width: 640px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 8px; letter-spacing: -0.01em; }

    .readonly-hint {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(217, 119, 6, 0.08);
      border: 1px solid rgba(217, 119, 6, 0.2);
      border-radius: var(--imehr-radius);
      color: var(--ion-color-warning);
      margin-bottom: 12px;
      font-size: 13px;
    }
    .readonly-hint ion-icon { font-size: 18px; flex-shrink: 0; }
    .readonly-hint p { margin: 0; }

    .field { display: block; margin-bottom: 12px; }
    .field-label {
      display: block;
      font-size: 12.5px;
      color: var(--imehr-text-2);
      font-weight: 500;
      margin-bottom: 6px;
    }
    .imehr-field {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 14px;
      background: var(--ion-item-background);
      border: 1.5px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
    }
    .imehr-field ion-icon { color: var(--imehr-text-3); font-size: 18px; }
    .imehr-field.select { padding-right: 10px; }
    .imehr-field select {
      flex: 1;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--ion-text-color);
      padding: 14px 0;
      font-size: 15px;
      font-family: inherit;
      -webkit-appearance: none;
      appearance: none;
    }

    .actions {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .actions .btn { flex: 1; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 16px;
      border-radius: var(--imehr-radius);
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .btn ion-icon { font-size: 18px; }
    .btn-primary {
      background: var(--ion-color-primary);
      color: #fff;
      box-shadow: 0 4px 14px rgba(11, 99, 206, 0.3);
    }
    .btn-secondary {
      background: var(--ion-item-background);
      color: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }
    .btn-stop {
      background: var(--ion-color-danger);
      color: #fff;
      box-shadow: 0 4px 14px rgba(220, 38, 38, 0.35);
    }

    .rec-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(220, 38, 38, 0.08);
      border: 1px solid rgba(220, 38, 38, 0.22);
      border-radius: var(--imehr-radius);
      margin-bottom: 12px;
    }
    .rec-banner .dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: var(--ion-color-danger);
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse { 50% { opacity: 0.35; } }
    .rec-banner .body { flex: 1; min-width: 0; }
    .rec-banner .lead { margin: 0; font-weight: 700; font-size: 13.5px; color: var(--ion-color-danger); }
    .rec-banner .meta { margin: 2px 0 0; font-size: 11.5px; color: var(--imehr-text-2); }
    .rec-banner .stop-btn {
      background: var(--ion-color-danger);
      color: #fff;
      border: 0;
      border-radius: 50%;
      width: 36px; height: 36px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .transcript {
      background: var(--imehr-surface-2);
      border-radius: var(--imehr-radius);
      padding: 10px 14px;
      font-size: 13px;
      margin-bottom: 12px;
      color: var(--imehr-text-2);
    }
    .transcript summary { font-weight: 600; cursor: pointer; }
    .transcript p { margin: 6px 0 0; white-space: pre-wrap; }

    .section { margin-bottom: 12px; }
    .section-label {
      display: block;
      font-size: 12px;
      color: var(--imehr-text-3);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 6px;
    }
    textarea {
      width: 100%;
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
      padding: 12px 14px;
      font-family: inherit;
      font-size: 14px;
      line-height: 1.5;
      background: var(--ion-item-background);
      color: var(--ion-text-color);
      resize: vertical;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    textarea:focus {
      outline: 0;
      border-color: var(--ion-color-primary);
      box-shadow: 0 0 0 4px var(--imehr-primary-50);
    }
    textarea[readonly] {
      background: var(--imehr-surface-2);
      color: var(--imehr-text-2);
    }

    .pd-sec-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--imehr-text-3);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin: 16px 0 6px;
    }
    .prior {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 6px;
    }
    .prior li {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px;
      background: var(--ion-item-background);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
    }
    .prior-main { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .prior-main strong { font-size: 13.5px; }
    .prior-main .muted { color: var(--imehr-text-3); }
    .prior-main .small { font-size: 12px; }
    .chip {
      font-size: 10.5px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      background: var(--imehr-surface-2);
      color: var(--imehr-text-3);
    }
    .chip.signed { background: rgba(22, 163, 74, 0.12); color: var(--ion-color-success); }
    .chip.draft  { background: rgba(217, 119, 6, 0.12); color: var(--ion-color-warning); }

    .muted { color: var(--imehr-text-2); }
  `],
})
export class StepNoteComponent {
  private readonly store = inject(EncounterStore);
  private readonly voice = inject(VoiceService);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);

  readonly noteType   = this.store.noteType;
  readonly sections   = this.store.noteSections;
  readonly priorNotes = this.store.priorNotes;

  readonly typeOptions = Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => ({
    value: Number(value) as NoteType,
    label,
  }));

  readonly canEdit = computed(() => this.store.canEditNote());

  /** Voice state surfaced from VoiceService — but only show the banner when
   *  THIS step is driving the recorder (tabKey='note'). */
  readonly recording = computed(() => {
    const s = this.voice.session();
    return s?.tabKey === 'note' && this.voice.status() === 'recording';
  });
  readonly session = this.voice.session;
  readonly transcript = this.voice.transcript;

  readonly duration = computed(() => {
    const s = this.voice.session();
    if (!s) return '00:00';
    const mm = Math.floor(s.totalSeconds / 60).toString().padStart(2, '0');
    const ss = Math.floor(s.totalSeconds % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  /** Prior notes list excluding the one we're currently editing. */
  readonly priorNotesOther = computed(() => {
    const cur = this.store.clinicalNote();
    const id = cur?.clinicalNoteId;
    return this.priorNotes().filter((n) => n.clinicalNoteId !== id);
  });

  constructor() {
    // Small UX nicety: when a voice chunk arrives while recording, open the
    // transcript details so the clinician sees text flowing.
    effect(() => {
      void this.transcript();
    });
  }

  patch(key: 'subjective' | 'objective' | 'assessment' | 'plan', value: string): void {
    this.store.patchNote({ [key]: value });
  }

  onTypeChange(t: NoteType): void {
    this.store.setNoteType(t);
  }

  focusSubjective(): void {
    const ta = document.querySelector<HTMLTextAreaElement>('.pane textarea');
    ta?.focus();
  }

  async toggleRecordSession(): Promise<void> {
    const appt = this.store.appointment();
    const enc  = this.store.encounter();
    if (!appt) return;

    if (this.recording()) {
      await this.voice.stop({ patientId: appt.patientId, encounterId: enc?.encounterId ?? null });
      await this.haptics.light();
      await this.toasts.success('Session saved — AI has drafted your note');
      return;
    }

    // If another tab is recording (shouldn't happen given shell guards, but defend), cancel.
    if (this.voice.status() === 'recording') {
      await this.voice.cancel();
    }

    const ok = await this.voice.start(
      { tabKey: 'note', patientId: appt.patientId, encounterId: enc?.encounterId ?? null },
      (resp) => this.store.applyVoiceChunk(resp),
    );
    if (!ok) {
      if (this.voice.status() === 'permission-denied') {
        await this.toasts.error('Microphone permission is required for Record Session.');
      } else if (this.voice.errorMsg()) {
        await this.toasts.error(this.voice.errorMsg()!);
      }
      return;
    }
    await this.haptics.medium();
  }

  typeLabel(t: NoteType): string {
    return NOTE_TYPE_LABELS[t] ?? 'Note';
  }
  statusLabel(s: NoteStatus): string {
    return NOTE_STATUS_LABELS[s] ?? String(s);
  }
}
