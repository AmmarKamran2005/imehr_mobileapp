import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { AppointmentDto, formatTime12 } from 'src/app/core/models/appointment.model';

@Component({
  selector: 'app-active-visit-banner',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <button type="button" class="active-visit-banner" (click)="resume.emit(appointment())">
      <ion-icon name="play-circle"></ion-icon>
      <div class="body">
        <p class="title">Active Visit</p>
        <p class="meta">
          {{ appointment().patientName }} · {{ providerOrEmpty() }}Started {{ startedTime() }}
        </p>
      </div>
      <span class="cta">Resume Visit</span>
    </button>
  `,
  styles: [`
    .active-visit-banner {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      background: rgba(22, 163, 74, 0.08);
      border: 1px solid rgba(22, 163, 74, 0.25);
      border-radius: var(--imehr-radius);
      cursor: pointer;
      transition: transform 0.1s ease;
      font-family: inherit;
      text-align: left;
    }
    .active-visit-banner:active { transform: scale(0.99); }
    .active-visit-banner > ion-icon {
      color: var(--ion-color-success);
      font-size: 28px;
      flex-shrink: 0;
    }
    .body { flex: 1; min-width: 0; }
    .title {
      margin: 0;
      font-weight: 700;
      font-size: 14px;
      color: var(--ion-color-success);
    }
    .meta {
      margin: 2px 0 0;
      color: var(--imehr-text-2);
      font-size: 12.5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cta {
      background: var(--ion-color-primary);
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      padding: 7px 14px;
      border-radius: 999px;
      white-space: nowrap;
    }
  `],
})
export class ActiveVisitBannerComponent {
  readonly appointment = input.required<AppointmentDto>();
  readonly resume = output<AppointmentDto>();

  providerOrEmpty(): string {
    const p = this.appointment().providerName;
    return p ? `${p} · ` : '';
  }

  startedTime(): string {
    const a = this.appointment();
    const iso = a.startedAt ?? a.checkedInAt ?? a.startTime;
    const { hour, mer } = formatTime12(iso);
    return `${hour} ${mer}`;
  }
}
