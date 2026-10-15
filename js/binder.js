// js/binder.js
// Virtual card binders: one binder per set, saved in localStorage.
// Shape: { setId: { setName, color, total, cards: { cardId: { id, name, number, image } } } }

const BINDERS_KEY = "pokemon-tcg-store-binders";

// Binder cover colours, handed out in order as new binders are started.
export const BINDER_COLORS = [
    "#cc0000",
    "#1d2d5c",
    "#15803d",
    "#6d28d9",
    "#b45309",
    "#0e7490",
    "#be185d",
    "#4b5563",
];

// A saved binder is usable only if it has the fields we rely on.
function isValidBinder(binder) {
    return (
        binder &&
        typeof binder.setName === "string" &&
        typeof binder.color === "string" &&
        typeof binder.total === "number" &&
        binder.cards &&
        typeof binder.cards === "object"
    );
}

/** Read all binders; bad or missing data gives an empty object. */
export function getBinders() {
    try {
        const saved = JSON.parse(localStorage.getItem(BINDERS_KEY));
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
        const valid = {};
        Object.entries(saved).forEach(([setId, binder]) => {
            if (isValidBinder(binder)) valid[setId] = binder;
        });
        return valid;
    } catch {
        return {};
    }
}

// Write all binders. Returns false if the browser blocked the save.
function saveBinders(binders) {
    try {
        localStorage.setItem(BINDERS_KEY, JSON.stringify(binders));
        return true;
    } catch {
        return false;
    }
}

/**
 * Add a card to the binder for its set, creating the binder (and giving
 * it the next colour) the first time. Returns { saved, alreadyOwned }.
 * total = how many cards the set has; card = { id, name, number, image }
 */
export function addToBinder(setId, setName, total, card) {
    const binders = getBinders();

    if (binders[setId]?.cards[card.id]) {
        return { saved: true, alreadyOwned: true };
    }

    if (!binders[setId]) {
        const color = BINDER_COLORS[Object.keys(binders).length % BINDER_COLORS.length];
        binders[setId] = { setName, color, total: Number(total) || 0, cards: {} };
    }

    binders[setId].cards[card.id] = {
        id: card.id,
        name: card.name,
        number: card.number ?? "",
        image: card.image,
    };
    return { saved: saveBinders(binders), alreadyOwned: false };
}

/** True if the card is already in that set's binder. */
export function hasCard(setId, cardId) {
    return Boolean(getBinders()[setId]?.cards[cardId]);
}

/** How many cards are in that set's binder. */
export function getOwnedCount(setId) {
    const binder = getBinders()[setId];
    return binder ? Object.keys(binder.cards).length : 0;
}