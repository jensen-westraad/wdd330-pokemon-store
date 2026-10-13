// Cart storage. The cart is saved in localStorage so it survives
// page refreshes, with no backend needed.
//
// Each cart line looks like:
// { id, printType, name, setName, image, price, quantity }
// A line is identified by card id + print type, so a Holofoil and a
// Reverse holofoil of the same card are separate lines.
// The price is stored in US dollars, as it was when the card was added.

const STORAGE_KEY = "pokemon-tcg-store-cart";
const MAX_QUANTITY = 99;

// Check that a saved line has the fields we rely on.
function isValidItem(item) {
    return (
        item &&
        typeof item.id === "string" &&
        typeof item.printType === "string" &&
        typeof item.name === "string" &&
        typeof item.price === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity > 0
    );
}

// Read the saved cart. Returns an empty cart if nothing is saved
// or the saved data is damaged, so the page never crashes on it.
export function getCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(saved) ? saved.filter(isValidItem) : [];
    } catch (error) {
        return [];
    }
}

// Save the cart. Returns false if the browser refused (for example
// in some private-browsing modes).
function saveCart(cart) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
        return true;
    } catch (error) {
        console.warn("Could not save the cart:", error);
        return false;
    }
}

// Add a card to the cart. If the same card and print type is already
// there, increase its quantity instead of adding a second line.
// Returns true if the cart was saved.
export function addToCart(item, quantity) {
    const cart = getCart();
    const existing = cart.find(
        (line) => line.id === item.id && line.printType === item.printType
    );

    if (existing) {
        existing.quantity = Math.min(existing.quantity + quantity, MAX_QUANTITY);
    } else {
        cart.push({ ...item, quantity: Math.min(quantity, MAX_QUANTITY) });
    }
    return saveCart(cart);
}

// Set the quantity of one line (found by card id + print type).
// The quantity is kept between 1 and MAX_QUANTITY.
// Returns true if the cart was saved.
export function setQuantity(id, printType, quantity) {
    const cart = getCart();
    const line = cart.find(
        (entry) => entry.id === id && entry.printType === printType
    );
    if (!line) return false;
    line.quantity = Math.max(1, Math.min(quantity, MAX_QUANTITY));
    return saveCart(cart);
}

// Remove one line (card id + print type) from the cart.
// Returns true if the cart was saved.
export function removeFromCart(id, printType) {
    const cart = getCart().filter(
        (line) => !(line.id === id && line.printType === printType)
    );
    return saveCart(cart);
}

// Total number of cards in the cart (all quantities added together).
export function getCartCount() {
    return getCart().reduce((total, line) => total + line.quantity, 0);
}