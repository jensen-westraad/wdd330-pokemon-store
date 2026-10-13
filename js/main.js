import { addToCart, getCartCount } from "./cart.js";

// CardDex API (pokemontcg.io-compatible). Newest sets first.
const API_BASE = "https://api.carddex.dev/compat/pokemontcg/v2";

// Cards of the currently selected set. Search, sort, and rarity/artist
// filtering work on this list without calling the API again.
let allCards = [];

// Friendly names for the print types the API uses as price keys.
const PRINT_LABELS = {
    normal: "Normal",
    holofoil: "Holofoil",
    reverseHolofoil: "Reverse holofoil",
};

// Rarity tiers: each has a badge symbol, a name, and a plain-language
// explanation for the rarity guide popup.
const RARITY_TIERS = {
    common: {
        symbol: "●",
        className: "rarity-common",
        label: "Common",
        description: "The cards you find most often in a pack.",
    },
    uncommon: {
        symbol: "◆",
        className: "rarity-uncommon",
        label: "Uncommon",
        description: "Found less often than commons.",
    },
    rare: {
        symbol: "★",
        className: "rarity-rare",
        label: "Rare",
        description: "Harder to find, and often holographic.",
    },
    special: {
        symbol: "✦",
        className: "rarity-special",
        label: "Special rarities",
        description:
            "The scarcest, most sought-after cards, such as Double Rare, Ultra Rare, Illustration Rare, and Secret Rare.",
    },
};

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
// holofoil, ...), so for the tile we take the first type listed.
// Returns a number, or null if the card has no price.
function getMarketPrice(card) {
    const prices = card.tcgplayer?.prices;
    if (!prices) return null;
    const firstType = Object.values(prices)[0];
    return firstType?.market ?? null;
}

// List every print type of a card that has a market price, as
// [{ type: "holofoil", market: 0.18 }, ...]. Used for the cart.
function getPrintOptions(card) {
    const prices = card.tcgplayer?.prices;
    if (!prices) return [];
    return Object.entries(prices)
        .filter(([, printPrice]) => typeof printPrice.market === "number")
        .map(([type, printPrice]) => ({ type, market: printPrice.market }));
}

// Build list items showing every available market price for a card.
function buildPriceRows(card) {
    const options = getPrintOptions(card);
    if (options.length === 0) return "<li>Price unavailable</li>";
    return options
        .map(
            ({ type, market }) =>
                `<li>${PRINT_LABELS[type] ?? type}: $${market.toFixed(2)} USD</li>`
        )
        .join("");
}

// Build the "add to cart" controls shown in the details modal.
function buildCartForm(card) {
    const options = getPrintOptions(card);
    if (options.length === 0) {
        return `<div class="cart-form"><p>This card can't be added to the cart because it has no price.</p></div>`;
    }
    const optionTags = options
        .map(
            ({ type, market }) =>
                `<option value="${type}">${PRINT_LABELS[type] ?? type} — $${market.toFixed(2)} USD</option>`
        )
        .join("");

    return `
    <div class="cart-form">
      <label for="print-type">Print type</label>
      <select id="print-type">${optionTags}</select>
      <label for="quantity">Quantity</label>
      <input type="number" id="quantity" min="1" max="99" value="1">
      <button type="button" id="add-to-cart" class="details-button">Add to cart</button>
      <p id="cart-message" role="status"></p>
    </div>
  `;
}

// Show the number of cards in the cart in the header.
function updateCartCount() {
    document.querySelector("#cart-count").textContent = getCartCount();
}

// Handle a click on the "Add to cart" button in the modal.
function handleAddToCart(card) {
    const message = document.querySelector("#cart-message");
    const printType = document.querySelector("#print-type").value;
    const quantity = Number.parseInt(document.querySelector("#quantity").value, 10);

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
        message.textContent = "Please enter a quantity from 1 to 99.";
        return;
    }

    const option = getPrintOptions(card).find((entry) => entry.type === printType);
    const saved = addToCart(
        {
            id: card.id,
            printType,
            name: card.name,
            setName: card.set.name,
            image: card.images.small,
            price: option.market,
        },
        quantity
    );

    message.textContent = saved
        ? `Added ${quantity} × ${card.name} (${PRINT_LABELS[printType] ?? printType}) to your cart.`
        : "Sorry, the cart could not be saved in this browser.";
    updateCartCount();
}

// Fill the details modal with one card's information and open it.
function openCardDialog(card) {
    const details = [
        ["Set", card.set.name],
        ["Rarity", card.rarity],
        ["Type", card.types?.join(", ")],
        ["HP", card.hp],
        ["Artist", card.artist],
    ]
        .filter(([, value]) => value)
        .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
        .join("");

    document.querySelector("#dialog-content").innerHTML = `
    <img src="${card.images.large}" alt="${card.name} card, large view">
    <div>
      <h2 id="dialog-title">${card.name}</h2>
      <dl>${details}</dl>
      <h3>TCGplayer market price</h3>
      <ul>${buildPriceRows(card)}</ul>
      ${buildCartForm(card)}
    </div>
  `;

    document
        .querySelector("#add-to-cart")
        ?.addEventListener("click", () => handleAddToCart(card));

    document.querySelector("#card-dialog").showModal();
}

