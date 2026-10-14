const CURRENCY_KEY = "pokemon-tcg-store-currency";
const RATES_KEY = "pokemon-tcg-store-rates";
const RATES_URL =
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=ZAR,EUR";
const CACHE_MS = 12 * 60 * 60 * 1000; // 12 hours

export const CURRENCIES = ["USD", "ZAR", "EUR"];

// Locale controls number layout (symbol, separators) for each currency.
const LOCALES = { USD: "en-US", ZAR: "en-ZA", EUR: "en-IE" };

/** True if the object has a positive number for every supported currency. */
function hasValidRates(rates) {
    return CURRENCIES.every(
        (code) => typeof rates?.[code] === "number" && rates[code] > 0
    );
}

/** Read the selected currency from localStorage (defaults to USD). */
export function getSelectedCurrency() {
    try {
        const saved = localStorage.getItem(CURRENCY_KEY);
        return CURRENCIES.includes(saved) ? saved : "USD";
    } catch {
        return "USD";
    }
}

/** Save the selected currency if it is one we support. */
export function setSelectedCurrency(code) {
    if (!CURRENCIES.includes(code)) return;
    try {
        localStorage.setItem(CURRENCY_KEY, code);
    } catch {
        // Storage can be blocked or full; the app still works without it.
    }
}

/** Read cached rates; returns null if missing or invalid. */
function readCachedRates() {
    try {
        const cached = JSON.parse(localStorage.getItem(RATES_KEY));
        if (cached && hasValidRates(cached.rates) && Number.isFinite(cached.fetchedAt)) {
            return cached;
        }
    } catch {
        // Bad JSON or blocked storage: treat as no cache.
    }
    return null;
}

export async function loadRates() {
    const cached = readCachedRates();
    if (cached && Date.now() - cached.fetchedAt < CACHE_MS) {
        return { ...cached, source: "cache" };
    }

    try {
        const response = await fetch(RATES_URL, {
            signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error(`Rate request failed: ${response.status}`);
        const data = await response.json();

        const rates = { USD: 1, ZAR: data.rates?.ZAR, EUR: data.rates?.EUR };
        if (!hasValidRates(rates)) throw new Error("Unexpected rate data");

        const fresh = { rates, date: data.date, fetchedAt: Date.now() };
        try {
            localStorage.setItem(RATES_KEY, JSON.stringify(fresh));
        } catch {
            // Not being able to cache is fine.
        }
        return { ...fresh, source: "network" };
    } catch {
        return cached ? { ...cached, source: "stale" } : null;
    }
}

/** Convert whole USD cents to whole cents of another currency. */
export function convertCents(usdCents, currency, rates) {
    if (currency === "USD" || !hasValidRates(rates)) return usdCents;
    return Math.round(usdCents * rates[currency]);
}

/** Format cents that are ALREADY in the given currency. */
export function formatAmount(cents, currency) {
    return new Intl.NumberFormat(LOCALES[currency], {
        style: "currency",
        currency,
    }).format(cents / 100);
}

/**
 * Format USD cents for display in the chosen currency.
 * If rates are missing, it falls back to showing USD.
 */
export function formatPrice(usdCents, currency, rates) {
    const usable = currency !== "USD" && hasValidRates(rates) ? currency : "USD";
    return formatAmount(convertCents(usdCents, usable, rates), usable);
}