import { Component, computed, inject, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon, AlertController } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { VoiceService } from 'src/app/core/services/voice.service';
import { VoiceTabKey } from 'src/app/core/models/voice.model';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { ToastService } from 'src/app/core/ui/toast.service';

/**
 * Unified Voice Bar — AI Scribe pill pinned at the top of Vitals / History /
 * CC & HPI steps. Visuals mirror the mockup's voice-bar.
 *
 * Responsibilities:
 *   - One-tap start/stop of a recording session bound to the current step.
 *   - Handoff chunk responses to EncounterStore.applyVoiceChunk() which
 *     patches extracted fields into vitals / CC / HPI.
 *   - Live transcription panel (expandable).
 *   - Permission-denied state with a "how to enable" affordance.
 *
 * All mic / upload / session state lives in VoiceService — this component
 * is the glass on top.
 */
@Component({
  selector: 'app-voice-bar',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="bar" [class.recording]="isRecording()" [class.err]="isError()">
      <button
        class="mic"
        type="button"
        [attr.aria-label]="isRecording() ? 'Stop voice entry' : 'Start voice entry'"
        (click)="toggle()"
      >
        <ion-icon [name]="micIcon()"></ion-icon>
      </button>

      <div class="body">
        <p class="title">{{ title() }}</p>
        <p class="meta">{{ meta() }}</p>
      </div>

      <button class="chev" type="button" (click)="toggleExpanded()" aria-label="Toggle transcription">
        <ion-icon [name]="expanded() ? 'chevron-up' : 'chevron-down'"></ion-icon>
      </button>
    </div>

    @if (expanded()) {
      <div class="panel">
        <p class="label">Live transcription</p>
        <p class="text" [class.dim]="!transcript()">
          {{ transcript() || 'Nothing captured yet. Tap the mic and start speaking.' }}
        </p>
        <p class="meta">
          {{ session()?.sequenceNumber ?? 0 }} chunks · {{ duration() }}
          @if (isRecording()) { · Auto-uploading… }
        </p>
      </div>
    }
  `,
  styles: [`
    :host { display: block; margin: 12px 14px 0; }

    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px 10px 10px;
      background: linear-gradient(135deg, var(--ion-color-primary), #0891b2);
      border-radius: var(--imehr-radius);
      color: #fff;
      box-shadow: 0 6px 20px rgba(11, 99, 206, 0.25);
    }
    .bar.err {
      background: linear-gradient(135deg, var(--ion-color-danger), #b91c1c);
      box-shadow: 0 6px 20px rgba(220, 38, 38, 0.3);
    }
    .mic {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: #fff;
      color: var(--ion-color-primary);
      border: 0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: transform 0.1s ease;
    }
    .mic ion-icon { font-size: 22px; }
    .mic:active { transform: scale(0.94); }
    .bar.recording .mic {
      background: var(--ion-color-danger);
      color: #fff;
      animation: rec 1.3s ease-in-out infinite;
    }
    @keyframes rec {
      0%,100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
      50%     { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
    }

    .body { flex: 1; min-width: 0; }
    .title { margin: 0; font-size: 14px; font-weight: 700; }
    .meta { margin: 2px 0 0; color: rgba(255,255,255,0.85); font-size: 12px; }

    .chev {
      width: 40px; height: 40px;
      background: transparent;
      border: 0;
      color: #fff;
      cursor: pointer;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .chev:hover { background: rgba(255,255,255,0.15); }

    .panel {
      margin: -4px 0 0;
      padding: 12px 14px;
      background: var(--imehr-surface-2);
      border: 1px solid var(--imehr-border);
      border-top: 0;
      border-radius: 0 0 var(--imehr-radius) var(--imehr-radius);
      animation: fade 0.2s ease;
    }
    @keyframes fade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .panel .label {
      margin: 0 0 4px;
      font-size: 11px;
      color: var(--imehr-text-3);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .panel .text {
      margin: 0 0 8px;
      font-size: 13.5px;
      line-height: 1.5;
      color: var(--ion-text-color);
      white-space: pre-wrap;
    }
    .panel .text.dim { color: var(--imehr-text-3); font-style: italic; }
    .panel .meta { margin: 0; font-size: 11.5px; color: var(--imehr-text-3); }
  `],
})
export class VoiceBarComponent {
  private readonly store = inject(EncounterStore);
  private readonly voice = inject(VoiceService);
  private readonly haptics = inject(HapticsService);
  private readonly toasts = inject(ToastService);
  private readonly alerts = inject(AlertController);

  /** Which step this bar is embedded in — drives the `tabKey`. */
  readonly tabKey = input.required<VoiceTabKey>();

  readonly expanded = signal<boolean>(false);

  readonly status = this.voice.status;
  readonly session = this.voice.session;
  readonly transcript = this.voice.transcript;
  readonly err = this.voice.errorMsg;

  readonly isRecording = computed(() => this.status() === 'recording');
  readonly isError = computed(() => this.status() === 'error' || this.status() === 'permission-denied');

  readonly title = computed(() => {
    switch (this.status()) {
      case 'requesting-permission': return 'Allow microphone access';
      case 'starting':              return 'Preparing…';
      case 'recording':             return 'Recording…';
      case 'processing':            return 'Processing…';
      case 'permission-denied':     return 'Microphone blocked';
      case 'error':                 return this.err() ?? 'Something went wrong';
      default:                      return 'Start AI Voice Entry';
    }
  });

  readonly meta = computed(() => {
    const tab = this.tabKey();
    switch (this.status()) {
      case 'recording':
        return 'Speak naturally — fields will fill as you talk';
      case 'permission-denied':
        return 'Tap to request access';
      case 'error':
        return 'Tap to try again';
      default:
        if (tab === 'vitals' || tab === 'history' || tab === 'cc-hpi') {
          return 'Fills Vitals, History Review & CC/HPI from your conversation';
        }
        return 'AI Scribe';
    }
  });

  readonly micIcon = computed(() => this.isRecording() ? 'stop' : 'mic-outline');

  readonly duration = computed(() => {
    const s = this.session();
    if (!s) return '00:00';
    const total = s.totalSeconds;
    const mm = Math.floor(total / 60).toString().padStart(2, '0');
    const ss = Math.floor(total % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  });

  async toggle(): Promise<void> {
    if (this.isRecording()) {
      await this.stopSession();
    } else {
      await this.startSession();
    }
  }

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }

  private async startSession(): Promise<void> {
    const appt = this.store.appointment();
    const enc = this.store.encounter();
    if (!appt) { await this.toasts.error('No active appointment'); return; }

    await this.haptics.medium();
    this.expanded.set(true);

    const ok = await this.voice.start(
      {
        tabKey: this.tabKey(),
        patientId: appt.patientId,
        encounterId: enc?.encounterId ?? null,
      },
      (resp) => this.store.applyVoiceChunk(resp),
    );

    if (!ok) {
      if (this.status() === 'permission-denied') {
        await this.showPermissionHelp();
      } else if (this.err()) {
        await this.toasts.error(this.err()!);
      }
    }
  }

  private async stopSession(): Promise<void> {
    const appt = this.store.appointment();
    const enc = this.store.encounter();
    if (!appt) return;

    await this.haptics.light();
    await this.voice.stop({
      patientId: appt.patientId,
      encounterId: enc?.encounterId ?? null,
    });
    await this.toasts.success('Recording saved');
  }

  private async showPermissionHelp(): Promise<void> {
    const alert = await this.alerts.create({
      header: 'Microphone access',
      message:
        'IMEHR needs microphone access for AI Scribe. Open your phone\'s app settings, ' +
        'enable Microphone for IMEHR, then come back and tap the mic again.',
      buttons: ['OK'],
    });
    await alert.present();
  }
}
