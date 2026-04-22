import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonIcon, AlertController } from '@ionic/angular/standalone';

import { EncounterStore } from 'src/app/core/services/encounter.store';
import { CheckoutService } from 'src/app/core/services/checkout.service';
import { ClinicalNotesService } from 'src/app/core/services/clinical-notes.service';
import { ToastService } from 'src/app/core/ui/toast.service';
import { HapticsService } from 'src/app/core/ui/haptics.service';
import { LoggerService } from 'src/app/core/logger/logger.service';

import { NoteStatus } from 'src/app/core/models/clinical-note.model';
import { formatTime12 } from 'src/app/core/models/appointment.model';
import { roleLabel } from 'src/app/core/models/user.model';
import { AuthService } from 'src/app/core/auth/auth.service';

import { SignatureSheetComponent } from '../components/signature-sheet.component';

/**
 * Step 6 — Checkout.
 *
 * Validation grid mirrors the web's _renderCheckoutStep():
 *   ✓ Vitals (recorded), ✓ History (any), ✓ CC & HPI (either field),
 *   ✓ Orders (count), ✓ Clinical Notes (must be signed), ⚠ CPT codes (required).
 *
 * Required-to-close:
 *   • At least one clinical note (Draft or Signed)
 *   • All notes signed
 *   • At least one CPT code
 *
 * On "Sign All Notes & Close Encounter":
 *   1. Open SignatureSheet — user draws → PNG data URL.
 *   2. For each Draft note on the appointment → POST /sign with the signature.
 *   3. POST /checkout-with-cpt with final ICD + CPT arrays.
 *   4. Navigate back to schedule with a success toast + haptic.
 */
@Component({
  selector: 'app-step-checkout',
  standalone: true,
  imports: [CommonModule, IonIcon, SignatureSheetComponent],
  templateUrl: './step-checkout.component.html',
  styleUrls: ['./step-checkout.component.scss'],
})
export class StepCheckoutComponent {
  readonly store = inject(EncounterStore);
  private readonly checkout = inject(CheckoutService);
  private readonly notesApi = inject(ClinicalNotesService);
  private readonly alerts = inject(AlertController);
  private readonly toasts = inject(ToastService);
  private readonly haptics = inject(HapticsService);
  private readonly log = inject(LoggerService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly signing = signal<boolean>(false);
  readonly showSignature = signal<boolean>(false);

  readonly vitalsOk   = computed(() => this.store.completed()[0]);
  readonly historyOk  = computed(() => this.store.completed()[1]);
  readonly ccHpiOk    = computed(() => this.store.completed()[2]);
  readonly noteOk     = computed(() => this.store.completed()[3]);
  readonly ordersCt   = computed(() => this.store.orders().length);
  readonly icdCt      = computed(() => this.store.icdSelections().length);
  readonly cptCt      = computed(() => this.store.cptSelections().length);

  readonly draftNotes = computed(() => this.store.priorNotes().filter((n) => n.status === NoteStatus.Draft));
  readonly hasAnyNote = computed(() => this.store.priorNotes().length > 0 || !!this.store.clinicalNote());

  readonly canClose = computed(() =>
    this.hasAnyNote() &&
    this.draftNotes().length === 0 &&
    this.cptCt() > 0,
  );

  readonly needsSigning = computed(() => this.draftNotes().length > 0);

  readonly visitDuration = computed(() => {
    const a = this.store.appointment();
    if (!a) return '—';
    const start = formatTime12(a.startTime);
    const end   = a.endTime ? formatTime12(a.endTime) : null;
    return end ? `${start.hour} ${start.mer} – ${end.hour} ${end.mer}` : `${start.hour} ${start.mer}`;
  });

  readonly providerLine = computed(() => {
    const a = this.store.appointment();
    const u = this.auth.user();
    return a?.providerName ?? u?.fullName ?? '—';
  });

  readonly roleChip = computed(() => {
    const u = this.auth.user();
    return u ? roleLabel(u.role) : '';
  });

  openSignature(): void { this.showSignature.set(true); }
  closeSignature(): void { this.showSignature.set(false); }

  async onSignatureConfirmed(png: string): Promise<void> {
    this.showSignature.set(false);
    await this.performCheckout(png);
  }

  async saveAndExit(): Promise<void> {
    await this.haptics.light();
    await this.toasts.success('Saved · continue later');
    void this.router.navigate(['/tabs/schedule']);
  }

  private async performCheckout(signatureData: string): Promise<void> {
    const appt = this.store.appointment();
    if (!appt || this.signing()) return;
    this.signing.set(true);

    try {
      // 1. Sign every draft note attached to this appointment.
      for (const note of this.draftNotes()) {
        const signed = await this.checkout.signNote(note.clinicalNoteId, signatureData);
        if (signed) {
          this.store.priorNotes.update((list) =>
            list.map((n) => n.clinicalNoteId === note.clinicalNoteId ? { ...n, ...signed } : n),
          );
        } else {
          throw new Error(`Failed to sign note ${note.clinicalNoteId}`);
        }
      }

      // 2. Close the appointment with the final code set.
      const done = await this.checkout.checkoutAppointment(appt.appointmentId, {
        icdSelections: this.store.icdSelections(),
        cptSelections: this.store.cptSelections(),
      });
      if (!done) throw new Error('Checkout call failed');

      await this.haptics.success();
      await this.toasts.success('Encounter signed & closed');
      void this.router.navigate(['/tabs/schedule']);
    } catch (e) {
      this.log.warn('Checkout', 'performCheckout failed', e);
      await this.haptics.error();
      await this.toasts.error('Could not close the encounter. Please try again.');
    } finally {
      this.signing.set(false);
    }
  }

  /** Soft guardrail prompt when user taps Close without meeting prereqs. */
  async whyCantClose(): Promise<void> {
    const reasons: string[] = [];
    if (!this.hasAnyNote()) reasons.push('• At least one clinical note is required.');
    if (this.draftNotes().length > 0) reasons.push(`• ${this.draftNotes().length} draft note(s) must be signed.`);
    if (this.cptCt() === 0) reasons.push('• At least one CPT code is required.');
    const a = await this.alerts.create({
      header: 'Not ready to close',
      message: reasons.join('\n') || 'The encounter is not ready to close yet.',
      buttons: ['OK'],
    });
    await a.present();
  }
}
