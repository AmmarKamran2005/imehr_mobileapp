import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import {
  APPOINTMENT_TYPE_LABELS,
  AppointmentDto, formatTime12, initialsFromName, statusMeta,
} from 'src/app/core/models/appointment.model';

/**
 * Dashboard row — status-aware action button (Check In / Start / Resume / View)
 * replaces the old patient-avatar circle per product direction (2026-04-22).
 */
@Component({
  selector: 'app-appointment-card',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <button type="button" class="card" (click)="open.emit(appointment())">
      <div class="time">
        <span class="hr">{{ time().hour }}</span>
        <span class="mer">{{ time().mer }}</span>
      </div>

      <div class="body">
        <p class="name">{{ appointment().patientName }}</p>
        <p class="reason">
          {{ typeLabel() }}<ng-container *ngIf="appointment().reason"> · {{ appointment().reason }}</ng-container>
        </p>
        <p class="room" *ngIf="appointment().roomNumber || appointment().locationName">
          {{ appointment().locationName || 'Main Clinic' }}<ng-container *ngIf="appointment().roomNumber"> · {{ appointment().roomNumber }}</ng-container>
        </p>
      </div>

      <div class="right">
        <span class="imehr-chip" [class.success]="chipToneIs('success')" [class.warning]="chipToneIs('warning')" [class.info]="chipToneIs('info')" [class.primary]="chipToneIs('primary')" [class.danger]="chipToneIs('danger')">
          {{ meta().label }}
        </span>

        @switch (meta().action) {
          @case ('check-in') {
            <button class="action primary" (click)="fire($event, 'check-in')">
              <ion-icon name="log-in-outline"></ion-icon> Check In
            </button>
          }
          @case ('start') {
            <button class="action warn" (click)="fire($event, 'start')">
              <ion-icon name="play-circle-outline"></ion-icon> Start
            </button>
          }
          @case ('resume') {
            <button class="action success" (click)="fire($event, 'resume')">
              <ion-icon name="play-forward-outline"></ion-icon> Resume
            </button>
          }
          @case ('view') {
            <button class="action ghost" (click)="fire($event, 'view')">
              <ion-icon name="document-text-outline"></ion-icon> View
            </button>
          }
        }
      </div>
    </button>
  `,
  styles: [`
    .card {
      background: var(--ion-card-background);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
      padding: 14px;
      display: grid;
      grid-template-columns: 56px 1fr auto;
      gap: 12px;
      align-items: center;
      cursor: pointer;
      transition: transform 0.08s ease, box-shadow 0.15s ease;
      box-shadow: var(--imehr-shadow-sm);
      width: 100%;
      font-family: inherit;
      text-align: left;
    }
    .card:hover { box-shadow: var(--imehr-shadow-md); }
    .card:active { transform: translateY(0) scale(0.995); }

    .time {
      display: flex; flex-direction: column; align-items: center;
      padding: 6px 12px 6px 0;
      border-right: 1px solid var(--imehr-border);
    }
    .time .hr { font-size: 15px; font-weight: 700; color: var(--ion-text-color); }
    .time .mer { font-size: 11px; color: var(--imehr-text-3); }

    .body { min-width: 0; }
    .body .name { margin: 0; font-size: 15px; font-weight: 600; color: var(--ion-text-color); }
    .body .reason {
      margin: 2px 0 0;
      font-size: 13px;
      color: var(--imehr-text-2);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .body .room { margin: 4px 0 0; font-size: 12px; color: var(--imehr-text-3); }

    .right {
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
      min-width: 86px;
    }

    .imehr-chip {
      display: inline-flex; align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 11px; font-weight: 600;
      white-space: nowrap;
    }
    .imehr-chip.success  { background: rgba(22, 163, 74, 0.12); color: var(--ion-color-success); }
    .imehr-chip.warning  { background: rgba(217, 119, 6, 0.12); color: var(--ion-color-warning); }
    .imehr-chip.info     { background: rgba(2, 132, 199, 0.12); color: #0284c7; }
    .imehr-chip.primary  { background: var(--imehr-primary-50); color: var(--ion-color-primary); }
    .imehr-chip.danger   { background: rgba(220, 38, 38, 0.12); color: var(--ion-color-danger); }

    .action {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 10px;
      border-radius: 999px;
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
      white-space: nowrap;
      transition: transform 0.08s ease, box-shadow 0.15s ease;
    }
    .action ion-icon { font-size: 14px; }
    .action.primary  { background: var(--ion-color-primary); color: #fff; box-shadow: 0 2px 8px rgba(11, 99, 206, 0.25); }
    .action.warn     { background: var(--ion-color-warning); color: #fff; box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25); }
    .action.success  { background: var(--ion-color-success); color: #fff; box-shadow: 0 2px 8px rgba(22, 163, 74, 0.25); }
    .action.ghost    { background: var(--imehr-surface-2); color: var(--imehr-text-2); border-color: var(--imehr-border); }
    .action:active { transform: scale(0.95); }
  `],
})
export class AppointmentCardComponent {
  readonly appointment = input.required<AppointmentDto>();

  readonly open    = output<AppointmentDto>();
  readonly action  = output<{ kind: 'check-in' | 'start' | 'resume' | 'view'; appointment: AppointmentDto }>();

  readonly time = computed(() => formatTime12(
    this.appointment().startTime,
    this.appointment().timeZoneId,
  ));
  readonly meta = computed(() => statusMeta(this.appointment().status));

  typeLabel(): string {
    const a = this.appointment();
    if (a.typeName) return a.typeName;
    if (a.type != null) return APPOINTMENT_TYPE_LABELS[a.type] ?? 'Visit';
    return 'Visit';
  }

  initials(): string {
    return this.appointment().patientInitials ?? initialsFromName(this.appointment().patientName);
  }

  chipToneIs(tone: string): boolean {
    return this.meta().chipClass.endsWith(tone);
  }

  fire(e: Event, kind: 'check-in' | 'start' | 'resume' | 'view'): void {
    e.stopPropagation();
    this.action.emit({ kind, appointment: this.appointment() });
  }
}
