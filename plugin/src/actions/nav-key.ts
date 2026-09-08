/**
 * MASH fork: a plain navigation key placed on the apps page of the bundled
 * Stream Deck + profile. Press → back to page 1 (the session grid).
 */
import streamDeck, { action, SingletonAction, type KeyDownEvent, type WillAppearEvent } from '@elgato/streamdeck';
import { renderBackButton } from '../renderers/session-slot-renderer.js';
import { svgToDataUrl } from '../renderers/button-renderer.js';
import { dlog } from '../log.js';

interface NavKeySettings {
  [key: string]: unknown;
  /** Page index of the bundled profile to jump to (default 0 = sessions). */
  page?: number;
}

@action({ UUID: 'bound.serendipity.agentdeck.nav-key' })
export class NavKeyAction extends SingletonAction<NavKeySettings> {
  override async onWillAppear(ev: WillAppearEvent<NavKeySettings>): Promise<void> {
    await ev.action.setImage(svgToDataUrl(renderBackButton())).catch(() => {});
  }

  override async onKeyDown(ev: KeyDownEvent<NavKeySettings>): Promise<void> {
    const page = typeof ev.payload.settings?.page === 'number' ? ev.payload.settings.page : 0;
    const deviceId = String(ev.action.device.id);
    dlog('NavKey', `→ agentdeck-sdplus page ${page}`);
    await streamDeck.profiles.switchToProfile(deviceId, 'agentdeck-mash', page)
      .catch((e) => dlog('NavKey', `switch failed: ${(e as Error).message}`));
  }
}
