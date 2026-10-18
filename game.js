const MAX_GUESSES = 6;

let targetBeer;
let guesses = [];
let gameOver = false;

const form = document.querySelector("#guess-form");
const input = document.querySelector("#beer-input");
const suggestions = document.querySelector("#beer-suggestions");
const guessesContainer = document.querySelector("#guesses");
const guessesLeft = document.querySelector("#guesses-left");
const message = document.querySelector("#message");
const answer = document.querySelector("#answer");
const newGameButton = document.querySelector("#new-game");

let selectedBeer = null;

function renderSuggestions(query = "") {
  const normalized = query.trim().toLowerCase();
  const matches = beers
    .map((beer, index) => ({ beer, index }))
    .filter(({ beer }) => {
      if (!normalized) return true;
      return getBeerName(beer).toLowerCase().includes(normalized) ||
        beer.productNameBold.toLowerCase().includes(normalized) ||
        beer.productNameThin?.toLowerCase().includes(normalized);
    })
    .slice(0, 12);

  suggestions.innerHTML = "";

  if (!matches.length) {
    suggestions.innerHTML = `<div class="no-results">Inga öl hittades</div>`;
    suggestions.classList.remove("hidden");
    return;
  }

  matches.forEach(({ beer }) => {
    const item = document.createElement("button");
    let beerImage = `https://product-cdn.systembolaget.se/productimages/${beer.productId}/${beer.productId}_400.webp`;
    item.type = "button";
    item.className = "suggestion";
    item.setAttribute("role", "option");

    item.innerHTML = `
      ${beerImage ? `<img src="${escapeHtml(beerImage)}" alt="" loading="lazy">` : `<div class="suggestion-placeholder">🍺</div>`}
      <span class="suggestion-info">
        <strong>${escapeHtml(beer.productNameBold)}</strong>
        <span>${escapeHtml(beer.productNameThin)}</span>
      </span>
      <span class="suggestion-meta">${escapeHtml(beer.categoryLevel3 || beer.categoryLevel2 || "")}</span>
    `;

    item.addEventListener("click", () => selectBeer(beer));
    suggestions.appendChild(item);
  });

  suggestions.classList.remove("hidden");
}

function selectBeer(beer) {
  selectedBeer = beer;
  input.value = getBeerName(beer);
  suggestions.classList.add("hidden");
  input.setAttribute("aria-expanded", "false");
}

input.addEventListener("focus", () => renderSuggestions(input.value));
input.addEventListener("input", () => {
  selectedBeer = null;
  renderSuggestions(input.value);
});

document.addEventListener("click", event => {
  if (!event.target.closest(".beer-search")) {
    suggestions.classList.add("hidden");
    input.setAttribute("aria-expanded", "false");
  }
});

function getBeerName(beer) {
  if(beer.productNameThin){
     return `${beer.productNameBold} ${beer.productNameThin}`;
  }else{
    return beer.productNameBold
  }
 
}

// Use the date to choose the same beer for everyone on the same day.
// This is intentionally simple for now.
function getDailyBeer() {
  const start = new Date("2026-01-01T00:00:00Z");
  const now = new Date();

  const days = Math.floor(
    (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      start.getTime()) /
      86400000
  );

  return beers[((days % beers.length) + beers.length) % beers.length];
}

function startGame() {
  targetBeer = getDailyBeer();
  guesses = [];
  gameOver = false;

  guessesContainer.innerHTML = "";
  message.textContent = "";
  answer.classList.add("hidden");
  answer.innerHTML = "";
  input.value = "";
  input.disabled = false;
  form.querySelector("button").disabled = false;

  updateGuessesLeft();
}

function updateGuessesLeft() {
  const left = MAX_GUESSES - guesses.length;
  guessesLeft.textContent = `${left} gissning${left === 1 ? "" : "ar"} kvar`;
}

function findBeer(value) {
  const normalized = value.trim().toLowerCase();

  return beers.find(
    beer => getBeerName(beer).toLowerCase() === normalized
  );
}

form.addEventListener("submit", event => {
  event.preventDefault();

  if (gameOver) return;

  const guessedBeer = selectedBeer || findBeer(input.value);

  if (!guessedBeer) {
    showMessage("Välj en öl från listan");
    return;
  }

  if (guesses.some(beer => getBeerName(beer) === getBeerName(guessedBeer))) {
    showMessage("Du gissade redan den ölen");
    return;
  }

  guesses.push(guessedBeer);
  renderGuess(guessedBeer);
  updateGuessesLeft();

  if (isCorrect(guessedBeer)) {
    endGame(true);
  } else if (guesses.length >= MAX_GUESSES) {
    endGame(false);
  }

  input.value = "";
  selectedBeer = null;
});

newGameButton.addEventListener("click", startGame);

function isCorrect(beer) {
  return getBeerName(beer) === getBeerName(targetBeer);
}

function renderGuess(beer) {
  const row = document.createElement("div");
  row.className = "guess-row";
  let beerImage = `https://product-cdn.systembolaget.se/productimages/${beer.productId}/${beer.productId}_400.webp`;

  const values = [
    `<span class="beer-cell-content">${beerImage ? `<img class="guess-beer-image" src="${escapeHtml(beerImage)}" alt="" loading="lazy">` : ""}<span>${escapeHtml(getBeerName(beer))}</span></span>`,
    formatComparison(
      beer.alcoholPercentage,
      targetBeer.alcoholPercentage,
      true
    ),
    formatComparison(
      beer.categoryLevel2,
      targetBeer.categoryLevel2
    ),
    formatComparison(
      beer.categoryLevel3,
      targetBeer.categoryLevel3
    ),
    formatComparison(beer.price, targetBeer.price, true, "price"),
    formatComparison(beer.country, targetBeer.country)
  ];

  values.forEach(value => {
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.innerHTML = value;
    row.appendChild(cell);
  });

  guessesContainer.prepend(row);
}

function formatComparison(value, target, numeric = false, type = "") {
  let status = "wrong";
  let arrow = "";

  if (value === target) {
    status = "correct";
  } else if (numeric) {
    if (value < target) arrow = " ↑";
    if (value > target) arrow = " ↓";

    // "Close" means within 1 percentage point for alcohol
    // or within 10 SEK for price.
    const difference = Math.abs(value - target);
    const threshold = type === "price" ? 10 : 1;

    if(type == "price"){
      value = value + " kr";
    }

    if (difference <= threshold) {
      status = "close";
    }
  }

  return `<span class="value ${status}">${value}${arrow}</span>`;
}

function endGame(won) {
  gameOver = true;
  input.disabled = true;
  form.querySelector("button").disabled = true;
  let beerImage = `https://product-cdn.systembolaget.se/productimages/${targetBeer.productId}/${targetBeer.productId}_400.webp`;

  if (won) {
    showMessage(`Korrekt! Du fick svaret på ${guesses.length} gissning${guesses.length === 1 ? "" : "ar"}.`);
  } else {
    showMessage("Slut på gissningar");
  }

  answer.classList.remove("hidden");
  answer.innerHTML = `
    ${beerImage ? `<img class="answer-image" src="${escapeHtml(beerImage)}" alt="${escapeHtml(getBeerName(targetBeer))}">` : ""}
    <div>
      <strong>Dagens öl: </strong>
      <div class="answer-name">${escapeHtml(getBeerName(targetBeer))}</div>
      <div>${escapeHtml(targetBeer.categoryLevel3)} · ${targetBeer.alcoholPercentage}% · ${escapeHtml(targetBeer.country)}</div>
    </div>
  `;
}

function showMessage(text) {
  message.textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

startGame();
