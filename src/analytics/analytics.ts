/**
 * Anonymous product analytics (v0.9.6.4).
 *
 * ## What this is for
 *
 * One question drives it: how many careers have actually been started? The authoritative answer is
 * the GA4 event count for `career_started`, which means that event has to fire exactly once per
 * genuinely new career and never on a load, a refresh, a resume or a re-render. Everything else
 * here exists to make that number trustworthy and to say a little about how far players get.
 *
 * ## The boundary
 *
 * This module is the ONLY place that talks to gtag. Nothing else in the app may call
 * `window.gtag` - callers use the typed functions in `./events`, which build explicit payloads.
 * That is a privacy boundary as much as a tidiness one: a whitelisted payload per event is what
 * makes "we never send a player's name" a property of the code rather than a promise.
 *
 * ## Failure is always silent
 *
 * Analytics is fire-and-forget. Google blocked, gtag absent, offline, consent denied, localStorage
 * throwing, this module throwing - all of it must leave gameplay untouched. Every public function
 * is wrapped so a throw cannot escape into a game action, and nothing here is awaited.
 *
 * It also never touches the simulation: no `Career` is mutated, and randomness for ids comes from
 * `crypto`, never from the game RNG. A test asserts the seeded regression is byte-identical.
 */

import { GAME_VERSION } from './version';

export const MEASUREMENT_ID = 'G-4KJEM0LPCF';

/** Every event this game may send. A closed set on purpose - see the note about noise in ANALYTICS.md. */
export type AnalyticsEventName =
  | 'career_started'
  | 'career_resumed'
  | 'season_completed'
  | 'senior_debut'
  | 'transfer_completed'
  | 'europe_reached'
  | 'career_completed';

/** Only enums, ids, numbers and booleans ever leave the app. Never free text, never an object. */
export type AnalyticsValue = string | number | boolean;
export type AnalyticsParams = Readonly<Record<string, AnalyticsValue>>;

export type ConsentChoice = 'granted' | 'denied' | 'unset';

/* ------------------------------------------------------------------ */
/* Storage keys                                                        */
/* ------------------------------------------------------------------ */

/**
 * Deliberately outside the game's own `Envelope` storage in `services/storage`.
 *
 * Analytics bookkeeping is not part of the save. Keeping it in its own keys means a corrupted or
 * cleared analytics registry can never invalidate a career, and a save format change never has to
 * think about analytics.
 */
const CONSENT_KEY = 'maccabist.analytics.consent';
const SENT_KEY = 'maccabist.analytics.sent';
const SESSION_KEY = 'maccabist.analytics.session';

/**
 * How many dedupe keys to keep. A long career emits one `season_completed` per season, so this is
 * decades of play; the oldest are dropped first and the events they guard are long past.
 */
const SENT_LIMIT = 400;

/* ------------------------------------------------------------------ */
/* Runtime - replaceable, so tests never need a browser                */
/* ------------------------------------------------------------------ */

export interface AnalyticsRuntime {
  /** Whether this environment may emit at all. Evaluated once at startup. */
  enabled: boolean;
  /** Where events actually go. Replaced in tests; in the browser this loads and calls gtag. */
  send(name: AnalyticsEventName, params: AnalyticsParams): void;
  /** Durable across refreshes: the dedupe registry and the consent choice. */
  readLocal(key: string): string | null;
  writeLocal(key: string, value: string): void;
  /** Per browser-tab: used only to keep `career_resumed` to once per session. */
  readSession(key: string): string | null;
  writeSession(key: string, value: string): void;
  /** Non-game randomness. Never the simulation RNG. */
  randomId(): string;
}

function noopRuntime(): AnalyticsRuntime {
  return {
    enabled: false,
    send: () => {},
    readLocal: () => null,
    writeLocal: () => {},
    readSession: () => null,
    writeSession: () => {},
    randomId: () => 'noop',
  };
}

let runtime: AnalyticsRuntime = noopRuntime();
let initialised = false;

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

/** The query flags the dev gallery and the four browser audits use. See scripts/*Audit.mjs. */
const QA_FLAGS = ['gallery', 'probe', 'contrast', 'touch', 'crop'] as const;

/**
 * May this environment emit real analytics?
 *
 * No, unless it is a real deployed build being played by a person. The browser audits drive the
 * game through headless Chrome dozens of times per run; if any of that reached GA the
 * `career_started` count would be fiction.
 *
 * `?analyticsDebug=1` forces it on for manual verification against GA4 DebugView.
 */
export function environmentAllowsAnalytics(location?: {
  hostname?: string;
  search?: string;
}): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const hostname = location?.hostname ?? window.location.hostname;
    const search = location?.search ?? window.location.search;
    const params = new URLSearchParams(search);

    if (params.get('analyticsDebug') === '1') return true;

    /* A Vitest run has a window only if someone gives it one; this is belt and braces. */
    if (typeof process !== 'undefined' && process.env?.VITEST) return false;
    if (import.meta.env?.DEV) return false;
    if (import.meta.env?.MODE === 'test') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
    if (hostname === '' || hostname === 'null') return false;
    for (const flag of QA_FLAGS) {
      if (params.get(flag) === '1') return false;
    }
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* gtag                                                                */
/* ------------------------------------------------------------------ */

type GtagFn = (...args: unknown[]) => void;

interface GtagWindow {
  dataLayer?: unknown[];
  gtag?: GtagFn;
}

