import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { roleLabel, UserRole } from 'src/app/core/models/user.model';

@Component({
  selector: 'app-role-badge',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <span class="role-badge" [class.nurse]="isNurse()" [class.admin]="isAdmin()">
      <ion-icon [name]="iconName()"></ion-icon>
      {{ label() }}
    </span>
  `,
  styles: [`
    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--imehr-primary-50);
      color: var(--ion-color-primary);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .role-badge ion-icon { font-size: 13px; }
    .role-badge.nurse { background: rgba(22, 163, 74, 0.12); color: var(--ion-color-success); }
    .role-badge.admin { background: rgba(107, 63, 216, 0.12); color: #6b3fd8; }
  `],
})
export class RoleBadgeComponent {
  readonly role = input.required<UserRole>();

  label(): string { return roleLabel(this.role()); }

  isNurse(): boolean {
    const r = this.role();
    return r === UserRole.MA || r === UserRole.Nurse;
  }

  isAdmin(): boolean {
    const r = this.role();
    return r === UserRole.ClinicAdmin || r === UserRole.SuperAdmin;
  }

  iconName(): string {
    if (this.isNurse()) return 'heart-outline';
    if (this.isAdmin()) return 'shield-outline';
    return 'medkit-outline';
  }
}
