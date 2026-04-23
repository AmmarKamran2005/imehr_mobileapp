import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon,
} from '@ionic/angular/standalone';

/**
 * Bottom-tab shell. Three tabs matching the mockup:
 *   Schedule · Patients · More
 * Encounter wizard + appointment detail push OVER these tabs (tab bar is
 * hidden on those full-screen routes).
 */
@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [CommonModule, IonTabs, IonTabBar, IonTabButton, IonLabel, IonIcon],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom">
        <ion-tab-button tab="schedule">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="patients">
          <ion-icon name="people-outline"></ion-icon>
          <ion-label>Patients</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="more">
          <ion-icon name="menu-outline"></ion-icon>
          <ion-label>More</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
})
export class TabsPage {}
