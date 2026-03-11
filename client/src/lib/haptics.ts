/**
 * Haptic feedback utility using navigator.vibrate
 * Gracefully degrades on non-supporting devices/browsers
 */

/** Check if haptic feedback is supported */
const isHapticsSupported = (): boolean => {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
};

/**
 * Short single pulse — for sending a message
 * Pattern: 40ms vibration
 */
export const hapticSend = (): void => {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(40);
  } catch {
    // Silently ignore on unsupported devices
  }
};

/**
 * Double pulse — for saving a form / confirming an action
 * Pattern: 30ms on, 60ms off, 30ms on
 */
export const hapticSave = (): void => {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate([30, 60, 30]);
  } catch {
    // Silently ignore on unsupported devices
  }
};

/**
 * Strong single vibration — for deleting an item (destructive action)
 * Pattern: 80ms vibration
 */
export const hapticDelete = (): void => {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(80);
  } catch {
    // Silently ignore on unsupported devices
  }
};

/**
 * Light tap — for general UI interactions
 * Pattern: 20ms vibration
 */
export const hapticTap = (): void => {
  if (!isHapticsSupported()) return;
  try {
    navigator.vibrate(20);
  } catch {
    // Silently ignore on unsupported devices
  }
};
