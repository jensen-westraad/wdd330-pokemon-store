// Card data source. Swap in the live API address here when it is back up:
// "https://api.pokemontcg.io/v2/cards?pageSize=6"
const API_URL = "/sample-cards.json";

// Pick one price for a card. Prices differ by print type (normal,
// holofoil, ...), so for now we take the first type listed.
// Returns a number, or null if the card has no price.
function getMarketPrice(card) {
    const prices = card.tcgplayer?.prices;
    if (!prices) return null;
    const firstType = Object.values(prices)[0];
    return firstType?.market ?? null;
}

// Build the HTML for one card tile.
function createCardElement(card) {
    const price = getMarketPrice(card);
    const priceText = price === null ? "Price unavailable" : `$${price.toFixed(2)} USD`;

    const element = document.createElement("article");
    element.className = "card";
    element.innerHTML = `
    <img src="${card.images.small}" alt="${card.name} card" loading="lazy">
    <h2>${card.name}</h2>
    <p>${card.set.name}</p>
    <p>${card.rarity ?? "Rarity unknown"}</p>
    <p class="price">${priceText}</p>
  `;
    return element;
}

// All cards fetched from the data source. Search filters this list
// without calling the API again.
let allCards = [];

// Show the given cards on the page, replacing whatever was there.
function renderCards(cards) {
    const list = document.querySelector("#card-list");
    list.innerHTML = "";
    if (cards.length === 0) {
        list.textContent = "No cards match your search.";
        return;
    }
    cards.forEach((card) => {
        list.appendChild(createCardElement(card));
    });
}

// Compare two cards for sorting. Cards without a price always go last.
function compareCards(a, b, sortValue) {
    if (sortValue === "name-asc") {
        return a.name.localeCompare(b.name);
    }
    const priceA = getMarketPrice(a);
    const priceB = getMarketPrice(b);
    if (priceA === null && priceB === null) return 0;
    if (priceA === null) return 1;
    if (priceB === null) return -1;
    return sortValue === "price-asc" ? priceA - priceB : priceB - priceA;
}

// Apply the current search text and sort choice, then redraw the cards.
function updateDisplay() {
    const term = document.querySelector("#search").value.trim().toLowerCase();
    const sortValue = document.querySelector("#sort").value;
    const results = allCards
        .filter((card) => card.name.toLowerCase().includes(term))
        .sort((a, b) => compareCards(a, b, sortValue));
    renderCards(results);
}

async function loadCards() {
    const list = document.querySelector("#card-list");
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`The API responded with status ${response.status}`);
        }
        const result = await response.json();
        allCards = result.data;
        updateDisplay();
    } catch (error) {
        console.error(error);
        list.textContent = "Sorry, the cards could not be loaded. Please try again.";
    }
}

document.querySelector("#search").addEventListener("input", updateDisplay);
document.querySelector("#sort").addEventListener("change", updateDisplay);
loadCards();