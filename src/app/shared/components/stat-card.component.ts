import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { StatCard } from 'src/app/core/models/dashboard.model';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <button
      type="button"
      class="stat-card"
      [class.tone-primary]="card().tone === 'primary'"
      [class.tone-info]="card().tone === 'info'"
      [class.tone-warn]="card().tone === 'warning'"
      [class.tone-danger]="card().tone === 'danger'"
      [class.tone-success]="card().tone === 'success'"
      (click)="activated.emit(card())"
    >
      <div class="sc-ico"><ion-icon [name]="card().icon"></ion-icon></div>
      <span class="sc-num">{{ card().value }}</span>
      <span class="sc-lbl">{{ card().label }}</span>
    </button>
  `,
  styles: [`
    .stat-card {
      background: var(--ion-card-background);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
      padding: 10px 8px;
      text-align: center;
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.1s ease, box-shadow 0.15s ease;
      box-shadow: var(--imehr-shadow-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      width: 100%;
    }
    .stat-card:active { transform: scale(0.96); }
    .sc-ico {
      width: 28px; height: 28px;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 4px;
    }
    .sc-ico ion-icon { font-size: 15px; }
    .sc-num {
      font-size: 20px; font-weight: 800;
      color: var(--ion-text-color);
      letter-spacing: -0.02em;
    }
    .sc-lbl {
      font-size: 10.5px;
      color: var(--imehr-text-2);
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .tone-primary .sc-ico { background: var(--imehr-primary-50); color: var(--ion-color-primary); }
    .tone-info    .sc-ico { background: rgba(2, 132, 199, 0.12); color: #0284c7; }
    .tone-warn    .sc-ico { background: rgba(217, 119, 6, 0.12); color: var(--ion-color-warning); }
    .tone-danger  .sc-ico { background: rgba(220, 38, 38, 0.12); color: var(--ion-color-danger); }
    .tone-success .sc-ico { background: rgba(22, 163, 74, 0.12); color: var(--ion-color-success); }
    .tone-warn .sc-num { color: var(--ion-color-warning); }
    .tone-danger .sc-num { color: var(--ion-color-danger); }
    .tone-success .sc-num { color: var(--ion-color-success); }
  `],
})
export class StatCardComponent {
  readonly card = input.required<StatCard>();
  readonly activated = output<StatCard>();
}
