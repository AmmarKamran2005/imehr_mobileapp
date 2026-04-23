import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DayCell {
  date: Date;
  dayLabel: string;      // MON
  dayNum: number;
  isToday: boolean;
  isSelected: boolean;
  iso: string;
}

/**
 * Horizontal scrollable date strip covering -2 … +4 days around today,
 * mirrors the mockup. Emits the picked Date upstream; the Schedule page
 * re-fetches the appointment list with the new date.
 */
@Component({
  selector: 'app-date-strip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="strip strip-scroll">
      @for (cell of cells(); track cell.iso) {
        <button
          type="button"
          class="chip"
          [class.active]="cell.isSelected"
          [class.today]="cell.isToday"
          (click)="pick.emit(cell.date)"
        >
          <span class="d-day">{{ cell.dayLabel }}</span>
          <span class="d-num">{{ cell.dayNum }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    /* Seven chips distributed evenly across the full width, no scroll.
       Each chip stretches (flex: 1) so the row fills edge-to-edge —
       removes the right-hand gap that used to show on wider phones. */
    .strip {
      display: flex;
      gap: 6px;
      margin: 14px 0 10px;
      padding: 0 2px 4px;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .strip::-webkit-scrollbar { display: none; }

    .chip {
      flex: 1 1 0;
      min-width: 44px;
      padding: 10px 4px;
      background: var(--imehr-surface-2);
      border: 1px solid var(--imehr-border);
      border-radius: var(--imehr-radius);
      text-align: center;
      cursor: pointer;
      transition: all 0.15s ease;
      font-family: inherit;
    }
    .chip .d-day {
      display: block;
      font-size: 11px;
      color: var(--imehr-text-3);
      font-weight: 600;
      text-transform: uppercase;
    }
    .chip .d-num {
      display: block;
      font-size: 18px;
      font-weight: 700;
      color: var(--ion-text-color);
      margin-top: 2px;
    }
    .chip.active {
      background: var(--ion-color-primary);
      border-color: var(--ion-color-primary);
    }
    .chip.active .d-day,
    .chip.active .d-num { color: #fff; }
    .chip.today::after {
      content: '';
      display: block;
      width: 4px; height: 4px;
      border-radius: 50%;
      background: var(--ion-color-primary);
      margin: 4px auto 0;
    }
    .chip.active.today::after { background: #fff; }
  `],
})
export class DateStripComponent {
  readonly selected = input.required<Date>();
  readonly range = input<{ back: number; forward: number }>({ back: 2, forward: 4 });
  readonly pick = output<Date>();

  readonly cells = computed<DayCell[]>(() => {
    const sel = this.selected();
    const { back, forward } = this.range();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: DayCell[] = [];
    const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let i = -back; i <= forward; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      days.push({
        date: d,
        dayLabel: DOW[d.getDay()],
        dayNum: d.getDate(),
        isToday: i === 0,
        isSelected: d.toDateString() === sel.toDateString(),
        iso,
      });
    }
    return days;
  });
}
