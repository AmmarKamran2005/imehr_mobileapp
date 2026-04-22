import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonIcon, AlertController } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import {
  CptCode, IcdCode, ICD_MAX,
  confidenceBucket, familyPrefix, priorityLetter,
} from 'src/app/core/models/codes.model';

type TabKey = 'icd' | 'cpt';

/**
 * Step 5 — Dx & CPT Codes.
 *
 * Web spec: rules/technical/dx-and-cpt-codes.md.
 *   • ICD-10 cap of 12 (CMS-1500 Box 21 A-L). Priority = order.
 *   • CPT has no cap; units inline per row.
 *   • AI suggestions auto-fire on step entry; CPT refreshes when ICD changes.
 *   • {prefix}.x family overlay for ICD suggestions.
 *   • Per-user favorites shown below the selected card.
 *   • Confidence badges: ≥90 high (green), 60–89 medium (yellow), <60 low (grey).
 *
 * Save is debounced via the store's 'encounter' queue — every mutation calls
 * next('encounter') and the flushEncounter() writes both arrays to the
 * Encounter row.
 */
@Component({
  selector: 'app-step-dx-cpt',
  standalone: true,
  imports: [CommonModule, FormsModule, IonIcon],
  templateUrl: './step-dx-cpt.component.html',
  styleUrls: ['./step-dx-cpt.component.scss'],
})
export class StepDxCptComponent implements OnInit {
  readonly store = inject(EncounterStore);
  private readonly alerts = inject(AlertController);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);

  readonly ICD_MAX = ICD_MAX;

  readonly tab = signal<TabKey>('icd');
  readonly query = signal<string>('');
  readonly icdResults = signal<IcdCode[]>([]);
  readonly cptResults = signal<CptCode[]>([]);
  readonly searching = signal<boolean>(false);

  // Family overlay — single panel reused across prefix clicks.
  readonly familyPrefix = signal<string | null>(null);
  readonly familyCodes = signal<IcdCode[]>([]);

  private searchDebounce: number | null = null;

  readonly icdSelections = this.store.icdSelections;
  readonly cptSelections = this.store.cptSelections;
  readonly icdSuggestions = this.store.icdSuggestions;
  readonly cptSuggestions = this.store.cptSuggestions;
  readonly icdFavorites = this.store.icdFavorites;
  readonly cptFavorites = this.store.cptFavorites;

  readonly canAddIcd = computed(() => this.icdSelections().length < ICD_MAX);

  readonly confidenceBucket = confidenceBucket;
  readonly priorityLetter = priorityLetter;

  async ngOnInit(): Promise<void> {
    // Auto-refresh AI suggestions on step entry
    await Promise.all([
      this.store.refreshIcdSuggestions(),
      this.store.refreshCptSuggestions(),
    ]);
  }

  /* ============================================================
     Tabs + search
     ============================================================ */
  pickTab(t: TabKey): void {
    this.tab.set(t);
    this.query.set('');
    this.icdResults.set([]);
    this.cptResults.set([]);
  }

  onQueryChange(v: string): void {
    this.query.set(v);
    if (this.searchDebounce != null) clearTimeout(this.searchDebounce);
    this.searchDebounce = window.setTimeout(() => { void this.runSearch(); }, 250);
  }

  private async runSearch(): Promise<void> {
    const q = this.query().trim();
    if (q.length < 2) {
      this.icdResults.set([]);
      this.cptResults.set([]);
      return;
    }
    this.searching.set(true);
    try {
      if (this.tab() === 'icd') {
        this.icdResults.set(await this.store.searchIcd(q));
      } else {
        this.cptResults.set(await this.store.searchCpt(q));
      }
    } finally {
      this.searching.set(false);
    }
  }

  /* ============================================================
     ICD actions
     ============================================================ */
  addIcd(row: IcdCode): void {
    if (!this.canAddIcd()) {
      void this.toasts.warn(`ICD limit reached (${ICD_MAX}).`);
      return;
    }
    const ok = this.store.addIcd({
      code: row.code,
      description: row.description,
      aiSuggested: !!row.aiSuggested,
    });
    if (ok) {
      void this.haptics.light();
    } else {
      void this.toasts.show(`${row.code} is already on the list`);
    }
  }

  removeIcd(i: number): void {
    this.store.removeIcdAt(i);
    void this.haptics.light();
  }

  moveIcd(from: number, dir: -1 | 1): void {
    this.store.moveIcd(from, from + dir);
    void this.haptics.light();
  }

  async openFamily(prefix: string): Promise<void> {
    if (this.familyPrefix() === prefix) {
      this.familyPrefix.set(null);
      this.familyCodes.set([]);
      return;
    }
    this.familyPrefix.set(prefix);
    const rows = await this.store.searchIcdByPrefix(prefix);
    this.familyCodes.set(rows);
  }

  closeFamily(): void {
    this.familyPrefix.set(null);
    this.familyCodes.set([]);
  }

  /* ============================================================
     CPT actions
     ============================================================ */
  addCpt(row: CptCode): void {
    const ok = this.store.addCpt({
      cptCode: row.cptCode,
      description: row.description,
      units: row.units ?? 1,
      aiSuggested: !!row.aiSuggested,
    });
    if (ok) {
      void this.haptics.light();
    } else {
      void this.toasts.show(`${row.cptCode} is already on the list`);
    }
  }

  updateUnits(cpt: string, raw: unknown): void {
    const n = Number(raw);
    if (Number.isFinite(n)) this.store.updateCptUnits(cpt, n);
  }

  removeCpt(code: string): void {
    this.store.removeCpt(code);
    void this.haptics.light();
  }

  /* ============================================================
     Favorites
     ============================================================ */
  async toggleIcdFav(code: string, description: string): Promise<void> {
    await this.store.toggleIcdFavorite(code, description);
  }
  async toggleCptFav(code: string, description: string): Promise<void> {
    await this.store.toggleCptFavorite(code, description);
  }

  isIcdFav(code: string): boolean { return this.icdFavorites().some((f) => f.code === code); }
  isCptFav(code: string): boolean { return this.cptFavorites().some((f) => f.cptCode === code); }

  /* ============================================================
     Helpers
     ============================================================ */
  familyFor(code: string): string { return familyPrefix(code); }

  async refresh(): Promise<void> {
    await Promise.all([
      this.store.refreshIcdSuggestions(),
      this.store.refreshCptSuggestions(),
    ]);
    await this.toasts.success('AI suggestions refreshed');
  }
}
