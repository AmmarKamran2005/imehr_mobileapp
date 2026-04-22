import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';

import {
  ENCOUNTER_STEPS, StepDef, isStepLocked,
} from 'src/app/core/models/encounter.model';
import { UserRole } from 'src/app/core/models/user.model';
import { ToastService } from 'src/app/core/ui/toast.service';

/**
 * Horizontal stepper that mirrors the web sidebar but fits a phone width.
 * Each pill shows:
 *   – a number 1–8 (done → ✓, locked → padlock)
 *   – the short step label (from ENCOUNTER_STEPS)
 * Emits step index on tap; swallows taps when a step is locked for the
 * current user's role and toasts an explanation.
 */
@Component({
  selector: 'app-encounter-stepper',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="strip strip-scroll">
      @for (s of steps; track s.index) {
        <button
          type="button"
          class="chip"
          [class.active]="s.index === active()"
          [class.done]="completed()[s.index] && s.index !== active()"
          [class.locked]="isLocked(s)"
          (click)="onTap(s)"
          [attr.aria-label]="s.label + ' step'"
        >
          <span class="num">
            @if (isLocked(s)) {
              <ion-icon name="lock-closed" aria-hidden="true"></ion-icon>
            } @else if (completed()[s.index] && s.index !== active()) {
              ✓
            } @else {
              {{ s.index + 1 }}
            }
          </span>
          <span class="lbl">{{ s.label }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .strip {
      display: flex;
      gap: 4px;
      padding: 12px 14px;
      background: var(--ion-item-background);
      border-bottom: 1px solid var(--imehr-border);
      flex-wrap: nowrap;
    }
    .chip {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      padding: 4px 8px 2px;
      border-radius: 10px;
      min-width: 76px;
      background: transparent;
      border: 0;
      font-family: inherit;
      transition: background 0.15s ease;
    }
    .chip:not(.locked):hover { background: var(--imehr-surface-2); }
    .num {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--imehr-surface-2);
      color: var(--imehr-text-3);
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid var(--imehr-border-strong);
      transition: all 0.15s ease;
    }
    .num ion-icon { font-size: 12px; }
    .lbl {
      font-size: 10.5px;
      color: var(--imehr-text-3);
      font-weight: 600;
      white-space: nowrap;
    }
    .chip.active .num {
      background: var(--ion-color-primary);
      color: #fff;
      border-color: var(--ion-color-primary);
      box-shadow: 0 2px 8px rgba(11, 99, 206, 0.35);
    }
    .chip.active .lbl { color: var(--ion-color-primary); }
    .chip.done .num {
      background: var(--ion-color-success);
      color: #fff;
      border-color: var(--ion-color-success);
    }
    .chip.done .lbl { color: var(--ion-color-success); }
    .chip.locked { opacity: 0.45; cursor: not-allowed; }
  `],
})
export class EncounterStepperComponent {
  private readonly toasts = inject(ToastService);

  readonly active    = input.required<number>();
  readonly completed = input.required<boolean[]>();
  readonly role      = input<UserRole>(UserRole.Clinician);

  readonly pick = output<number>();

  readonly steps = ENCOUNTER_STEPS;

  isLocked(s: StepDef): boolean {
    return isStepLocked(s, this.role());
  }

  onTap(s: StepDef): void {
    if (this.isLocked(s)) {
      void this.toasts.show('This step is for clinicians');
      return;
    }
    this.pick.emit(s.index);
  }
}
