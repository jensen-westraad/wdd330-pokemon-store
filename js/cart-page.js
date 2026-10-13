import { getCart, setQuantity, removeFromCart, getCartCount } from "./cart.js";
import {
    getSelectedCurrency,
    setSelectedCurrency,
    loadRates,
    convertCents,
    formatAmount,
} from "./currency.js";

// Friendly names for the print types stored in the cart.
const PRINT_LABELS = {
    normal: "Normal",
    holofoil: "Holofoil",
    reverseHolofoil: "Reverse holofoil",
};

// Currency display state. The cart always stores USD; amounts are only
// converted when shown. rateInfo is { rates, date, source } or null.
let currency = getSelectedCurrency();
let rateInfo = null;
let ratesChecked = false;

// The currency actually used for display. If rates are not available
// (yet), we show USD instead of guessing.
function displayCurrency() {
    return currency !== "USD" && rateInfo ? currency : "USD";
}

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

// Price of one card in the display currency, in whole cents.
// Converting each card first, then multiplying, keeps every line total
// and the grand total consistent with the prices shown on screen.
function eachCents(line) {
    return convertCents(Math.round(line.price * 100), displayCurrency(), rateInfo?.rates);
}

// Total for one cart line in the display currency, in whole cents.
function lineCents(line) {
    return eachCents(line) * line.quantity;
}

// Show whole cents (already in the display currency) as text.
function formatCents(cents) {
    return formatAmount(cents, displayCurrency());
}

function lineKey(line) {
    return `${line.id}|${line.printType}`;
}

// Show the number of cards in the header.
function updateHeaderCount() {
    document.querySelector("#cart-count").textContent = getCartCount();
}

// Explain to the visitor how the displayed prices were converted.
function updateCurrencyNote() {
    const note = document.querySelector("#currency-note");
    if (currency === "USD" || !ratesChecked) {
        note.textContent = "";
    } else if (!rateInfo) {
        note.textContent = "Exchange rates are unavailable, so prices are shown in USD.";
    } else {
        const old = rateInfo.source === "stale" ? " (saved rates, could not refresh)" : "";
        note.textContent = `Converted from USD using European Central Bank rates dated ${rateInfo.date}${old}.`;
    }
}

// Build the HTML element for one cart line, and wire up its buttons.
function createLineElement(line) {
    const printLabel = PRINT_LABELS[line.printType] ?? line.printType;
    const name = escapeHtml(line.name);

    const element = document.createElement("article");
    element.className = "cart-line";
    element.dataset.key = lineKey(line);
    element.innerHTML = `
    <img src="${escapeHtml(line.image)}" alt="${name} card" width="80">
    <div class="cart-info">
      <h2>${name}</h2>
      <p>${escapeHtml(line.setName)} · ${escapeHtml(printLabel)}</p>
      <p>${formatCents(eachCents(line))} each</p>
    </div>
    <div class="cart-qty" role="group" aria-label="Quantity for ${name}, ${escapeHtml(printLabel)}">
      <button type="button" class="qty-minus" aria-label="Decrease quantity"${line.quantity <= 1 ? " disabled" : ""}>−</button>
      <span class="qty-value" aria-live="polite">${line.quantity}</span>
      <button type="button" class="qty-plus" aria-label="Increase quantity"${line.quantity >= 99 ? " disabled" : ""}>+</button>
    </div>
    <p class="line-total">${formatCents(lineCents(line))}</p>
    <button type="button" class="details-button remove-button">Remove</button>
  `;

    element.querySelector(".qty-minus").addEventListener("click", () => {
        setQuantity(line.id, line.printType, line.quantity - 1);
        render(lineKey(line), ".qty-minus");
    });
    element.querySelector(".qty-plus").addEventListener("click", () => {
        setQuantity(line.id, line.printType, line.quantity + 1);
        render(lineKey(line), ".qty-plus");
    });
    element.querySelector(".remove-button").addEventListener("click", () => {
        removeFromCart(line.id, line.printType);
        render();
        document.querySelector("#cart-heading").focus();
    });

    return element;
}

// Draw the whole cart. If a line key and button selector are given,
// keyboard focus goes back to that button afterwards.
function render(focusKey, focusSelector) {
    const cart = getCart();
    const items = document.querySelector("#cart-items");
    const summary = document.querySelector("#cart-summary");
    items.innerHTML = "";
    summary.innerHTML = "";
    updateHeaderCount();

    if (cart.length === 0) {
        items.innerHTML = `
      <p class="cart-empty">Your cart is empty.
        <a href="/index.html">Find some cards</a> to add.</p>
    `;
        return;
    }

    cart.forEach((line) => items.appendChild(createLineElement(line)));

    const totalCents = cart.reduce((sum, line) => sum + lineCents(line), 0);
    summary.innerHTML = `
    <h2>Summary</h2>
    <p>Cards: <strong>${getCartCount()}</strong></p>
    <p class="cart-total">Total: <strong>${formatCents(totalCents)}</strong></p>
    <p class="cart-note">Totals use each card's TCGplayer market price (in US dollars) from when it
      was added to the cart, converted to the currency you chose, so they are estimates and
      may differ from current prices. This is a demo store, so checkout is not available.</p>
  `;

    if (focusKey) {
        const lineElement = [...document.querySelectorAll(".cart-line")].find(
            (element) => element.dataset.key === focusKey
        );
        const target = lineElement?.querySelector(focusSelector);
        if (target && !target.disabled) {
            target.focus();
        } else {
            lineElement?.querySelector(".qty-plus")?.focus();
        }
    }
}

// Load exchange rates (from cache or the Frankfurter API), then redraw
// the cart so amounts show in the chosen currency.
async function loadExchangeRates() {
    rateInfo = await loadRates();
    ratesChecked = true;
    updateCurrencyNote();
    render();
}

// Currency dropdown: remember the choice and redraw.
document.querySelector("#currency").addEventListener("change", (event) => {
    currency = event.target.value;
    setSelectedCurrency(currency);
    updateCurrencyNote();
    render();
});

document.querySelector("#currency").value = currency;
render();
loadExchangeRates();