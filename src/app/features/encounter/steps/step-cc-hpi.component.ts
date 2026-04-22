import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';

/**
 * Step 2 — Chief Complaint + History of Present Illness.
 * Two free-text fields that autosave to /api/patients/{pid}/encounters/{eid}
 * via EncounterStore.patchCcHpi() (1.2 s debounce).
 * The Unified Voice Bar above this step will also write here when it
 * extracts a `chiefComplaint` / `historyOfPresentIllness` from the transcript.
 */
@Component({
  selector: 'app-step-cc-hpi',
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
  template: `
    <div class="pane">
      <h2 class="title">CC &amp; HPI</h2>
      <p class="muted small">Speak naturally with AI Scribe or type directly — both save automatically.</p>

      <label class="field">
        <span class="field-label">Chief Complaint</span>
        <div class="imehr-field">
          <ion-icon name="chatbubble-outline"></ion-icon>
          <input
            type="text"
            maxlength="500"
            [ngModel]="cc()"
            (ngModelChange)="onCc($event)"
            placeholder="e.g. Follow-up for hypertension"
          />
        </div>
      </label>

      <div class="note-section">
        <label class="section-label">History of Present Illness</label>
        <textarea
          rows="10"
          [ngModel]="hpi()"
          (ngModelChange)="onHpi($event)"
          placeholder="Narrative history — onset, duration, severity, modifying factors, related symptoms…"
        ></textarea>
      </div>

      <div class="hint">
        <ion-icon name="sparkles-outline"></ion-icon>
        <div>
          <p><strong>AI Voice Entry</strong></p>
          <p class="muted small">Use the mic above and narrate the visit — AI will organise Chief Complaint and HPI for you.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pane { padding: 16px 16px 100px; max-width: 640px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 2px; letter-spacing: -0.01em; }
    .muted { color: var(--imehr-text-2); }
    .small { font-size: 13px; margin: 0 0 14px; }

    .field { display: block; margin-bottom: 14px; }
    .field-label {
      display: block;
      font-size: 12.5px;
      color: var(--imehr-text-2);
      font-weight: 500;
      margin-bottom: 6px;
    }

    .note-section { margin-bottom: 14px; }
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
      min-height: 160px;
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

    .hint {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      padding: 12px 14px;
      background: var(--imehr-primary-50);
      border-radius: var(--imehr-radius);
      margin-top: 14px;
    }
    .hint ion-icon { color: var(--ion-color-primary); font-size: 22px; flex-shrink: 0; }
    .hint p { margin: 0; font-size: 13.5px; }
    .hint p + p { margin-top: 2px; }
  `],
})
export class StepCcHpiComponent {
  private readonly store = inject(EncounterStore);

  readonly cc  = computed(() => this.store.encounter()?.chiefComplaint ?? '');
  readonly hpi = computed(() => this.store.encounter()?.historyOfPresentIllness ?? '');

  onCc(v: string): void {
    this.store.patchCcHpi({ chiefComplaint: v });
  }
  onHpi(v: string): void {
    this.store.patchCcHpi({ historyOfPresentIllness: v });
  }
}
