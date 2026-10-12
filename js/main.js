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

async function loadCards() {
    const list = document.querySelector("#card-list");
    try {
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`The API responded with status ${response.status}`);
        }
        const result = await response.json();

        result.data.forEach((card) => {
            list.appendChild(createCardElement(card));
        });
    } catch (error) {
        console.error(error);
        list.textContent = "Sorry, the cards could not be loaded. Please try again.";
    }
}

loadCards();