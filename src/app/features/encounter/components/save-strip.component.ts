import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';

import { RoleBadgeComponent } from 'src/app/shared/components/role-badge.component';
import { UserRole } from 'src/app/core/models/user.model';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Slim status bar under the patient chip:
 *   [•] Saved / Saving… / Ready / Save failed     [role badge]
 *
 * Labels are verbatim from the web EncounterWorkspaceModule.js (_updateSaveIndicator).
 */
@Component({
  selector: 'app-save-strip',
  standalone: true,
  imports: [CommonModule, IonIcon, RoleBadgeComponent],
  template: `
    <div class="strip" [class.err]="status() === 'error'">
      <span class="dot" [class.saving]="status() === 'saving'" [class.err]="status() === 'error'"></span>
      <ion-icon [name]="iconName()" aria-hidden="true"></ion-icon>
      <span class="label">{{ label() }}</span>
      <span class="grow"></span>
      @if (role() != null) {
        <app-role-badge [role]="role()!"></app-role-badge>
      }
    </div>
  `,
  styles: [`
    .strip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      background: var(--ion-item-background);
      border-bottom: 1px solid var(--imehr-border);
      font-size: 12px;
      color: var(--imehr-text-3);
    }
    .grow { flex: 1; }
    .dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--ion-color-success);
      box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.2);
    }
    .dot.saving {
      background: var(--ion-color-warning);
      box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.2);
      animation: pulse 1.2s ease-in-out infinite;
    }
    .dot.err {
      background: var(--ion-color-danger);
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
    }
    @keyframes pulse { 50% { opacity: 0.45; } }
    .strip ion-icon { font-size: 13px; }
    .label { font-weight: 600; }
    .strip.err .label { color: var(--ion-color-danger); }
  `],
})
export class SaveStripComponent {
  readonly status = input<SaveStatus>('idle');
  readonly role   = input<UserRole | null>(null);

  readonly label = computed(() => {
    switch (this.status()) {
      case 'saving': return 'Saving…';
      case 'saved':  return 'Saved';
      case 'error':  return 'Save failed';
      default:       return 'Ready';
    }
  });

  readonly iconName = computed(() => {
    switch (this.status()) {
      case 'saving': return 'cloud-upload-outline';
      case 'saved':  return 'checkmark-circle-outline';
      case 'error':  return 'alert-circle-outline';
      default:       return 'cloud-done-outline';
    }
  });
}
