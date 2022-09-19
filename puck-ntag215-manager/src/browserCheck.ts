declare const chrome: any
declare const window: any

export interface StatusMessage {
  error?: string
  warning?: string
}

export function isWindows() {
  return (typeof navigator !== "undefined" && navigator.userAgent.indexOf("Windows") >= 0);
}

export function isLinux() {
  return (typeof navigator !== "undefined" && navigator.userAgent.indexOf("Linux") >= 0);
}

export function isAppleDevice() {
  return (typeof navigator !== "undefined" && typeof window !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream)
}

export function isChrome() {
  return navigator.userAgent.indexOf("Chrome") >= 0;
}

export function isFirefox() {
  return navigator.userAgent.indexOf("Firefox") >= 0;
}

export function getChromeVersion() {
  return parseInt(window.navigator.appVersion.match(/Chrome\/(.*?) /)[1].split(".")[0], 10)
}

export function isChromeWebApp() {
  return typeof chrome === "object" && chrome.app && chrome.app.window
}

export function isProgressiveWebApp() {
  return (
    !isChromeWebApp() &&
    window &&
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches
  )
}

export const supportsBluetooth = ((): true | string => {
  if (typeof navigator === "undefined") {
    return "Not running in a browser"
  }

  if (!navigator.bluetooth) {
    if (isAppleDevice()) {
      return "Safari on iOS has no Web Bluetooth support. You need to use <a href=\"https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055\" target=\"_blank\">Bluefy – Web BLE Browser</a>"
    } else if (isChrome() && isLinux()) {
      return "Chrome on Linux requires <code>chrome://flags/#enable-experimental-web-platform-features</code> to be enabled."
    } else if (isFirefox()) {
      return "Firefox doesn't support Web Bluetooth - try using Chrome"
    } else {
      return "No navigator.bluetooth. Do you have a supported browser?"
    }
  }

  return true
})()

/***
* If bluetooth is currently unavailable, an error is thrown if it is not.
*
* The function will also return a boolean.
*/
export async function bluetoothOrError() {
  if (supportsBluetooth !== true || (navigator.bluetooth && navigator.bluetooth.getAvailability && await navigator.bluetooth.getAvailability() !== true)) {
    throw new Error("Bluetooth is not currently available.")
  }

  return true
}
