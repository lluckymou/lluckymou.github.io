const LOCALE_FILES = Object.freeze({
  "pt-BR": new URL("./i18n/pt-BR.json", import.meta.url),
  "en-US": new URL("./i18n/en-US.json", import.meta.url)
});

export const DEFAULT_LOCALE = "en-US";
export const translations = Object.create(null);

let currentLocale = "pt-BR";
let loadPromise = null;

function resolvePath(catalog, key) {
  if (!catalog || typeof catalog !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(catalog, key)) return catalog[key];
  return String(key).split(".").reduce((value, segment) => value && typeof value === "object" ? value[segment] : undefined, catalog);
}

function interpolate(value, variables) {
  if (!variables) return value;
  return value.replace(/\{\{?\s*([A-Za-z0-9_.-]+)\s*\}?\}/g, (match, key) => Object.prototype.hasOwnProperty.call(variables, key) ? String(variables[key]) : match);
}

export async function loadTranslations() {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all(Object.entries(LOCALE_FILES).map(async ([locale, url]) => {
    const response = await fetch(url, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Unable to load locale ${locale}: HTTP ${response.status}`);
    const catalog = await response.json();
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) throw new Error(`Locale ${locale} is not an object catalog`);
    translations[locale] = catalog;
  })).catch((error) => {
    loadPromise = null;
    throw error;
  });
  return loadPromise;
}

export function setLocale(locale) {
  if (!Object.prototype.hasOwnProperty.call(LOCALE_FILES, locale) || !translations[locale]) return false;
  currentLocale = locale;
  return true;
}

export function getCurrentLocale() {
  return currentLocale;
}

export function getAvailableLocales() {
  return Object.keys(LOCALE_FILES).filter((locale) => translations[locale]);
}

export function get(key, locale = currentLocale, variables = null) {
  const active = resolvePath(translations[locale], key);
  const fallback = active === undefined ? resolvePath(translations[DEFAULT_LOCALE], key) : active;
  if (fallback === undefined || fallback === null || typeof fallback === "object") return String(key);
  return interpolate(String(fallback), variables);
}
