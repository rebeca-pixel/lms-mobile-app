/**
 * Native bridge for the Capacitor (Android/iOS) build.
 *
 * The web app's pages/components are untouched. Everything that behaves
 * differently inside a native WebView is handled here, once, at start-up:
 *
 *  1. API base URL   - relative `/api/...` calls are pointed at the existing backend.
 *  2. File downloads - `<a download>` / blob / XLSX.writeFile are saved & shared natively.
 *  3. Hardware back  - Android back button navigates history, exits at the root.
 *  4. Status bar, keyboard, splash screen, safe-area handling.
 *  5. Deep links     - optional: opening a password-reset link inside the app.
 */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();

const API_BASE = ((import.meta as any).env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/* ------------------------------------------------------------------ */
/* 1. API base URL                                                     */
/* ------------------------------------------------------------------ */
function installApiBase() {
  if (!isNative) return;
  if (!API_BASE) {
    console.warn('[mobile] VITE_API_BASE_URL is not set - /api calls (email, forgot/reset password, apply-leave) will fail.');
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        input = API_BASE + input;
      } else if (input instanceof URL && input.pathname.startsWith('/api/') && input.origin === window.location.origin) {
        input = new URL(API_BASE + input.pathname + input.search);
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        const u = new URL(input.url);
        if (u.origin === window.location.origin && u.pathname.startsWith('/api/')) {
          input = new Request(API_BASE + u.pathname + u.search, input);
        }
      }
    } catch (e) {
      console.error('[mobile] fetch shim error', e);
    }
    return originalFetch(input as any, init);
  };
}

/* ------------------------------------------------------------------ */
/* 2. File downloads                                                   */
/* ------------------------------------------------------------------ */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.substring(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function sanitizeName(name: string) {
  return (name || 'download').replace(/[\\/:*?"<>|]+/g, '_');
}

async function saveAndShare(href: string, filename: string) {
  const res = await fetch(href);
  const blob = await res.blob();
  const data = await blobToBase64(blob);
  const path = sanitizeName(filename);
  const written = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
  try {
    await Share.share({ title: path, url: written.uri, dialogTitle: 'Save or share file' });
  } catch (e: any) {
    // user dismissed the share sheet - the file is still in the app cache; nothing to do
    if (!/cancel/i.test(String(e?.message || e))) console.warn('[mobile] share failed', e);
  }
}

function isDownloadAnchor(a: HTMLAnchorElement) {
  return a.hasAttribute('download') && !!a.href && /^(blob:|data:|https?:)/i.test(a.href);
}

function installDownloads() {
  if (!isNative) return;

  // Programmatic anchor clicks (XLSX.writeFile, CSV export in Reports.tsx, ...)
  const originalClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (isDownloadAnchor(this)) {
      const name = this.getAttribute('download') || this.download || 'download';
      saveAndShare(this.href, name).catch((e) => {
        console.error('[mobile] download failed', e);
        alert('Could not save the file. Please try again.');
      });
      return;
    }
    return originalClick.call(this);
  };

  // Real taps on <a href=... download> links (e.g. leave attachments)
  document.addEventListener(
    'click',
    (ev) => {
      const target = (ev.target as HTMLElement | null)?.closest?.('a') as HTMLAnchorElement | null;
      if (target && isDownloadAnchor(target)) {
        ev.preventDefault();
        ev.stopPropagation();
        const name = target.getAttribute('download') || 'attachment';
        saveAndShare(target.href, name).catch((e) => {
          console.error('[mobile] download failed', e);
          window.open(target.href, '_system');
        });
      }
    },
    true,
  );
}

/* ------------------------------------------------------------------ */
/* 3. Hardware back button + 5. deep links                             */
/* ------------------------------------------------------------------ */
function navigateInApp(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function installAppEvents() {
  if (!isNative) return;

  App.addListener('backButton', ({ canGoBack }) => {
    const atRoot = ['/', '/employee/dashboard', '/admin/dashboard'].includes(window.location.pathname);
    // Close any open radix dialog/dropdown first (they listen for Escape)
    const openLayer = document.querySelector('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]');
    if (openLayer) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      return;
    }
    if (!atRoot && (canGoBack || window.history.length > 1)) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  // Optional: https://<your-frontend>/reset-password?token=... opened by the OS
  App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url);
      if (u.pathname.startsWith('/reset-password')) {
        navigateInApp(u.pathname + u.search);
      }
    } catch {
      /* ignore malformed urls */
    }
  });
}

/* ------------------------------------------------------------------ */
/* 4. Chrome: status bar, splash, keyboard, safe areas                 */
/* ------------------------------------------------------------------ */
async function installChrome() {
  document.documentElement.classList.add(isNative ? 'is-native' : 'is-web');
  if (!isNative) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#0B1220' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  } catch (e) {
    console.warn('[mobile] status bar setup failed', e);
  }
  // hide splash once React has had a moment to paint
  setTimeout(() => SplashScreen.hide().catch(() => {}), 400);
}

export function initNativeBridge() {
  installApiBase();
  installDownloads();
  installAppEvents();
  void installChrome();
}
