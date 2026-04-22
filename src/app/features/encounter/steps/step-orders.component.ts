import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, AlertController } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { ORDER_STATUS_LABELS, OrderCategory, OrderDto, OrderStatus } from 'src/app/core/models/orders.model';

/**
 * Step 4 — Orders & Referrals.
 * Categories: Lab · Imaging · Referral · Other. Users add via an inline
 * alert that lets them pick category → name → priority → notes. Complete
 * and delete are one-tap.
 */
@Component({
  selector: 'app-step-orders',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="pane">
      <h2 class="title">Orders &amp; Referrals</h2>
      <p class="muted small">Labs, imaging, referrals and other orders for this visit.</p>

      <div class="head-actions">
        <span class="count">{{ orders().length }} this visit</span>
        <button class="add" (click)="promptAdd()">
          <ion-icon name="add"></ion-icon> Add order
        </button>
      </div>

      @if (orders().length === 0) {
        <div class="empty">
          <ion-icon name="clipboard-outline"></ion-icon>
          <p>No orders placed yet.</p>
          <p class="muted small">Tap Add order to place a lab, imaging or referral order.</p>
        </div>
      } @else {
        <ul class="list">
          @for (o of orders(); track o.orderId) {
            <li class="row" [class.done]="o.status === 1" [class.cancel]="o.status === 2">
              <span class="ico" [class]="iconCls(o.category)"><ion-icon [name]="iconFor(o.category)"></ion-icon></span>
              <div class="body">
                <p class="name">{{ o.name }}</p>
                <p class="muted small">
                  {{ o.category }}
                  @if (o.priority) { · {{ o.priority }} }
                  @if (o.notes) { · {{ o.notes }} }
                </p>
              </div>
              <div class="right">
                <span class="imehr-chip" [class]="chipTone(o.status)">{{ statusLabel(o.status) }}</span>
                <div class="actions">
                  @if (o.status === 0) {
                    <button class="icon-btn" (click)="complete(o.orderId!, o.name)" aria-label="Mark complete">
                      <ion-icon name="checkmark-circle-outline"></ion-icon>
                    </button>
                  }
                  <button class="trash" (click)="remove(o.orderId!, o.name)" aria-label="Delete">
                    <ion-icon name="close-outline"></ion-icon>
                  </button>
                </div>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .pane { padding: 16px 16px 100px; max-width: 640px; margin: 0 auto; }
    .title { font-size: 22px; font-weight: 700; margin: 0 0 2px; letter-spacing: -0.01em; }
    .muted { color: var(--imehr-text-2); }
    .small { font-size: 13px; margin: 0 0 14px; }

    .head-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }
    .count {
      flex: 1;
      font-size: 12.5px;
      font-weight: 600;
      color: var(--imehr-text-3);
      padding-left: 2px;
    }
    .add {
      background: var(--ion-color-primary);
      color: #fff;
      border: 0;
      border-radius: 999px;
      padding: 8px 14px;
      font-family: inherit;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 8px rgba(11, 99, 206, 0.25);
    }
    .add ion-icon { font-size: 16px; }

    .empty {
      text-align: center;
      padding: 40px 16px;
      color: var(--imehr-text-3);
    }
    .empty ion-icon { font-size: 36px; opacity: 0.5; }
    .empty p { margin: 8px 0 2px; font-size: 14px; }

    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .row {
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 12px;
      background: var(--ion-item-background);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
    }
    .row.done { opacity: 0.75; }
    .row.cancel { opacity: 0.5; }

    .ico {
      width: 40px; height: 40px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--imehr-primary-50);
      color: var(--ion-color-primary);
    }
    .ico ion-icon { font-size: 20px; }
    .ico.lab { background: rgba(2, 132, 199, 0.12); color: #0284c7; }
    .ico.imaging { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }
    .ico.referral { background: rgba(22, 163, 74, 0.12); color: var(--ion-color-success); }
    .ico.other { background: var(--imehr-surface-2); color: var(--imehr-text-2); }

    .body { min-width: 0; }
    .name { margin: 0; font-size: 14px; font-weight: 600; }

    .right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
    .actions { display: flex; gap: 2px; }

    .imehr-chip {
      display: inline-flex; align-items: center;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .imehr-chip.info     { background: rgba(2, 132, 199, 0.12); color: #0284c7; }
    .imehr-chip.success  { background: rgba(22, 163, 74, 0.12); color: var(--ion-color-success); }
    .imehr-chip.neutral  { background: var(--imehr-surface-2); color: var(--imehr-text-2); }

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
  `],
})
export class StepOrdersComponent {
  private readonly store = inject(EncounterStore);
  private readonly alerts = inject(AlertController);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);

  readonly orders = this.store.orders;

  iconFor(c: OrderCategory): string {
    switch (c) {
      case 'Lab':      return 'flask-outline';
      case 'Imaging':  return 'scan-outline';
      case 'Referral': return 'person-add-outline';
      default:         return 'clipboard-outline';
    }
  }
  iconCls(c: OrderCategory): string {
    return c.toLowerCase();
  }

  chipTone(s?: OrderStatus): 'info' | 'success' | 'neutral' {
    if (s === 1) return 'success';
    if (s === 2) return 'neutral';
    return 'info';
  }

  statusLabel(s?: OrderStatus): string {
    if (s == null) return 'Ordered';
    return ORDER_STATUS_LABELS[s] ?? 'Ordered';
  }

  async promptAdd(): Promise<void> {
    // Step 1 — pick category via alert radio
    const catA = await this.alerts.create({
      header: 'Category',
      inputs: [
        { type: 'radio', label: 'Lab',      value: 'Lab',      checked: true },
        { type: 'radio', label: 'Imaging',  value: 'Imaging' },
        { type: 'radio', label: 'Referral', value: 'Referral' },
        { type: 'radio', label: 'Other',    value: 'Other' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Next',
          handler: (cat: OrderCategory) => {
            if (!cat) return false;
            void this.promptDetails(cat);
            return true;
          },
        },
      ],
    });
    await catA.present();
  }

  private async promptDetails(category: OrderCategory): Promise<void> {
    const a = await this.alerts.create({
      header: `Add ${category}`,
      inputs: [
        { name: 'name',     type: 'text', placeholder: category === 'Referral' ? 'Specialty / provider' : 'Order name' },
        { name: 'priority', type: 'text', placeholder: 'Priority (Routine / Urgent / STAT)' },
        { name: 'notes',    type: 'textarea', placeholder: 'Notes (optional)' },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add',
          handler: (d) => {
            const name = d?.name?.trim();
            if (!name) return false;
            void this.store.addOrder({
              category,
              name,
              priority: d?.priority?.trim() || 'Routine',
              notes: d?.notes?.trim(),
            }).then(() => this.haptics.light());
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async complete(id: number, label: string): Promise<void> {
    await this.store.completeOrder(id);
    await this.haptics.success();
    await this.toasts.success(`${label}: marked complete`);
  }

  async remove(id: number, label: string): Promise<void> {
    const a = await this.alerts.create({
      header: 'Delete order?',
      message: label,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void this.store.removeOrder(id).then(() => this.haptics.medium());
            return true;
          },
        },
      ],
    });
    await a.present();
  }
}
