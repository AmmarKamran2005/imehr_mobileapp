import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner,
  IonRefresher, IonRefresherContent,
} from '@ionic/angular/standalone';

import { PatientsService, PatientListItem, patientInitials, patientStatusLabel } from 'src/app/core/services/patients.service';
import { LoggerService } from 'src/app/core/logger/logger.service';

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonIcon, IonSpinner,
    IonRefresher, IonRefresherContent,
  ],
  templateUrl: './patients-list.page.html',
  styleUrls: ['./patients-list.page.scss'],
})
export class PatientsListPage implements OnInit {
  private readonly patients = inject(PatientsService);
  private readonly router = inject(Router);
  private readonly log = inject(LoggerService);

  readonly items    = signal<PatientListItem[]>([]);
  readonly total    = signal<number>(0);
  readonly loading  = signal<boolean>(false);
  readonly search   = signal<string>('');
  readonly statusFilter = signal<number | 'all'>('all');

  private searchDebounce: number | null = null;

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const q = this.search().trim();
      const res = await this.patients.listPaged({
        page: 1,
        pageSize: 50,
        search: q.length >= 3 ? q : undefined,
        status: this.statusFilter() === 'all' ? undefined : this.statusFilter() as number,
      });
      this.items.set(res.items);
      this.total.set(res.totalCount);
    } finally {
      this.loading.set(false);
    }
  }

  onSearchChange(v: string): void {
    this.search.set(v);
    if (this.searchDebounce != null) clearTimeout(this.searchDebounce);
    this.searchDebounce = window.setTimeout(() => { void this.load(); }, 300);
  }

  onStatusChange(s: number | 'all'): void {
    this.statusFilter.set(s);
    void this.load();
  }

  async onRefresh(event: Event): Promise<void> {
    await this.load();
    const target = event.target as HTMLIonRefresherElement | null;
    await target?.complete();
  }

  open(p: PatientListItem): void {
    void this.router.navigate(['/patient', p.patientId]);
  }

  initials(p: PatientListItem): string {
    return patientInitials(p);
  }

  status(p: PatientListItem): { label: string; tone: string } {
    return patientStatusLabel(p.status);
  }

  displayName(p: PatientListItem): string {
    return p.fullName ?? [p.firstName, p.lastName].filter(Boolean).join(' ') ?? 'Patient';
  }

  meta(p: PatientListItem): string {
    const bits: string[] = [];
    if (p.mrn) bits.push(`MRN ${p.mrn}`);
    if (p.age != null) bits.push(`${p.age} yrs`);
    if (p.lastVisit) bits.push(`Last: ${new Date(p.lastVisit).toLocaleDateString()}`);
    return bits.join(' · ');
  }
}
