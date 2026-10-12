// Card data source. Swap in the live API address here when it is back up:
// "https://api.pokemontcg.io/v2/cards?pageSize=6"
const API_URL = "https://api.carddex.dev/compat/pokemontcg/v2/cards?pageSize=50&orderBy=-set.releaseDate";

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

// Fill a dropdown with the unique values found in the loaded cards.
// getValue picks the field to use from each card (set name, rarity, ...).
function fillFilter(selectId, getValue) {
    const select = document.querySelector(selectId);
    const values = new Set(allCards.map(getValue).filter(Boolean));
    [...values].sort().forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

// Apply search, set, rarity, and sort, then redraw the cards.
function updateDisplay() {
    const term = document.querySelector("#search").value.trim().toLowerCase();
    const setName = document.querySelector("#set-filter").value;
    const rarity = document.querySelector("#rarity-filter").value;
    const sortValue = document.querySelector("#sort").value;

    const results = allCards
        .filter((card) => card.name.toLowerCase().includes(term))
        .filter((card) => !setName || card.set.name === setName)
        .filter((card) => !rarity || card.rarity === rarity)
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
        fillFilter("#set-filter", (card) => card.set.name);
        fillFilter("#rarity-filter", (card) => card.rarity);
        updateDisplay();

    } catch (error) {
        console.error(error);
        list.textContent = "Sorry, the cards could not be loaded. Please try again.";
    }
}

document.querySelector("#search").addEventListener("input", updateDisplay);
document.querySelector("#sort").addEventListener("change", updateDisplay);
document.querySelector("#set-filter").addEventListener("change", updateDisplay);
document.querySelector("#rarity-filter").addEventListener("change", updateDisplay);
loadCards();