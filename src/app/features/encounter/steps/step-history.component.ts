import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, AlertController } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { ToastService } from 'src/app/core/ui/toast.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';

/**
 * Step 1 — History Review.
 *
 * Six sub-sections matching EncounterWorkspaceModule._renderHistoryStep():
 *   Allergies · Medications · Problems · Family Hx · Social Hx · Immunizations
 *
 * Each sub-section renders the current list from EncounterStore and uses
 * Ionic AlertController for inline add/remove — native-feel, no modal pages
 * needed for Phase 4. Richer editors can land in a later polish pass.
 */
@Component({
  selector: 'app-step-history',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="pane">
      <h2 class="title">History Review</h2>
      <p class="muted small">Review and update patient history. Add items inline; delete with the trash icon.</p>

      <!-- Allergies -->
      <section class="card">
        <header class="head">
          <div class="head-left">
            <span class="ico warn"><ion-icon name="warning-outline"></ion-icon></span>
            <h3>Allergies <small>({{ store.allergies().length }})</small></h3>
          </div>
          <button class="add-btn" (click)="addAllergy()">
            <ion-icon name="add"></ion-icon> Add
          </button>
        </header>

        @if (store.allergies().length === 0) {
          <p class="empty">No known allergies.</p>
        } @else {
          <ul class="rows">
            @for (a of store.allergies(); track a.allergyId) {
              <li>
                <div class="row-main">
                  <strong>{{ a.allergen }}</strong>
                  @if (a.reaction || a.severity) {
                    <span class="muted small">{{ a.severity ?? '' }}@if (a.severity && a.reaction) {, }{{ a.reaction ?? '' }}</span>
                  }
                </div>
                <button class="trash" (click)="remove('allergy', a.allergyId!, a.allergen)"><ion-icon name="close-outline"></ion-icon></button>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Medications -->
      <section class="card">
        <header class="head">
          <div class="head-left">
            <span class="ico"><ion-icon name="medkit-outline"></ion-icon></span>
            <h3>Active medications <small>({{ activeMedCount() }})</small></h3>
          </div>
          <button class="add-btn" (click)="addMedication()">
            <ion-icon name="add"></ion-icon> Add
          </button>
        </header>

        @if (store.medications().length === 0) {
          <p class="empty">No medications on file.</p>
        } @else {
          <ul class="rows">
            @for (m of store.medications(); track m.medicationId) {
              <li [class.dim]="m.status === 'Discontinued'">
                <div class="row-main">
                  <strong>{{ m.name }}</strong>
                  @if (m.dose || m.route || m.frequency) {
                    <span class="muted small">
                      @if (m.dose) { {{ m.dose }} }
                      @if (m.route) { · {{ m.route }} }
                      @if (m.frequency) { · {{ m.frequency }} }
                    </span>
                  }
                  @if (m.status === 'Discontinued') {
                    <span class="tag danger">Discontinued</span>
                  }
                </div>
                <div class="row-actions">
                  @if (m.status !== 'Discontinued') {
                    <button class="icon-btn" (click)="discontinueMedication(m.medicationId!, m.name)" aria-label="Discontinue">
                      <ion-icon name="stop-circle-outline"></ion-icon>
                    </button>
                  }
                  <button class="trash" (click)="remove('medication', m.medicationId!, m.name)"><ion-icon name="close-outline"></ion-icon></button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Problems -->
      <section class="card">
        <header class="head">
          <div class="head-left">
            <span class="ico"><ion-icon name="pulse-outline"></ion-icon></span>
            <h3>Active problems <small>({{ activeProblemCount() }})</small></h3>
          </div>
          <button class="add-btn" (click)="addProblem()">
            <ion-icon name="add"></ion-icon> Add
          </button>
        </header>

        @if (store.problems().length === 0) {
          <p class="empty">No problems recorded.</p>
        } @else {
          <ul class="rows">
            @for (p of store.problems(); track p.problemId) {
              <li [class.dim]="p.status === 'Resolved'">
                <div class="row-main">
                  <strong>{{ p.description }}</strong>
                  @if (p.icd10Code || p.onsetDate) {
                    <span class="muted small">
                      @if (p.icd10Code) { {{ p.icd10Code }} }
                      @if (p.icd10Code && p.onsetDate) { · }
                      @if (p.onsetDate) { Since {{ p.onsetDate | date:'y' }} }
                    </span>
                  }
                  @if (p.status === 'Resolved') {
                    <span class="tag success">Resolved</span>
                  }
                </div>
                <div class="row-actions">
                  @if (p.status !== 'Resolved') {
                    <button class="icon-btn" (click)="resolveProblem(p.problemId!, p.description)" aria-label="Resolve">
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                    </button>
                  }
                  <button class="trash" (click)="remove('problem', p.problemId!, p.description)"><ion-icon name="close-outline"></ion-icon></button>
                </div>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Family history -->
      <section class="card">
        <header class="head">
          <div class="head-left">
            <span class="ico"><ion-icon name="people-outline"></ion-icon></span>
            <h3>Family history <small>({{ store.familyHistory().length }})</small></h3>
          </div>
          <button class="add-btn" (click)="addFamilyHistory()">
            <ion-icon name="add"></ion-icon> Add
          </button>
        </header>

        @if (store.familyHistory().length === 0) {
          <p class="empty">No family history on file.</p>
        } @else {
          <ul class="rows">
            @for (f of store.familyHistory(); track f.familyHistoryId) {
              <li>
                <div class="row-main">
                  <strong>{{ f.relationship }}</strong>
                  <span class="muted small">{{ f.conditions }}</span>
                </div>
                <button class="trash" (click)="remove('family', f.familyHistoryId!, f.relationship)"><ion-icon name="close-outline"></ion-icon></button>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Social history -->
      <section class="card">
        <header class="head">
          <div class="head-left">
            <span class="ico"><ion-icon name="cafe-outline"></ion-icon></span>
            <h3>Social history <small>({{ store.socialHistory().length }})</small></h3>
          </div>
          <button class="add-btn" (click)="addSocialHistory()">
            <ion-icon name="add"></ion-icon> Add
          </button>
        </header>

        @if (store.socialHistory().length === 0) {
          <p class="empty">No social history on file.</p>
        } @else {
          <ul class="rows">
            @for (s of store.socialHistory(); track s.socialHistoryId) {
              <li>
                <div class="row-main">
                  <strong>{{ s.category }}</strong>
                  <span class="muted small">{{ s.value }}</span>
                </div>
                <button class="trash" (click)="remove('social', s.socialHistoryId!, s.category)"><ion-icon name="close-outline"></ion-icon></button>
              </li>
            }
          </ul>
        }
      </section>

      <!-- Immunizations -->
      <section class="card">
        <header class="head">
          <div class="head-left">
            <span class="ico"><ion-icon name="shield-checkmark-outline"></ion-icon></span>
            <h3>Immunizations <small>({{ store.immunizations().length }})</small></h3>
          </div>
          <button class="add-btn" (click)="addImmunization()">
            <ion-icon name="add"></ion-icon> Add
          </button>
        </header>

        @if (store.immunizations().length === 0) {
          <p class="empty">No immunizations recorded.</p>
        } @else {
          <ul class="rows">
            @for (i of store.immunizations(); track i.immunizationId) {
              <li>
                <div class="row-main">
                  <strong>{{ i.vaccine }}</strong>
                  @if (i.administeredAt) {
                    <span class="muted small">{{ i.administeredAt | date:'MMM y' }}</span>
                  }
                </div>
                <button class="trash" (click)="remove('imm', i.immunizationId!, i.vaccine)"><ion-icon name="close-outline"></ion-icon></button>
              </li>
            }
          </ul>
        }
      </section>
    </div>
  `,
  styles: [`
    .pane { padding: 16px 16px 100px; max-width: 640px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 2px; letter-spacing: -0.01em; }
    .muted { color: var(--imehr-text-2); }
    .small { font-size: 13px; margin: 0 0 14px; }

    .card {
      background: var(--ion-item-background);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
      padding: 12px 14px;
      margin-bottom: 12px;
    }

    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .head-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
    .head h3 { margin: 0; font-size: 14px; font-weight: 700; }
    .head h3 small { color: var(--imehr-text-3); font-weight: 600; }
    .ico {
      width: 28px; height: 28px;
      padding: 0;
      border-radius: 8px;
      background: var(--imehr-primary-50);
      color: var(--ion-color-primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .ico ion-icon { font-size: 16px; }
    .ico.warn { background: rgba(217, 119, 6, 0.12); color: var(--ion-color-warning); }

    .add-btn {
      border: 1px solid var(--imehr-border-strong);
      background: var(--ion-item-background);
      color: var(--imehr-text-2);
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-family: inherit;
    }
    .add-btn ion-icon { font-size: 14px; }

    .rows {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .rows li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: var(--imehr-surface-2);
      border-radius: 10px;
      font-size: 13.5px;
    }
    .rows li.dim { opacity: 0.65; }
    .row-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .row-main strong { font-weight: 600; color: var(--ion-text-color); }
    .row-actions {
      display: flex;
      gap: 4px;
    }
    .icon-btn, .trash {
      width: 30px; height: 30px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--imehr-text-3);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .icon-btn:hover { background: rgba(0,0,0,0.05); color: var(--ion-color-success); }
    .trash:hover { background: rgba(220, 38, 38, 0.1); color: var(--ion-color-danger); }
    .icon-btn ion-icon, .trash ion-icon { font-size: 18px; }

    .tag {
      font-size: 10.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 999px;
      display: inline-block;
      margin-top: 2px;
      width: fit-content;
    }
    .tag.danger  { background: rgba(220, 38, 38, 0.12); color: var(--ion-color-danger); }
    .tag.success { background: rgba(22, 163, 74, 0.12); color: var(--ion-color-success); }

    .empty {
      color: var(--imehr-text-3);
      font-size: 13px;
      padding: 8px 4px;
      margin: 0;
    }
  `],
})
export class StepHistoryComponent {
  readonly store = inject(EncounterStore);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);

  activeMedCount(): number {
    return this.store.medications().filter((m) => m.status !== 'Discontinued').length;
  }
  activeProblemCount(): number {
    return this.store.problems().filter((p) => p.status !== 'Resolved').length;
  }

  /* ============================================================
     Add prompts
     ============================================================ */
  async addAllergy(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Add Allergy',
      inputs: [
        { name: 'allergen', type: 'text',     placeholder: 'Allergen (e.g. Penicillin)' },
        { name: 'reaction', type: 'text',     placeholder: 'Reaction (optional)' },
        { name: 'severity', type: 'text',     placeholder: 'Severity: Mild / Moderate / Severe' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (d) => {
            if (!d?.allergen?.trim()) return false;
            void this.store.addAllergy({ allergen: d.allergen.trim(), reaction: d.reaction?.trim(), severity: d.severity?.trim() });
            void this.haptics.light();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async addMedication(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Add Medication',
      inputs: [
        { name: 'name',      type: 'text', placeholder: 'Name (e.g. Lisinopril 10 mg tablet)' },
        { name: 'dose',      type: 'text', placeholder: 'Dose (e.g. 10 mg)' },
        { name: 'route',     type: 'text', placeholder: 'Route (PO / IV / IM)' },
        { name: 'frequency', type: 'text', placeholder: 'Frequency (daily / BID)' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (d) => {
            if (!d?.name?.trim()) return false;
            void this.store.addMedication({
              name: d.name.trim(),
              dose: d.dose?.trim(),
              route: d.route?.trim(),
              frequency: d.frequency?.trim(),
            });
            void this.haptics.light();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async addProblem(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Add Problem',
      inputs: [
        { name: 'description', type: 'text', placeholder: 'Problem (e.g. Essential hypertension)' },
        { name: 'icd10Code',   type: 'text', placeholder: 'ICD-10 code (optional)' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (d) => {
            if (!d?.description?.trim()) return false;
            void this.store.addProblem({
              description: d.description.trim(),
              icd10Code: d.icd10Code?.trim(),
            });
            void this.haptics.light();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async addFamilyHistory(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Add Family History',
      inputs: [
        { name: 'relationship', type: 'text', placeholder: 'Relationship (Mother, Father, Sibling)' },
        { name: 'conditions',   type: 'text', placeholder: 'Conditions (e.g. HTN, T2DM)' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (d) => {
            if (!d?.relationship?.trim() || !d?.conditions?.trim()) return false;
            void this.store.addFamilyHistory({
              relationship: d.relationship.trim(),
              conditions: d.conditions.trim(),
            });
            void this.haptics.light();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async addSocialHistory(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Add Social History',
      inputs: [
        { name: 'category', type: 'text', placeholder: 'Category (Tobacco / Alcohol / Exercise / Diet / Occupation)' },
        { name: 'value',    type: 'text', placeholder: 'Value (e.g. Never, 2/week, Graphic designer)' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (d) => {
            if (!d?.category?.trim() || !d?.value?.trim()) return false;
            void this.store.addSocialHistory({
              category: d.category.trim(),
              value: d.value.trim(),
            });
            void this.haptics.light();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async addImmunization(): Promise<void> {
    const a = await this.alerts.create({
      header: 'Add Immunization',
      inputs: [
        { name: 'vaccine',        type: 'text', placeholder: 'Vaccine (e.g. Influenza)' },
        { name: 'administeredAt', type: 'date', placeholder: 'Administered on' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (d) => {
            if (!d?.vaccine?.trim()) return false;
            void this.store.addImmunization({
              vaccine: d.vaccine.trim(),
              administeredAt: d.administeredAt || undefined,
              status: 'Completed',
            });
            void this.haptics.light();
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  /* ============================================================
     Mutators
     ============================================================ */
  async discontinueMedication(id: number, name: string): Promise<void> {
    await this.confirmThen(`Discontinue ${name}?`, () => this.store.discontinueMedication(id));
  }
  async resolveProblem(id: number, name: string): Promise<void> {
    await this.confirmThen(`Mark ${name} as resolved?`, () => this.store.resolveProblem(id));
  }

  async remove(
    kind: 'allergy' | 'medication' | 'problem' | 'family' | 'social' | 'imm',
    id: number,
    label: string,
  ): Promise<void> {
    await this.confirmThen(`Delete ${label}?`, async () => {
      switch (kind) {
        case 'allergy':    return this.store.removeAllergy(id);
        case 'medication': return this.store.removeMedication(id);
        case 'problem':    return this.store.removeProblem(id);
        case 'family':     return this.store.removeFamilyHistory(id);
        case 'social':     return this.store.removeSocialHistory(id);
        case 'imm':        return this.store.removeImmunization(id);
      }
    });
  }

  private async confirmThen(header: string, run: () => Promise<void>): Promise<void> {
    const a = await this.alerts.create({
      header,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Confirm', role: 'destructive', handler: () => { void run().then(() => this.haptics.medium()); return true; } },
      ],
    });
    await a.present();
  }
}
