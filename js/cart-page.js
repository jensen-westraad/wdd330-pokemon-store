import { getCart, setQuantity, removeFromCart, getCartCount } from "./cart.js";

// Friendly names for the print types stored in the cart.
const PRINT_LABELS = {
    normal: "Normal",
    holofoil: "Holofoil",
    reverseHolofoil: "Reverse holofoil",
};

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

// Money is added up in whole cents so decimals like 0.1 + 0.2
// never give results like 0.30000000000000004.
function formatCents(cents) {
    return `$${(cents / 100).toFixed(2)} USD`;
}

function lineCents(line) {
    return Math.round(line.price * 100) * line.quantity;
}

function lineKey(line) {
    return `${line.id}|${line.printType}`;
}

// Show the number of cards in the header.
function updateHeaderCount() {
    document.querySelector("#cart-count").textContent = getCartCount();
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
      <p>${formatCents(Math.round(line.price * 100))} each</p>
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
    <p class="cart-note">Totals use each card's TCGplayer market price from when it
      was added to the cart, so they are estimates and may differ from current prices.
      This is a demo store, so checkout is not available.</p>
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

render();