import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { VitalDto } from 'src/app/core/models/encounter.model';

/**
 * Step 0 — Vitals.
 *
 * Renders the 10-field grid that mirrors the web Vitals step. Writes
 * back to EncounterStore which debounces a single PUT/POST to
 * /api/patients/{pid}/vitals[/{vid}]. BMI is derived automatically
 * from weight + height (US customary units).
 *
 * Hints (min/max) come from ehr-system/wwwroot/js/modules/encounters/
 * EncounterWorkspaceModule.js:_renderVitalsStep().
 */
@Component({
  selector: 'app-step-vitals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pane">
      <h2 class="title">Vitals</h2>
      <p class="muted small">Enter manually or use AI Voice Entry. BMI is calculated automatically.</p>

      <div class="grid">
        <label class="vital">
          <span class="lbl">Systolic BP</span>
          <div class="input"><input type="number" inputmode="numeric" min="60" max="300"
                 [ngModel]="v()?.systolicBp"
                 (ngModelChange)="patch({ systolicBp: num($event) })" /><span>mmHg</span></div>
        </label>

        <label class="vital">
          <span class="lbl">Diastolic BP</span>
          <div class="input"><input type="number" inputmode="numeric" min="30" max="200"
                 [ngModel]="v()?.diastolicBp"
                 (ngModelChange)="patch({ diastolicBp: num($event) })" /><span>mmHg</span></div>
        </label>

        <label class="vital">
          <span class="lbl">Heart Rate</span>
          <div class="input"><input type="number" inputmode="numeric" min="20" max="300"
                 [ngModel]="v()?.heartRate"
                 (ngModelChange)="patch({ heartRate: num($event) })" /><span>bpm</span></div>
        </label>

        <label class="vital">
          <span class="lbl">Temperature</span>
          <div class="input"><input type="number" inputmode="decimal" step="0.1" min="90" max="110"
                 [ngModel]="v()?.temperature"
                 (ngModelChange)="patch({ temperature: num($event) })" /><span>°F</span></div>
        </label>

        <label class="vital">
          <span class="lbl">SpO<sub>2</sub></span>
          <div class="input"><input type="number" inputmode="numeric" min="50" max="100"
                 [ngModel]="v()?.spo2"
                 (ngModelChange)="patch({ spo2: num($event) })" /><span>%</span></div>
        </label>

        <label class="vital">
          <span class="lbl">Respiratory Rate</span>
          <div class="input"><input type="number" inputmode="numeric" min="4" max="60"
                 [ngModel]="v()?.respiratoryRate"
                 (ngModelChange)="patch({ respiratoryRate: num($event) })" /><span>/min</span></div>
        </label>

        <label class="vital">
          <span class="lbl">Weight</span>
          <div class="input"><input type="number" inputmode="decimal" step="0.1" min="1" max="1000"
                 [ngModel]="v()?.weight"
                 (ngModelChange)="patch({ weight: num($event) })" /><span>lbs</span></div>
        </label>

        <label class="vital">
          <span class="lbl">Height</span>
          <div class="input"><input type="number" inputmode="decimal" step="0.1" min="10" max="120"
                 [ngModel]="v()?.height"
                 (ngModelChange)="patch({ height: num($event) })" /><span>in</span></div>
        </label>

        <label class="vital highlight">
          <span class="lbl">BMI <span class="muted-soft">auto</span></span>
          <div class="input"><input type="text" [value]="bmiDisplay()" readonly /><span>kg/m²</span></div>
        </label>

        <label class="vital">
          <span class="lbl">Pain <span class="muted-soft">0–10</span></span>
          <div class="input"><input type="number" inputmode="numeric" min="0" max="10"
                 [ngModel]="v()?.painScore"
                 (ngModelChange)="patch({ painScore: num($event) })" /><span>/10</span></div>
        </label>
      </div>

      @if (lastHistorical(); as h) {
        <div class="section-head"><h3>Previous visit</h3></div>
        <div class="prev">
          <div><span>BP</span><strong>{{ bp(h) }}</strong></div>
          <div><span>HR</span><strong>{{ h.heartRate ?? '—' }}</strong></div>
          <div><span>Temp</span><strong>{{ h.temperature ?? '—' }}{{ h.temperature != null ? '°F' : '' }}</strong></div>
          <div><span>BMI</span><strong>{{ h.bmi ?? '—' }}</strong></div>
        </div>
      }
    </div>
  `,
  styles: [`
    .pane { padding: 16px 16px 100px; max-width: 640px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 2px; letter-spacing: -0.01em; }
    .muted { color: var(--imehr-text-2); margin: 0 0 14px; }
    .muted-soft { color: var(--imehr-text-3); font-weight: 500; }
    .small { font-size: 13px; }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .vital {
      background: var(--ion-item-background);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
      padding: 10px 12px;
      display: block;
    }
    .vital.highlight { background: var(--imehr-primary-50); border-color: var(--imehr-primary-100); }
    .vital .lbl {
      display: block;
      font-size: 11.5px;
      color: var(--imehr-text-3);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .input {
      display: flex;
      align-items: baseline;
      gap: 6px;
    }
    .input input {
      border: 0;
      outline: 0;
      background: transparent;
      font-family: inherit;
      font-size: 20px;
      font-weight: 700;
      color: var(--ion-text-color);
      width: 100%;
      min-width: 0;
      padding: 0;
      -webkit-appearance: none;
      appearance: none;
    }
    .input input[readonly] { color: var(--ion-color-primary); }
    .input span {
      font-size: 11px;
      color: var(--imehr-text-3);
      font-weight: 500;
      flex-shrink: 0;
    }

    .section-head { margin: 16px 4px 8px; }
    .section-head h3 { font-size: 14px; margin: 0; font-weight: 700; }

    .prev {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .prev > div {
      background: var(--imehr-surface-2);
      border: 1px solid var(--imehr-border);
      border-radius: 10px;
      padding: 8px 4px;
      text-align: center;
    }
    .prev span {
      display: block;
      font-size: 10.5px;
      color: var(--imehr-text-3);
      font-weight: 700;
      text-transform: uppercase;
    }
    .prev strong { font-size: 14px; color: var(--ion-text-color); }
  `],
})
export class StepVitalsComponent {
  private readonly store = inject(EncounterStore);

  readonly v = this.store.vitals;

  readonly bmiDisplay = computed(() => {
    const b = this.store.vitals()?.bmi;
    return b != null ? b.toFixed(1) : '';
  });

  readonly lastHistorical = computed(() => {
    // Most recent historical vital that isn't this encounter's.
    const encId = this.store.encounter()?.encounterId;
    const all = this.store.historicalVitals()
      .filter((x) => x.encounterId !== encId);
    if (all.length === 0) return null;
    // Prefer the latest by recordedAt, fall back to array order (server usually desc).
    return all.reduce((latest, cur) => {
      const lt = latest.recordedAt ? Date.parse(latest.recordedAt) : 0;
      const ct = cur.recordedAt ? Date.parse(cur.recordedAt) : 0;
      return ct > lt ? cur : latest;
    }, all[0]);
  });

  patch(change: Partial<VitalDto>): void {
    this.store.patchVitals(change);
  }

  /** Coerce form input (HTML input emits string) into a number or null. */
  num(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  bp(h: VitalDto): string {
    if (h.systolicBp == null && h.diastolicBp == null) return '—';
    return `${h.systolicBp ?? '?'}/${h.diastolicBp ?? '?'}`;
  }
}
