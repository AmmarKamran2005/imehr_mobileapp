import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';

/**
 * Generic stub rendered for steps whose full implementation lands in later
 * phases. Takes the step title + icon + a phase label so the user sees a
 * predictable "coming next" message instead of an empty pane.
 */
@Component({
  selector: 'app-step-placeholder',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="wrap">
      <div class="icon"><ion-icon [name]="icon()"></ion-icon></div>
      <h2>{{ title() }}</h2>
      <p class="muted">{{ phase() }}</p>

      @if (note()) {
        <p class="muted small">{{ note() }}</p>
      }
    </div>
  `,
  styles: [`
    .wrap {
      padding: 48px 20px;
      text-align: center;
      max-width: 420px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .icon {
      width: 84px; height: 84px;
      border-radius: 22px;
      background: var(--imehr-primary-50);
      color: var(--ion-color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 8px;
    }
    .icon ion-icon { font-size: 42px; }
    h2 { margin: 0; font-size: 20px; font-weight: 700; }
    .muted { color: var(--imehr-text-2); margin: 4px 0; }
    .small { font-size: 13px; max-width: 320px; line-height: 1.5; }
  `],
})
export class StepPlaceholderComponent {
  readonly title = input.required<string>();
  readonly icon  = input<string>('time-outline');
  readonly phase = input<string>('Coming soon');
  readonly note  = input<string>('');
}
