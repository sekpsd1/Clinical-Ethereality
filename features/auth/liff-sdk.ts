type LiffClient = {
  init: (config: { liffId: string }) => Promise<void>;
  isInClient: () => boolean;
  isLoggedIn: () => boolean;
  login: (config?: { redirectUri?: string }) => void;
  logout: () => void;
  openWindow: (config: { url: string; external: boolean }) => void;
  closeWindow: () => void;
  getIDToken: () => string | null;
  getAccessToken: () => string | null;
};

declare global {
  interface Window {
    liff?: LiffClient;
  }
}

export function loadLiffSdk(): Promise<LiffClient> {
  if (window.liff) {
    return Promise.resolve(window.liff);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://static.line-scdn.net/liff/edge/2/sdk.js"]');

    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (window.liff) {
          resolve(window.liff);
        } else {
          reject(new Error("LINE LIFF SDK did not initialize."));
        }
      });
      existingScript.addEventListener("error", () => reject(new Error("Unable to load LINE LIFF SDK.")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
    script.async = true;
    script.onload = () => {
      if (window.liff) {
        resolve(window.liff);
      } else {
        reject(new Error("LINE LIFF SDK did not initialize."));
      }
    };
    script.onerror = () => reject(new Error("Unable to load LINE LIFF SDK."));
    document.head.appendChild(script);
  });
}
