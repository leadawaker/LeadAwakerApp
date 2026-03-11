/**
 * PWA utilities for push notification support.
 *
 * iOS Safari requires the app to be installed via "Add to Home Screen"
 * before push notifications can work. These helpers let UI components
 * detect the current state and show appropriate guidance.
 */

/** True when running inside a standalone PWA (home-screen installed). */
export const isStandalone =
  typeof window !== 'undefined' &&
  (window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true);

/** True on iOS Safari (where Add-to-Home-Screen is needed for push). */
export const isIOS =
  typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);

/** True when push notifications are supported by the browser. */
export const isPushSupported =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window;

/**
 * Whether the user needs to install the PWA before push can work.
 * True on iOS when the app is opened in regular Safari (not standalone).
 */
export const needsHomeScreenInstall = isIOS && !isStandalone;
