import { Injectable, inject, signal } from '@angular/core';
import { Network, ConnectionStatus } from '@capacitor/network';
import { LoggerService } from '../logger/logger.service';

/**
 * Observable network state. UI binds to `online()` / `connectionType()` signals
 * to render the offline banner and disable operations that need connectivity.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly log = inject(LoggerService);

  readonly online = signal(true);
  readonly connectionType = signal<string>('unknown');

  async init(): Promise<void> {
    try {
      const status = await Network.getStatus();
      this.apply(status);
      await Network.addListener('networkStatusChange', (s) => this.apply(s));
      this.log.info('Network', 'listener attached');
    } catch (e) {
      this.log.warn('Network', 'init failed', e);
    }
  }

  private apply(s: ConnectionStatus): void {
    this.online.set(s.connected);
    this.connectionType.set(s.connectionType ?? 'unknown');
    this.log.debug('Network', 'change', s);
  }
}
