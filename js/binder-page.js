// js/binder-page.js
// Binder page: a shelf of colour-coded binders, and the open binder
// with a progress bar, an estimated value, and one slot for every card
// in the set. Owned cards open the same details modal as the store.

import { getBinders } from "./binder.js";
import { getCartCount } from "./cart.js";
import { getSelectedCurrency, loadRates, formatPrice } from "./currency.js";

// CardDex API (pokemontcg.io-compatible), same one the store uses.
const API_BASE = "https://api.carddex.dev/compat/pokemontcg/v2";

// Friendly names for the print types the API uses as price keys.
const PRINT_LABELS = {
    normal: "Normal",
    holofoil: "Holofoil",
    reverseHolofoil: "Reverse holofoil",
};

const shelf = document.querySelector("#binder-shelf");
const view = document.querySelector("#binder-view");
const dialog = document.querySelector("#card-dialog");
const dialogContent = document.querySelector("#dialog-content");
let selectedSetId = null;

// Prices are shown in the currency chosen on the store or cart page.
// ratesReady settles once the exchange rates have been loaded (or failed).
const currency = getSelectedCurrency();
let rateInfo = null;
const ratesReady = loadRates().then((info) => {
    rateInfo = info;
});

// Cards of each set, fetched once and kept as a Map of card id -> card.
// A failed fetch gives null and is forgotten, so a later click can retry.
const setCache = new Map();

// Make text safe to place inside HTML.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[char]));
}

// Only accept a plain #rrggbb colour from storage.
function safeColor(color) {
    return /^#[0-9a-f]{6}$/i.test(color) ? color : "#1d2d5c";
}

// Percent complete (0-100). A set with an unknown total counts as 0.
function getPercent(owned, total) {
    return total > 0 ? Math.min(100, Math.round((owned / total) * 100)) : 0;
}

// Format a USD price (in dollars) for display in the chosen currency.
function money(usd) {
    return formatPrice(Math.round(usd * 100), currency, rateInfo?.rates);
}

// Fetch a URL and return its JSON. Gives up after 10 seconds.
async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        throw new Error(`The API responded with status ${response.status}`);
    }
    return response.json();
}

// Get every card of a set (up to 250) as a Map, or null if it failed.
function getSetCards(setId) {
    if (!setCache.has(setId)) {
        const request = fetchJson(
            `${API_BASE}/cards?q=set.id:${encodeURIComponent(setId)}&pageSize=250`
        )
            .then((result) => new Map(result.data.map((card) => [card.id, card])))
            .catch(() => {
                setCache.delete(setId);
                return null;
            });
        setCache.set(setId, request);
    }
    return setCache.get(setId);
}

// Pick one price for a card: the first print type listed, like the store
// tiles do. Returns a number, or null if the card has no price.
function getMarketPrice(card) {
    const prices = card.tcgplayer?.prices;
    if (!prices) return null;
    const firstType = Object.values(prices)[0];
    return firstType?.market ?? null;
}

// List every print type of a card that has a market price.
function getPrintOptions(card) {
    const prices = card.tcgplayer?.prices;
    if (!prices) return [];
    return Object.entries(prices)
        .filter(([, printPrice]) => typeof printPrice.market === "number")
        .map(([type, printPrice]) => ({ type, market: printPrice.market }));
}

// Draw one binder icon per set, coloured with the binder's own colour.
function renderShelf(binders) {
    shelf.innerHTML = "";
    Object.entries(binders).forEach(([setId, binder]) => {
        const owned = Object.keys(binder.cards).length;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "binder-icon";
        button.dataset.set = setId;
        button.style.setProperty("--binder-color", safeColor(binder.color));
        button.setAttribute("aria-pressed", String(setId === selectedSetId));
        button.innerHTML = `
      <span class="binder-label">
        <span class="binder-name">${escapeHtml(binder.setName)}</span>
        <span class="binder-count">${owned} / ${binder.total || "?"}</span>
      </span>
    `;
        shelf.appendChild(button);
    });
}

// Work out the estimated value of the open binder and show it. The slots
// are not redrawn, so keyboard focus is never lost.
async function updateValue(setId) {
    const [cards] = await Promise.all([getSetCards(setId), ratesReady]);
    if (setId !== selectedSetId) return; // the visitor opened another binder

    const output = document.querySelector("#binder-value");
    const binder = getBinders()[setId];
    if (!output || !binder) return;

    if (!cards) {
        output.textContent = "Estimated value is unavailable right now.";
        return;
    }

    const ownedIds = Object.keys(binder.cards);
    let totalCents = 0;
    let priced = 0;
    ownedIds.forEach((id) => {
        const card = cards.get(id);
        const price = card ? getMarketPrice(card) : null;
        if (price !== null) {
            totalCents += Math.round(price * 100);
            priced += 1;
        }
    });

    const missing = ownedIds.length - priced;
    const note = missing > 0
        ? ` (${missing} card${missing === 1 ? "" : "s"} without a price not counted)`
        : "";
    output.textContent = `Estimated value: ${formatPrice(totalCents, currency, rateInfo?.rates)}${note}`;
}

