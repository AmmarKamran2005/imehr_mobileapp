import { Injectable, effect, inject, signal } from '@angular/core';
import {
  HubConnection, HubConnectionBuilder, HubConnectionState,
  LogLevel, HttpTransportType, IHttpConnectionOptions,
} from '@microsoft/signalr';
import { Subject } from 'rxjs';

import { environment } from 'src/environments/environment';
import { LoggerService } from '../logger/logger.service';
import { AuthService } from '../auth/auth.service';

/**
 * Server events we care about on mobile.
 *
 * - ScheduleNotificationHub (/hubs/schedule):
 *     AppointmentChanged      — any appointment create / update / cancel
 *     ClinicalNoteChanged     — signed / amended note
 *     AuthorizationChanged    — insurance auth updates (future use)
 *
 * - MobileHub (/hubs/mobile):
 *     WriteReportClosed       — emitted when an embedded webview closes a
 *                               note; we don't embed a webview on mobile yet
 *                               but we subscribe so the hook is in place.
 */
export type ScheduleEvent =
  | { kind: 'appointment-changed'; payload: unknown }
  | { kind: 'note-changed';        payload: unknown }
  | { kind: 'auth-changed';        payload: unknown };

/**
 * Long-lived SignalR client.
 *
 * Connection lifecycle:
 *   • Hooked to AuthService — connects once a user is authenticated,
 *     disconnects on logout so tokens don't leak into hubs after signout.
 *   • Exponential backoff + auto-reconnect via the built-in policy.
 *   • Observable subjects for each hub so pages don't care about raw hub
 *     handles.
 *   • `connectionState` signal surfaces the live state for an offline /
 *     reconnecting indicator in the UI when we want to wire it.
 *
 * Why start() isn't called from the ctor: running before APP_INITIALIZER
 * finishes means no token yet — we'd fail the negotiate handshake. Pages
 * that need SignalR call ensureStarted() in their ngOnInit.
 */
@Injectable({ providedIn: 'root' })
export class SignalRService {
  private readonly log = inject(LoggerService);
  private readonly auth = inject(AuthService);

  private schedule: HubConnection | null = null;
  private mobile: HubConnection | null = null;

  readonly schedule$ = new Subject<ScheduleEvent>();
  readonly mobile$   = new Subject<{ kind: 'write-report-closed'; payload: unknown }>();

  readonly connectionState = signal<'disconnected' | 'connecting' | 'connected' | 'reconnecting'>('disconnected');

  constructor() {
    // Drop hub connections when the user signs out so tokens don't leak.
    let wasAuthed = this.auth.isAuthenticated();
    effect(() => {
      const authed = this.auth.isAuthenticated();
      if (wasAuthed && !authed) void this.stop();
      wasAuthed = authed;
    });
  }

  /** Called lazily by pages that subscribe to realtime events. */
  async ensureStarted(): Promise<void> {
    if (!this.auth.isAuthenticated()) return;
    if (this.schedule?.state === HubConnectionState.Connected && this.mobile?.state === HubConnectionState.Connected) {
      return;
    }
    this.connectionState.set('connecting');
    await Promise.all([this.startSchedule(), this.startMobile()]);
    this.connectionState.set('connected');
  }

  /** Graceful teardown — the auth layer calls this on logout. */
  async stop(): Promise<void> {
    const tasks: Promise<void>[] = [];
    if (this.schedule) tasks.push(this.schedule.stop().catch(() => {}));
    if (this.mobile)   tasks.push(this.mobile.stop().catch(() => {}));
    await Promise.all(tasks);
    this.schedule = null;
    this.mobile = null;
    this.connectionState.set('disconnected');
  }

  /* ============================================================
     Hub: schedule
     ============================================================ */
  private async startSchedule(): Promise<void> {
    if (this.schedule?.state === HubConnectionState.Connected) return;

    const conn = new HubConnectionBuilder()
      .withUrl(`${environment.hubBaseUrl}/hubs/schedule`, this.httpOptions())
      .withAutomaticReconnect([0, 2000, 5000, 10_000, 30_000])
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();

    conn.on('AppointmentChanged', (payload: unknown) => {
      this.log.debug('SignalR', 'AppointmentChanged', payload);
      this.schedule$.next({ kind: 'appointment-changed', payload });
    });
    conn.on('ClinicalNoteChanged', (payload: unknown) => {
      this.log.debug('SignalR', 'ClinicalNoteChanged', payload);
      this.schedule$.next({ kind: 'note-changed', payload });
    });
    conn.on('AuthorizationChanged', (payload: unknown) => {
      this.log.debug('SignalR', 'AuthorizationChanged', payload);
      this.schedule$.next({ kind: 'auth-changed', payload });
    });

    conn.onreconnecting((err) => {
      this.log.warn('SignalR', 'schedule reconnecting', err?.message ?? '');
      this.connectionState.set('reconnecting');
    });
    conn.onreconnected(() => {
      this.log.info('SignalR', 'schedule reconnected');
      this.connectionState.set('connected');
    });
    conn.onclose((err) => {
      this.log.warn('SignalR', 'schedule closed', err?.message ?? '');
      this.connectionState.set('disconnected');
    });

    try {
      await conn.start();
      this.schedule = conn;
      this.log.info('SignalR', 'schedule connected');
    } catch (e) {
      this.log.warn('SignalR', 'schedule connect failed', e);
    }
  }

  /* ============================================================
     Hub: mobile
     ============================================================ */
  private async startMobile(): Promise<void> {
    if (this.mobile?.state === HubConnectionState.Connected) return;

    const conn = new HubConnectionBuilder()
      .withUrl(`${environment.hubBaseUrl}/hubs/mobile`, this.httpOptions())
      .withAutomaticReconnect([0, 2000, 5000, 10_000, 30_000])
      .configureLogging(environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();

    conn.on('WriteReportClosed', (payload: unknown) => {
      this.log.debug('SignalR', 'WriteReportClosed', payload);
      this.mobile$.next({ kind: 'write-report-closed', payload });
    });

    conn.onclose((err) => {
      this.log.warn('SignalR', 'mobile closed', err?.message ?? '');
    });

    try {
      await conn.start();
      this.mobile = conn;
      this.log.info('SignalR', 'mobile connected');
    } catch (e) {
      this.log.warn('SignalR', 'mobile connect failed', e);
    }
  }

  /* ============================================================
     Helpers
     ============================================================ */
  private httpOptions(): IHttpConnectionOptions {
    return {
      accessTokenFactory: () => this.auth.token() ?? '',
      // WebSockets first; fall back to SSE / long-poll so dev tunnels behave.
      transport:
        HttpTransportType.WebSockets |
        HttpTransportType.ServerSentEvents |
        HttpTransportType.LongPolling,
      withCredentials: true,
    };
  }
}
