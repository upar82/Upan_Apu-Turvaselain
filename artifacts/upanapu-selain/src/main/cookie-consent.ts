import type { WebContents } from 'electron'
import type { Settings } from './settings-store'

const PAYMENT_KEYWORDS = [
  'checkout', 'payment', 'maksa', 'tilaus', 'luottokortti',
  'ostoskori', 'cart', 'shop', 'store', 'osta', 'paypal',
  'stripe', 'klarna', 'maksut', 'verkkokauppa', 'buy', 'purchase',
  'tilaa', 'billing', 'invoice'
]

function isSuspicious(url: string, settings: Settings): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:') return true
    if (settings.blockPayments) {
      const lower = url.toLowerCase()
      if (PAYMENT_KEYWORDS.some(kw => lower.includes(kw))) return true
    }
    return false
  } catch {
    return true
  }
}

const CONSENT_SCRIPT = /* js */ `
(function () {
  'use strict';

  /* ---- Framework-specific CMP APIs ---- */
  function tryFrameworks() {
    try {
      // Cookiebot
      if (window.Cookiebot && typeof window.Cookiebot.deny === 'function') {
        window.Cookiebot.deny(); return true;
      }
      if (window.CookieConsent && typeof window.CookieConsent.setOutcome === 'function') {
        window.CookieConsent.setOutcome(false, false); return true;
      }
      // OneTrust
      if (typeof window.OneTrust !== 'undefined' && typeof window.OneTrust.RejectAll === 'function') {
        window.OneTrust.RejectAll(); return true;
      }
      // TrustArc
      var ta = document.getElementById('truste-consent-required');
      if (ta) { ta.click(); return true; }
      // Quantcast / Didomi
      if (window.__tcfapi) {
        window.__tcfapi('setConsent', 2, function(){}, { purpose: { consents: {} }, vendor: { consents: {} } });
      }
    } catch (_) {}
    return false;
  }

  /* ---- CSS selectors for common "reject / necessary only" buttons ---- */
  var SELECTORS = [
    /* CookieYes */       '.cky-btn-reject',
    /* Axeptio */         '#axeptio_btn_dismissAll',
    /* iubenda */         '.iubenda-cs-reject-btn',
    /* Borlabs */         '#CybotCookiebotDialogBodyButtonDecline',
    /* Usercentrics */    '[data-testid="uc-deny-all-button"]',
    /* Osano */           '.osano-cm-denyAll',
    /* Klaro */           '.cm-btn-decline',
    /* CookieScript */    '#cookiescript_reject',
    /* Consentmanager */  '#cmpbntyestxt',
    /* Didomi */          '#didomi-notice-disagree-button',
    /* WP Cookie Notice */'#cn-refuse-cookie',
    /* Complianz */       '.cmplz-btn.cmplz-deny',
    /* GDPR Cookie */     '#gdpr-cookie-decline',
  ];

  /* ---- Text patterns (Finnish, English, Swedish, Norwegian) ---- */
  var REJECT_RE = [
    /vain v.ltt.m.tt.m.t/i,
    /hyv.ksy vain v.ltt.m.tt.m.t/i,
    /vain tarpeelliset/i,
    /kieltäydy/i,
    /hylkää kaikki/i,
    /en hyväksy/i,
    /vain välttämättömät evästeet/i,
    /reject all/i,
    /decline all/i,
    /refuse all/i,
    /necessary only/i,
    /essential only/i,
    /accept necessary/i,
    /accept only necessary/i,
    /accept required/i,
    /only essential/i,
    /avvisa alla/i,
    /nødvendige/i,
    /kun nødvendige/i,
    /nödvändiga/i,
  ];

  function clickFirst(selector) {
    var el = document.querySelector(selector);
    if (el && el.offsetParent !== null) { el.click(); return true; }
    return false;
  }

  function trySelectors() {
    for (var i = 0; i < SELECTORS.length; i++) {
      if (clickFirst(SELECTORS[i])) return true;
    }
    return false;
  }

  function tryTextButtons() {
    var candidates = document.querySelectorAll(
      'button, [role="button"], a.button, input[type="button"], input[type="submit"]'
    );
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (el.offsetParent === null) continue; // invisible
      var text = (el.textContent || el.value || '').trim();
      for (var j = 0; j < REJECT_RE.length; j++) {
        if (REJECT_RE[j].test(text)) { el.click(); return true; }
      }
    }
    return false;
  }

  function tryAutoConsent() {
    if (tryFrameworks()) return;
    if (trySelectors()) return;
    tryTextButtons();
  }

  /* Run immediately and after short delay for lazy banners */
  tryAutoConsent();
  setTimeout(tryAutoConsent, 800);
  setTimeout(tryAutoConsent, 2500);

  /* MutationObserver for SPAs and lazy-loaded banners */
  var debounce = null;
  var obs = new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(tryAutoConsent, 400);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(function () { obs.disconnect(); }, 20000);
})();
`

export function injectCookieConsent(wc: WebContents, url: string, settings: Settings): void {
  if (!url || url.startsWith('about:') || url.startsWith('chrome:')) return
  if (isSuspicious(url, settings)) return
  wc.executeJavaScript(CONSENT_SCRIPT).catch(() => {})
}
