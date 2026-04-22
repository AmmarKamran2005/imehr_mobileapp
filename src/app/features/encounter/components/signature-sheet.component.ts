import {
  AfterViewInit, Component, ElementRef, inject, input, output, signal, viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';

/**
 * Signature capture overlay used by Checkout (Phase 7).
 *
 * Drawn paths are vectorized on the fly, the final PNG data-URL is emitted
 * via `confirmed`. No paths are kept in memory once the sheet closes — we
 * send the raster to the server and move on.
 */
@Component({
  selector: 'app-signature-sheet',
  standalone: true,
  imports: [CommonModule, IonIcon],
  template: `
    <div class="backdrop" (click)="cancel()"></div>
    <div class="sheet">
      <div class="handle"></div>
      <header>
        <h2>{{ title() }}</h2>
        <button class="icon-btn" (click)="cancel()" aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
      </header>

      <p class="muted">{{ subtitle() }}</p>

      <canvas
        #canvas
        class="canvas"
        (pointerdown)="onDown($event)"
        (pointermove)="onMove($event)"
        (pointerup)="onUp($event)"
        (pointerleave)="onUp($event)"
        (pointercancel)="onUp($event)"
      ></canvas>

      <div class="actions">
        <button class="btn ghost" (click)="clear()" [disabled]="empty()">
          <ion-icon name="refresh-outline"></ion-icon> Clear
        </button>
        <button class="btn primary" (click)="confirm()" [disabled]="empty()">
          <ion-icon name="checkmark-circle-outline"></ion-icon> Confirm &amp; Sign
        </button>
      </div>

      <p class="foot muted-soft tiny">By tapping Confirm &amp; Sign you attest the entries in this note are accurate.</p>
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 500;
      display: block;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.55);
      animation: fade 0.18s ease;
    }
    .sheet {
      position: absolute;
      left: 0; right: 0; bottom: 0;
      background: var(--ion-item-background);
      border-radius: var(--imehr-radius-xl) var(--imehr-radius-xl) 0 0;
      padding: 8px 18px calc(20px + env(safe-area-inset-bottom));
      max-height: 92%;
      overflow-y: auto;
      animation: up 0.22s ease;
    }
    @keyframes fade { from { opacity: 0; } }
    @keyframes up { from { transform: translateY(100%); } }

    .handle {
      width: 36px; height: 4px;
      background: var(--imehr-border-strong);
      border-radius: 2px;
      margin: 4px auto 10px;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    header h2 { margin: 0; font-size: 17px; font-weight: 700; }

    .icon-btn {
      width: 40px; height: 40px;
      border-radius: 50%;
      border: 0;
      background: transparent;
      color: var(--ion-text-color);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .icon-btn:hover { background: var(--imehr-surface-2); }

    .muted { margin: 0 0 12px; color: var(--imehr-text-2); font-size: 13.5px; }
    .muted-soft { color: var(--imehr-text-3); }
    .tiny { font-size: 11.5px; }

    .canvas {
      display: block;
      width: 100%;
      height: 220px;
      background: var(--imehr-surface-2);
      border: 1.5px dashed var(--imehr-border-strong);
      border-radius: var(--imehr-radius);
      margin-bottom: 12px;
      touch-action: none;
      cursor: crosshair;
    }

    .actions {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
    }
    .btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 16px;
      border-radius: var(--imehr-radius);
      font-family: inherit;
      font-size: 14px;
      font-weight: 700;
      border: 1px solid transparent;
      cursor: pointer;
    }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn ion-icon { font-size: 18px; }
    .btn.ghost {
      background: var(--imehr-surface-2);
      color: var(--ion-text-color);
      border-color: var(--imehr-border);
    }
    .btn.primary {
      background: var(--ion-color-primary);
      color: #fff;
      box-shadow: 0 4px 14px rgba(11, 99, 206, 0.3);
    }

    .foot { text-align: center; margin: 0; }
  `],
})
export class SignatureSheetComponent implements AfterViewInit {
  readonly title    = input<string>('Sign clinical note');
  readonly subtitle = input<string>('Sign below. Your signature will be attached to this note.');

  readonly confirmed = output<string>();   // PNG data URL
  readonly closed    = output<void>();

  readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  readonly empty = signal<boolean>(true);

  private ctx: CanvasRenderingContext2D | null = null;
  private drawing = false;
  private last: { x: number; y: number } | null = null;

  ngAfterViewInit(): void {
    this.resize();
    window.addEventListener('resize', this.resize, { passive: true });
  }

  private resize = (): void => {
    const c = this.canvasRef()?.nativeElement;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    this.ctx = c.getContext('2d');
    if (!this.ctx) return;
    this.ctx.scale(ratio, ratio);
    this.ctx.lineWidth = 2.4;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--ion-text-color').trim() || '#0f172a';
  };

  private pt(e: PointerEvent): { x: number; y: number } {
    const rect = this.canvasRef()!.nativeElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onDown(e: PointerEvent): void {
    if (!this.ctx) return;
    e.preventDefault();
    this.drawing = true;
    this.last = this.pt(e);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  onMove(e: PointerEvent): void {
    if (!this.drawing || !this.ctx || !this.last) return;
    e.preventDefault();
    const p = this.pt(e);
    this.ctx.beginPath();
    this.ctx.moveTo(this.last.x, this.last.y);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.last = p;
    if (this.empty()) this.empty.set(false);
  }

  onUp(_e: PointerEvent): void {
    this.drawing = false;
    this.last = null;
  }

  clear(): void {
    const c = this.canvasRef()?.nativeElement;
    if (c && this.ctx) this.ctx.clearRect(0, 0, c.width, c.height);
    this.empty.set(true);
  }

  confirm(): void {
    const c = this.canvasRef()?.nativeElement;
    if (!c || this.empty()) return;
    this.confirmed.emit(c.toDataURL('image/png'));
  }

  cancel(): void {
    this.closed.emit();
  }
}
