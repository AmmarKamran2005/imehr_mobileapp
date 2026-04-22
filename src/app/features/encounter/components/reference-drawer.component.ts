import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';

/**
 * Collapsible summary of upstream steps, pinned above the Clinical Note editor
 * so the clinician can verify vitals / history / CC & HPI at a glance without
 * stepping back. Mirrors the web's right-side reference panel, but adapted to
 * a single-column mobile layout.
 */
@Component({
  selector: 'app-reference-drawer',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="drawer" [class.open]="open()">
      <button class="toggle" type="button" (click)="toggle()" [attr.aria-expanded]="open()">
        <ion-icon name="layers-outline"></ion-icon>
        <span>Reference · Vitals, History Review, CC/HPI</span>
        <ion-icon [name]="open() ? 'chevron-up' : 'chevron-down'"></ion-icon>
      </button>

      @if (open()) {
        <div class="body">
          <section>
            <h4>Vitals</h4>
            <p class="muted small">{{ vitalsLine() }}</p>
          </section>

          <section>
            <h4>Problems · Allergies</h4>
            <p class="muted small">
              @if (problemsLine() || allergiesLine()) {
                {{ problemsLine() }}
                @if (problemsLine() && allergiesLine()) { · }
                {{ allergiesLine() }}
              } @else {
                — Not recorded
              }
            </p>
          </section>

          <section>
            <h4>CC &amp; HPI</h4>
            @if (ccLine()) { <p class="small"><strong>CC:</strong> {{ ccLine() }}</p> }
            @if (hpiLine()) { <p class="small"><strong>HPI:</strong> {{ hpiLine() }}</p> }
            @if (!ccLine() && !hpiLine()) { <p class="muted small">— Not recorded</p> }
          </section>
        </div>
      }
    </div>
  `,
  styles: [`
    .drawer {
      background: var(--ion-item-background);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
      margin-bottom: 12px;
      overflow: hidden;
      transition: box-shadow 0.15s ease;
    }
    .drawer.open { box-shadow: var(--imehr-shadow-sm); }

    .toggle {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      background: transparent;
      border: 0;
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
      font-weight: 600;
      color: var(--ion-text-color);
      text-align: left;
    }
    .toggle > span { flex: 1; }
    .toggle ion-icon { font-size: 18px; color: var(--ion-color-primary); }
    .toggle ion-icon:last-child { color: var(--imehr-text-3); font-size: 16px; }

    .body {
      padding: 4px 14px 14px;
      border-top: 1px solid var(--imehr-border);
      animation: slide 0.18s ease;
    }
    @keyframes slide { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .body section { padding: 8px 0; }
    .body section + section { border-top: 1px solid var(--imehr-border); }
    .body h4 {
      margin: 0 0 2px;
      font-size: 11px;
      color: var(--imehr-text-3);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
    }
    .body p { margin: 2px 0; font-size: 13px; line-height: 1.45; }
    .body .muted { color: var(--imehr-text-2); }
    .body .small { font-size: 13px; }
  `],
})
export class ReferenceDrawerComponent {
  private readonly store = inject(EncounterStore);
  readonly open = signal<boolean>(false);

  toggle(): void { this.open.update((v) => !v); }

  readonly vitalsLine = computed(() => {
    const v = this.store.vitals();
    if (!v) return '—';
    const parts: string[] = [];
    if (v.systolicBp != null || v.diastolicBp != null) parts.push(`BP ${v.systolicBp ?? '?'}/${v.diastolicBp ?? '?'}`);
    if (v.heartRate != null) parts.push(`HR ${v.heartRate}`);
    if (v.temperature != null) parts.push(`T ${v.temperature}°F`);
    if (v.spo2 != null) parts.push(`SpO₂ ${v.spo2}%`);
    if (v.respiratoryRate != null) parts.push(`RR ${v.respiratoryRate}`);
    if (v.bmi != null) parts.push(`BMI ${v.bmi}`);
    if (v.painScore != null) parts.push(`Pain ${v.painScore}/10`);
    return parts.length ? parts.join(' · ') : '— Not recorded';
  });

  readonly problemsLine = computed(() => {
    const active = this.store.problems().filter((p) => p.status !== 'Resolved');
    if (active.length === 0) return '';
    const names = active.slice(0, 4).map((p) => p.description).join(', ');
    return 'Problems: ' + names + (active.length > 4 ? ` +${active.length - 4}` : '');
  });

  readonly allergiesLine = computed(() => {
    const items = this.store.allergies();
    if (items.length === 0) return '';
    const names = items.slice(0, 3).map((a) => a.allergen).join(', ');
    return 'Allergies: ' + names + (items.length > 3 ? ` +${items.length - 3}` : '');
  });

  readonly ccLine  = computed(() => (this.store.encounter()?.chiefComplaint ?? '').trim());
  readonly hpiLine = computed(() => (this.store.encounter()?.historyOfPresentIllness ?? '').trim());
}
