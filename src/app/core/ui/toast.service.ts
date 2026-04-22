import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular/standalone';

type ToastKind = 'success' | 'warning' | 'danger' | 'neutral';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toasts = inject(ToastController);

  async show(message: string, kind: ToastKind = 'neutral', durationMs = 2200): Promise<void> {
    const t = await this.toasts.create({
      message,
      duration: durationMs,
      position: 'bottom',
      color: kind === 'neutral' ? undefined : kind,
      swipeGesture: 'vertical',
      cssClass: 'imehr-toast',
    });
    await t.present();
  }

  success(msg: string): Promise<void> { return this.show(msg, 'success'); }
  warn(msg: string):    Promise<void> { return this.show(msg, 'warning'); }
  error(msg: string):   Promise<void> { return this.show(msg, 'danger', 3200); }
}