// Open one binder: title, progress bar, value, and the card slots.
function renderBinder(binders, moveFocus) {
    const binder = binders[selectedSetId];
    if (!binder) {
        view.innerHTML = "";
        return;
    }

    const cards = Object.values(binder.cards).sort((a, b) =>
        String(a.number).localeCompare(String(b.number), undefined, { numeric: true })
    );
    const owned = cards.length;
    const percent = getPercent(owned, binder.total);
    const emptySlots = Math.max(0, binder.total - owned);

    const ownedSlots = cards
        .map(
            (card) => `
      <button type="button" class="slot owned" data-card="${escapeHtml(card.id)}"
              aria-label="View details for ${escapeHtml(card.name)}, card ${escapeHtml(card.number)}">
        <img src="${escapeHtml(card.image)}" alt="" loading="lazy">
      </button>`
        )
        .join("");
    const missingSlots = '<div class="slot" aria-hidden="true"></div>'.repeat(emptySlots);

    view.style.setProperty("--binder-color", safeColor(binder.color));
    view.innerHTML = `
    <h2 id="binder-title" tabindex="-1">${escapeHtml(binder.setName)}</h2>
    <p>${owned} of ${binder.total || "an unknown number of"} cards collected${binder.total ? ` (${percent}%)` : ""}.</p>
    <p id="binder-value" role="status">Estimated value: calculating...</p>
    <div class="progress" role="progressbar" aria-label="Set completion"
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
      <div class="progress-fill" style="width: ${percent}%"></div>
    </div>
    <div class="binder-slots">${ownedSlots}${missingSlots}</div>
  `;

    if (moveFocus) document.querySelector("#binder-title").focus();
    updateValue(selectedSetId);
}

// Modal content with every detail the API gave us for the card.
function buildFullDetails(card) {
    const details = [
        ["Set", card.set.name],
        ["Rarity", card.rarity],
        ["Type", card.types?.join(", ")],
        ["HP", card.hp],
        ["Artist", card.artist],
    ]
        .filter(([, value]) => value)
        .map(([label, value]) => `<dt>${label}</dt><dd>${escapeHtml(value)}</dd>`)
        .join("");

    const options = getPrintOptions(card);
    const priceRows = options.length === 0
        ? "<li>Price unavailable</li>"
        : options
            .map(({ type, market }) => `<li>${escapeHtml(PRINT_LABELS[type] ?? type)}: ${money(market)}</li>`)
            .join("");

    return `
    <img src="${escapeHtml(card.images.large)}" alt="${escapeHtml(card.name)} card, large view">
    <div>
      <h2 id="dialog-title">${escapeHtml(card.name)}</h2>
      <dl>${details}</dl>
      <h3>TCGplayer market price</h3>
      <ul>${priceRows}</ul>
    </div>
  `;
}

// Fallback modal content from what the binder saved, used if the API
// could not be reached or the card was not in the fetched list.
function buildSavedDetails(saved, setName) {
    return `
    <img src="${escapeHtml(saved.image)}" alt="${escapeHtml(saved.name)} card">
    <div>
      <h2 id="dialog-title">${escapeHtml(saved.name)}</h2>
      <dl>
        <dt>Set</dt><dd>${escapeHtml(setName)}</dd>
        <dt>Card number</dt><dd>${escapeHtml(saved.number)}</dd>
      </dl>
      <p>Full details could not be loaded for this card right now.</p>
    </div>
  `;
}

// Open the details modal for one owned card.
async function openCardDialog(setId, cardId) {
    const binder = getBinders()[setId];
    const saved = binder?.cards[cardId];
    if (!saved) return;

    const [cards] = await Promise.all([getSetCards(setId), ratesReady]);
    const card = cards?.get(cardId);
    dialogContent.innerHTML = card
        ? buildFullDetails(card)
        : buildSavedDetails(saved, binder.setName);

    if (!dialog.open) dialog.showModal();
}

// Draw the whole page from what is saved.
function render(moveFocus) {
    const binders = getBinders();
    const ids = Object.keys(binders);

    document.querySelector("#cart-count").textContent = getCartCount();

    if (ids.length === 0) {
        shelf.innerHTML = `
      <p class="cart-empty">You have no binders yet.
        <a href="/index.html">Find some cards</a> and use "Add to binder".</p>
    `;
        view.innerHTML = "";
        return;
    }

    if (!binders[selectedSetId]) selectedSetId = ids[0];
    renderShelf(binders);
    renderBinder(binders, moveFocus);
}

// Clicking a binder icon opens that binder.
shelf.addEventListener("click", (event) => {
    const icon = event.target.closest(".binder-icon");
    if (!icon) return;
    selectedSetId = icon.dataset.set;
    render(true);
});

// Clicking an owned card opens its details.
view.addEventListener("click", (event) => {
    const slot = event.target.closest(".slot.owned");
    if (!slot) return;
    openCardDialog(selectedSetId, slot.dataset.card);
});

// Details modal: close button, and clicking the dimmed area outside it.
document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
});

render(false);