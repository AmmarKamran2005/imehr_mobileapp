import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
  logInOutline, arrowBackOutline, arrowForwardOutline, shieldCheckmarkOutline,
  checkmarkCircleOutline, fingerPrintOutline, fingerPrint,
  notificationsOutline, searchOutline, medkitOutline, heartOutline,
  personCircleOutline, playCircle, playCircleOutline, playForwardOutline,
  timeOutline, documentTextOutline, createOutline, mic, micOutline, stop,
  sparklesOutline, alertCircle, alertCircleOutline, chevronDown, chevronUp,
  chevronForward, chevronBack,
  chevronDownOutline, chevronUpOutline, chevronForwardOutline, chevronBackOutline,
  close, closeOutline, checkmarkCircle, personOutline,
  returnDownBackOutline, scanOutline,
  peopleOutline, menuOutline, calendarOutline, calendarNumberOutline,
  ellipsisHorizontal, optionsOutline, callOutline, chatbubbleOutline,
  chatbubbleEllipsesOutline, locationOutline, medicalOutline,
  warningOutline, pulseOutline, cafeOutline, refreshOutline, save,
  saveOutline, swapHorizontalOutline, videocamOutline, closeCircleOutline,
  flaskOutline, bandageOutline, clipboardOutline, attachOutline,
  documentLockOutline, walletOutline, cardOutline, briefcaseOutline,
  layersOutline, pricetagOutline, listOutline, add, moonOutline, contrastOutline,
  cloudOfflineOutline, keyOutline, phonePortraitOutline, informationCircleOutline,
  logOutOutline, settingsOutline, personAddOutline, downloadOutline,
  cloudUploadOutline, starOutline, star, pricetagsOutline,
  homeOutline,
} from 'ionicons/icons';

import { NetworkService } from './core/network/network.service';
import { InactivityService } from './core/auth/inactivity.service';
import { ThemeService } from './core/ui/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `,
  styles: [],
})
export class AppComponent implements OnInit {
  private readonly network = inject(NetworkService);
  private readonly inactivity = inject(InactivityService);
  private readonly theme = inject(ThemeService);

  constructor() {
    addIcons({
      mailOutline, lockClosedOutline, eyeOutline, eyeOffOutline,
      logInOutline, arrowBackOutline, arrowForwardOutline, shieldCheckmarkOutline,
      checkmarkCircleOutline, fingerPrintOutline, fingerPrint,
      notificationsOutline, searchOutline, medkitOutline, heartOutline,
      personCircleOutline, playCircle, playCircleOutline, playForwardOutline,
      timeOutline, documentTextOutline, createOutline, mic, micOutline, stop,
      sparklesOutline, alertCircle, alertCircleOutline, chevronDown, chevronUp,
      chevronForward, chevronBack,
      chevronDownOutline, chevronUpOutline, chevronForwardOutline, chevronBackOutline,
      close, closeOutline, checkmarkCircle, personOutline,
      returnDownBackOutline, scanOutline,
      peopleOutline, menuOutline, calendarOutline, calendarNumberOutline,
      ellipsisHorizontal, optionsOutline, callOutline, chatbubbleOutline,
      chatbubbleEllipsesOutline, locationOutline, medicalOutline,
      warningOutline, pulseOutline, cafeOutline, refreshOutline, save,
      saveOutline, swapHorizontalOutline, videocamOutline, closeCircleOutline,
      flaskOutline, bandageOutline, clipboardOutline, attachOutline,
      documentLockOutline, walletOutline, cardOutline, briefcaseOutline,
      layersOutline, pricetagOutline, listOutline, add, moonOutline, contrastOutline,
      cloudOfflineOutline, keyOutline, phonePortraitOutline, informationCircleOutline,
      logOutOutline, settingsOutline, personAddOutline, downloadOutline,
      cloudUploadOutline, starOutline, star, pricetagsOutline,
      homeOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    await this.theme.init();
    await this.network.init();
    this.inactivity.init();
  }
}
