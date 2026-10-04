import { Browser } from "@capacitor/browser";
import { App } from "@capacitor/app";
import { isNativeApp } from "@/lib/nativeApp";
import { completeGoogleSignInFromUrl, isGoogleAuthCallbackUrl } from "@/lib/completeGoogleSignIn";

let listenerInstalled = false;
let handlingCallback = false;

async function closeAuthBrowser() {
  try {
    await Browser.close();
  } catch {
    /* already closed */
  }
}

async function handleCallbackUrl(url, navigate) {
  if (handlingCallback || !isGoogleAuthCallbackUrl(url)) return;
  handlingCallback = true;
  try {
    await closeAuthBrowser();
    const { destination } = await completeGoogleSignInFromUrl(url);
    if (typeof navigate === "function") {
      navigate(destination, { replace: true });
    } else {
      window.location.replace(destination);
    }
  } finally {
    handlingCallback = false;
  }
}

/**
 * Chrome Custom Tabs (in-app sheet) + deep link back — avoids full external browser.
 * @param {(path: string, opts?: object) => void} navigate
 */
export function installNativeGoogleAuthListener(navigate) {
  if (!isNativeApp() || listenerInstalled) return;
  listenerInstalled = true;

  App.addListener("appUrlOpen", (event) => {
    if (event?.url) handleCallbackUrl(event.url, navigate).catch(console.warn);
  });

  App.getLaunchUrl()
    .then((launch) => {
      if (launch?.url) handleCallbackUrl(launch.url, navigate).catch(console.warn);
    })
    .catch(() => {});
}

/** Open Google OAuth in Custom Tabs instead of leaving the app. */
export async function openGoogleOAuthInAppBrowser(authUrl) {
  await Browser.open({
    url: authUrl,
    toolbarColor: "#0c0a12",
    presentationStyle: "fullscreen",
    windowName: "_self",
  });
}
