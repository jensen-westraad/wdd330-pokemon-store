// CardDex API (pokemontcg.io-compatible). Newest sets first.
const API_BASE = "https://api.carddex.dev/compat/pokemontcg/v2";

// Cards of the currently selected set. Search, sort, and rarity
// filtering work on this list without calling the API again.
let allCards = [];

// Fetch a URL and return its JSON. Gives up after 10 seconds, and throws
// if the request failed, so the caller can show an error message.
async function fetchJson(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
        throw new Error(`The API responded with status ${response.status}`);
    }
    return response.json();
}

// Try the live API. If it fails or times out, tell the visitor and
// use a saved sample file instead.
async function fetchWithFallback(url, fallbackUrl) {
    try {
        return await fetchJson(url);
    } catch (error) {
        console.warn("Live API unavailable, using sample data:", error);
        document.querySelector("#notice").textContent =
            "The live card data is unavailable right now, so sample cards are shown.";
        return fetchJson(fallbackUrl);
    }
}

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

// Fill the rarity dropdown with the rarities found in the loaded cards.
function fillRarityFilter() {
    const select = document.querySelector("#rarity-filter");
    select.innerHTML = '<option value="">All rarities</option>';
    const rarities = new Set(allCards.map((card) => card.rarity).filter(Boolean));
    [...rarities].sort().forEach((rarity) => {
        const option = document.createElement("option");
        option.value = rarity;
        option.textContent = rarity;
        select.appendChild(option);
    });
}

// Apply search, rarity, and sort, then redraw the cards.
function updateDisplay() {
    const term = document.querySelector("#search").value.trim().toLowerCase();
    const rarity = document.querySelector("#rarity-filter").value;
    const sortValue = document.querySelector("#sort").value;

    const results = allCards
        .filter((card) => card.name.toLowerCase().includes(term))
        .filter((card) => !rarity || card.rarity === rarity)
        .sort((a, b) => compareCards(a, b, sortValue));
    renderCards(results);
}

// Fill the set dropdown with the 30 newest sets.
// Returns the id of the newest set, so it can be shown first.
async function loadSets() {
    const select = document.querySelector("#set-filter");
    const result = await fetchWithFallback(
        `${API_BASE}/sets?orderBy=-releaseDate&pageSize=30`,
        "/sample-sets.json"
    );
    result.data.forEach((set) => {
        const option = document.createElement("option");
        option.value = set.id;
        option.textContent = set.name;
        select.appendChild(option);
    });
    return result.data[0]?.id;
}

// Fetch every card in one set (up to 250) and show them.
// If the live API fails, fetchWithFallback loads the saved sample cards.
async function loadCards(setId) {
    const list = document.querySelector("#card-list");
    list.textContent = "Loading cards...";
    try {
        const result = await fetchWithFallback(
            `${API_BASE}/cards?q=set.id:${setId}&pageSize=250`,
            "/sample-cards.json"
        );
        allCards = result.data;
        fillRarityFilter();
        updateDisplay();
    } catch (error) {
        console.error(error);
        list.textContent = "Sorry, the cards could not be loaded. Please try again.";
    }
}

// Start the page: load the sets, then the newest set's cards.
async function init() {
    try {
        const newestSetId = await loadSets();
        if (newestSetId) {
            await loadCards(newestSetId);
        }
    } catch (error) {
        console.error(error);
        document.querySelector("#card-list").textContent =
            "Sorry, the sets could not be loaded. Please try again.";
    }
}

document.querySelector("#search").addEventListener("input", updateDisplay);
document.querySelector("#sort").addEventListener("change", updateDisplay);
document.querySelector("#rarity-filter").addEventListener("change", updateDisplay);
document.querySelector("#set-filter").addEventListener("change", (event) => {
    loadCards(event.target.value);
});

init();