// Choose a rarity tier from the rarity text, or null if there is none.
function getRarityTier(rarity) {
    if (!rarity) return null;
    const name = rarity.toLowerCase();
    if (name.includes("uncommon")) return RARITY_TIERS.uncommon;
    if (name.includes("common")) return RARITY_TIERS.common;
    if (/double|ultra|illustration|hyper|secret|special|ace spec|shiny/.test(name)) {
        return RARITY_TIERS.special;
    }
    if (name.includes("rare")) return RARITY_TIERS.rare;
    return null;
}

// Open the rarity guide. The tier the visitor clicked is highlighted.
function openRarityDialog(currentTier, rarityName) {
    const items = Object.values(RARITY_TIERS)
        .map((tier) => {
            const isCurrent = tier === currentTier;
            return `
        <li class="rarity-guide-item${isCurrent ? " current" : ""}"
            ${isCurrent ? 'aria-current="true"' : ""}>
          <span class="rarity-badge ${tier.className}" aria-hidden="true">${tier.symbol}</span>
          <div>
            <strong>${tier.label}</strong>
            <p>${tier.description}</p>
          </div>
        </li>`;
        })
        .join("");

    document.querySelector("#rarity-content").innerHTML = `
    <h2 id="rarity-title">Rarity guide</h2>
    <p>This card is <strong>${rarityName}</strong>.</p>
    <ul class="rarity-guide">${items}</ul>
    <p class="rarity-note">Symbols group cards into four tiers for this store.</p>
  `;
    document.querySelector("#rarity-dialog").showModal();
}

// Build the HTML for one card tile.
function createCardElement(card) {
    const price = getMarketPrice(card);
    const priceText = price === null ? "Price unavailable" : `$${price.toFixed(2)} USD`;
    const tier = getRarityTier(card.rarity);
    const badge = tier
        ? `<button type="button" class="rarity-badge ${tier.className}"
         aria-label="Rarity: ${card.rarity}. Open rarity guide"
         title="${card.rarity}">${tier.symbol}</button>`
        : "";

    const element = document.createElement("article");
    element.className = "card";
    element.innerHTML = `
    <div class="card-top">
      <h2>${card.name}</h2>
      ${badge}
    </div>
    <img src="${card.images.small}" alt="${card.name} card" loading="lazy">
    <p>${card.set.name}</p>
    <p class="price">${priceText}</p>
    <button type="button" class="details-button">View details</button>
  `;
    element
        .querySelector(".details-button")
        .addEventListener("click", () => openCardDialog(card));
    element
        .querySelector(".rarity-badge")
        ?.addEventListener("click", () => openRarityDialog(tier, card.rarity));
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

// Fill the artist dropdown with the artists found in the loaded cards.
function fillArtistFilter() {
    const select = document.querySelector("#artist-filter");
    select.innerHTML = '<option value="">All artists</option>';
    const artists = new Set(allCards.map((card) => card.artist).filter(Boolean));
    [...artists].sort((a, b) => a.localeCompare(b)).forEach((artist) => {
        const option = document.createElement("option");
        option.value = artist;
        option.textContent = artist;
        select.appendChild(option);
    });
}

// Apply search, rarity, artist, and sort, then redraw the cards.
function updateDisplay() {
    const term = document.querySelector("#search").value.trim().toLowerCase();
    const rarity = document.querySelector("#rarity-filter").value;
    const artist = document.querySelector("#artist-filter").value;
    const sortValue = document.querySelector("#sort").value;

    const results = allCards
        .filter((card) => card.name.toLowerCase().includes(term))
        .filter((card) => !rarity || card.rarity === rarity)
        .filter((card) => !artist || card.artist === artist)
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
        fillArtistFilter();
        updateDisplay();
    } catch (error) {
        console.error(error);
        list.textContent = "Sorry, the cards could not be loaded. Please try again.";
    }
}

// Start the page: load the sets, then the newest set's cards.
async function init() {
    updateCartCount();
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

// Controls
document.querySelector("#search").addEventListener("input", updateDisplay);
document.querySelector("#sort").addEventListener("change", updateDisplay);
document.querySelector("#rarity-filter").addEventListener("change", updateDisplay);
document.querySelector("#artist-filter").addEventListener("change", updateDisplay);
document.querySelector("#set-filter").addEventListener("change", (event) => {
    loadCards(event.target.value);
});

// Details modal: close button, and clicking the dimmed area outside it.
const cardDialog = document.querySelector("#card-dialog");
document
    .querySelector("#dialog-close")
    .addEventListener("click", () => cardDialog.close());
cardDialog.addEventListener("click", (event) => {
    if (event.target === cardDialog) cardDialog.close();
});

// Rarity guide modal: same closing behaviour.
const rarityDialog = document.querySelector("#rarity-dialog");
document
    .querySelector("#rarity-close")
    .addEventListener("click", () => rarityDialog.close());
rarityDialog.addEventListener("click", (event) => {
    if (event.target === rarityDialog) rarityDialog.close();
});

init();