/**
 * Loads the Google tag, once, and only after consent.
 *
 * Deliberately NOT a <script> in index.html. A static tag would load on every visit including the
 * gallery and every headless audit, and would run before the player had agreed to anything. Doing
 * it here means the network request itself is gated on consent.
 *
 * Ad-personalisation signals are switched off: this is product measurement, not marketing.
 */
function loadGtag(): GtagFn | null {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    const holder = window as unknown as GtagWindow;
    if (holder.gtag) return holder.gtag;

    holder.dataLayer = holder.dataLayer ?? [];
    const gtag: GtagFn = (...args: unknown[]) => {
      holder.dataLayer!.push(args);
    };
    holder.gtag = gtag;

    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    /* An ad blocker makes this fail. dataLayer keeps absorbing pushes; nothing else notices. */
    tag.addEventListener('error', () => {});
    document.head.appendChild(tag);

    gtag('js', new Date());
    gtag('config', MEASUREMENT_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    return gtag;
  } catch {
    return null;
  }
}

function browserRuntime(): AnalyticsRuntime {
  return {
    enabled: environmentAllowsAnalytics(),
    send: (name, params) => {
      const gtag = loadGtag();
      if (!gtag) return;
      gtag('event', name, params);
    },
    readLocal: (key) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    writeLocal: (key, value) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* Private mode or quota. The game does not care and neither does this. */
      }
    },
    readSession: (key) => {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    writeSession: (key, value) => {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        /* As above. */
      }
    },
    randomId: () => {
      try {
        return crypto.randomUUID();
      } catch {
        return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      }
    },
  };
}

/** Called once from the app entry point. Idempotent. */
export function initAnalytics(): void {
  if (initialised) return;
  initialised = true;
  try {
    runtime = browserRuntime();
  } catch {
    runtime = noopRuntime();
  }
}

/* ------------------------------------------------------------------ */
/* Consent                                                             */
/* ------------------------------------------------------------------ */

/**
 * Nothing is sent until the player answers.
 *
 * `unset` is a real third state, not a synonym for denied: it is what makes the first-run prompt
 * appear exactly once. Once answered - either way - the prompt never returns.
 */
export function getConsent(): ConsentChoice {
  try {
    const raw = runtime.readLocal(CONSENT_KEY);
    return raw === 'granted' || raw === 'denied' ? raw : 'unset';
  } catch {
    return 'unset';
  }
}

export function setConsent(choice: Exclude<ConsentChoice, 'unset'>): void {
  try {
    runtime.writeLocal(CONSENT_KEY, choice);
  } catch {
    /* A player who cannot persist the choice is simply asked again next time. */
  }
}

/** True when the player has been asked and has not yet answered. */
export function needsConsentDecision(): boolean {
  try {
    return runtime.enabled && getConsent() === 'unset';
  } catch {
    return false;
  }
}

export function analyticsActive(): boolean {
  try {
    return runtime.enabled && getConsent() === 'granted';
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Deduplication                                                       */
/* ------------------------------------------------------------------ */

function readSent(): string[] {
  try {
    const raw = runtime.readLocal(SENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((k) => typeof k === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

function rememberSent(key: string): void {
  try {
    const keys = readSent();
    keys.push(key);
    const trimmed = keys.length > SENT_LIMIT ? keys.slice(keys.length - SENT_LIMIT) : keys;
    runtime.writeLocal(SENT_KEY, JSON.stringify(trimmed));
  } catch {
    /* Losing the registry can at worst re-send one event; it can never break a career. */
  }
}

/**
 * Has this exact thing already been reported?
 *
 * The registry is persistent because the duplicates that matter survive a reload: React
 * re-renders, StrictMode double-invocation, a player refreshing on the season summary. "This code
 * probably runs once" is not a guarantee, so the guard is semantic and stored.
 */
export function alreadySent(key: string): boolean {
  try {
    return readSent().includes(key);
  } catch {
    return false;
  }
}

/** The current browser tab's id, used only to keep `career_resumed` to once per session. */
export function sessionId(): string {
  try {
    const existing = runtime.readSession(SESSION_KEY);
    if (existing) return existing;
    const fresh = runtime.randomId();
    runtime.writeSession(SESSION_KEY, fresh);
    return fresh;
  } catch {
    return 'session';
  }
}

/* ------------------------------------------------------------------ */
/* Emission                                                            */
/* ------------------------------------------------------------------ */

/**
 * The single exit point.
 *
 * `dedupeKey` is required rather than optional - every event in this game has a natural
 * once-ness, and making the caller name it is what stops a future event being added without one.
 * `game_version` is attached here so no caller can forget it.
 */
export function emit(
  name: AnalyticsEventName,
  dedupeKey: string,
  params: AnalyticsParams,
): boolean {
  try {
    if (!analyticsActive()) return false;
    if (alreadySent(dedupeKey)) return false;
    rememberSent(dedupeKey);
    runtime.send(name, { ...params, game_version: GAME_VERSION });
    return true;
  } catch {
    /* Analytics must never be able to interrupt a game action. */
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Test seam                                                           */
/* ------------------------------------------------------------------ */

/**
 * Replaces the runtime so tests can drive real behaviour - consent, dedupe, payload shape,
 * failure handling - without a DOM and without ever reaching Google.
 *
 * Exported rather than hidden behind a mock so the tests exercise the same code the browser runs.
 */
export function __setAnalyticsRuntimeForTests(overrides: Partial<AnalyticsRuntime>): void {
  runtime = { ...noopRuntime(), ...overrides };
  initialised = true;
}

export function __resetAnalyticsForTests(): void {
  runtime = noopRuntime();
  initialised = false;
}
