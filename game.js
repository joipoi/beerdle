const MAX_GUESSES = 6;
const STORAGE_KEY = "beerdle";

// Each guess is compared to the answer on these attributes, shown as tiles.
const ATTRIBUTES = [
  { label: "Bryggeri", value: beer => beer.producerName, compare: (guess, target) => compareText(guess.producerName, target.producerName) },
  { label: "Stil", value: beer => beer.categoryLevel3 || beer.categoryLevel2, compare: compareStyle },
  { label: "Land", value: beer => beer.country, compare: (guess, target) => compareText(guess.country, target.country) },
  { label: "Alkohol", value: beer => `${formatNumber(beer.alcoholPercentage)} %`, compare: (guess, target) => compareNumber(guess.alcoholPercentage, target.alcoholPercentage, 1) },
  { label: "Pris", value: beer => `${formatNumber(beer.price)} kr`, compare: (guess, target) => compareNumber(guess.price, target.price, 10) },
  { label: "Beska", value: beer => beer.bitterness ?? "–", compare: (guess, target) => compareNumber(guess.bitterness, target.bitterness, 1) },
  { label: "Fyllighet", value: beer => beer.body ?? "–", compare: (guess, target) => compareNumber(guess.body, target.body, 1) },
  { label: "Sötma", value: beer => beer.sweetness ?? "–", compare: (guess, target) => compareNumber(guess.sweetness, target.sweetness, 1) }
];

// Text clues about the answer that unlock after a number of wrong guesses.
const CLUES = [
  { after: 2, label: "Färg", value: beer => beer.color },
  { after: 4, label: "Smak", value: beer => beer.taste }
];

const STATUS_EMOJI = { correct: "🟩", close: "🟨", wrong: "⬛", unknown: "⬛" };

const form = document.querySelector("#guess-form");
const input = document.querySelector("#beer-input");
const suggestions = document.querySelector("#beer-suggestions");
const guessesContainer = document.querySelector("#guesses");
const guessesLeft = document.querySelector("#guesses-left");
const roundLabel = document.querySelector("#round-label");
const message = document.querySelector("#message");
const cluesContainer = document.querySelector("#clues");
const answer = document.querySelector("#answer");
const retryButton = document.querySelector("#retry");
const revealButton = document.querySelector("#reveal");
const nextButton = document.querySelector("#next");

const beersById = new Map(beers.map(beer => [beer.productId, beer]));

let beerIndex = 0;     // Position in beers_to_guess of the beer being guessed.
let targetBeer = null;
let guesses = [];
let gameOver = false;
let revealed = false;  // True when the player gave up and asked for the answer.
let activeSuggestion = -1;

// ---------- Saved progress and stats ----------

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode etc. The game still works, it just won't remember.
  }
}

function getStats() {
  return { played: 0, wins: 0, streak: 0, maxStreak: 0, ...loadState().stats };
}

function saveProgress() {
  saveState({ ...loadState(), index: beerIndex, guesses: guesses.map(beer => beer.productId), revealed });
}

function recordResult(won) {
  const stats = getStats();
  stats.played++;
  if (won) {
    stats.wins++;
    stats.streak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
  } else {
    stats.streak = 0;
  }
  saveState({ ...loadState(), stats });
}

// ---------- Search dropdown ----------

function getBeerName(beer) {
  return [beer.productNameBold, beer.productNameThin].filter(Boolean).join(" ");
}

function getImage(beer, className) {
  if (!beer.hasImage) return `<div class="${className} image-placeholder">🍺</div>`;
  const src = `https://product-cdn.systembolaget.se/productimages/${beer.productId}/${beer.productId}_400.webp`;
  return `<img class="${className}" src="${src}" alt="" loading="lazy">`;
}

function findMatches(query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  return beers
    .filter(beer => !guesses.includes(beer))
    .filter(beer =>
      getBeerName(beer).toLowerCase().includes(normalized) ||
      beer.producerName?.toLowerCase().includes(normalized))
    .slice(0, 12);
}

// The list only shows once the player has started typing.
function renderSuggestions(query = "") {
  suggestions.innerHTML = "";
  activeSuggestion = -1;

  if (!query.trim()) {
    setSuggestionsOpen(false);
    return;
  }

  const matches = findMatches(query);
  if (!matches.length) {
    suggestions.innerHTML = `<div class="no-results">Inga öl hittades</div>`;
  }

  matches.forEach(beer => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "suggestion";
    item.setAttribute("role", "option");
    item.innerHTML = `
      ${getImage(beer, "suggestion-image")}
      <span class="suggestion-info">
        <strong>${escapeHtml(beer.productNameBold)}</strong>
        <span>${escapeHtml(beer.productNameThin || "")}</span>
      </span>
      <span class="suggestion-meta">${escapeHtml(beer.categoryLevel3 || beer.categoryLevel2 || "")}</span>
    `;
    // Picking a beer guesses it straight away.
    item.addEventListener("click", () => {
      makeGuess(beer);
      input.focus();
    });
    item.beer = beer;
    suggestions.appendChild(item);
  });

  setSuggestionsOpen(true);
}

function setSuggestionsOpen(open) {
  suggestions.classList.toggle("hidden", !open);
  input.setAttribute("aria-expanded", String(open));
}

function setActiveSuggestion(index) {
  const items = [...suggestions.querySelectorAll(".suggestion")];
  if (!items.length) return;
  activeSuggestion = (index + items.length) % items.length;
  items.forEach((item, i) => item.classList.toggle("active", i === activeSuggestion));
  items[activeSuggestion].scrollIntoView({ block: "nearest" });
}

input.addEventListener("focus", () => renderSuggestions(input.value));
input.addEventListener("input", () => renderSuggestions(input.value));

input.addEventListener("keydown", event => {
  const open = !suggestions.classList.contains("hidden");
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!open) renderSuggestions(input.value);
    setActiveSuggestion(activeSuggestion + (event.key === "ArrowDown" ? 1 : -1));
  } else if (event.key === "Enter" && open && activeSuggestion >= 0) {
    event.preventDefault();
    makeGuess(suggestions.querySelectorAll(".suggestion")[activeSuggestion].beer);
  } else if (event.key === "Escape") {
    setSuggestionsOpen(false);
  }
});

document.addEventListener("click", event => {
  if (!event.target.closest(".beer-search")) setSuggestionsOpen(false);
});

// ---------- Guessing ----------

// Pressing Enter without picking from the list accepts an exact name,
// or the only remaining match for what was typed.
form.addEventListener("submit", event => {
  event.preventDefault();
  const query = input.value.trim().toLowerCase();
  const matches = findMatches(query);
  const guessedBeer =
    beers.find(beer => getBeerName(beer).toLowerCase() === query) ||
    (matches.length === 1 ? matches[0] : null);

  if (!guessedBeer) {
    showMessage("Välj en öl från listan");
    return;
  }
  makeGuess(guessedBeer);
});

function makeGuess(beer) {
  if (gameOver) return;
  if (guesses.includes(beer)) {
    showMessage("Du har redan gissat på den ölen");
    return;
  }

  addGuess(beer);
  updateControls();
  saveProgress();

  if (gameOver) {
    recordResult(beer === targetBeer);
    renderStats();
  }

  input.value = "";
  setSuggestionsOpen(false);
}

function addGuess(beer) {
  guesses.push(beer);
  renderGuess(beer);
  renderClues();
  updateGuessesLeft();
  showMessage("");

  if (beer === targetBeer) {
    endGame(true);
  } else if (guesses.length >= MAX_GUESSES) {
    endGame(false);
  }
}

function compareText(value, target) {
  return { status: value === target ? "correct" : "wrong" };
}

// Same style is correct, same main category (e.g. both "Ale") is close.
function compareStyle(guess, target) {
  if (guess.categoryLevel3 === target.categoryLevel3) return { status: "correct" };
  return { status: guess.categoryLevel2 === target.categoryLevel2 ? "close" : "wrong" };
}

function compareNumber(value, target, closeWithin) {
  if (value == null || target == null) return { status: "unknown" };
  if (value === target) return { status: "correct" };
  return {
    status: Math.abs(value - target) <= closeWithin ? "close" : "wrong",
    arrow: value < target ? "↑" : "↓"
  };
}

function getResults(beer) {
  return ATTRIBUTES.map(attribute => attribute.compare(beer, targetBeer));
}

function renderGuess(beer) {
  const row = document.createElement("div");
  row.className = "guess";
  const results = getResults(beer);

  row.innerHTML = `
    <div class="guess-name ${beer === targetBeer ? "correct" : ""}">
      ${getImage(beer, "guess-image")}
      <span>${escapeHtml(getBeerName(beer))}</span>
    </div>
    <div class="tiles">
      ${ATTRIBUTES.map((attribute, i) => `
        <div class="tile ${results[i].status}">
          <span class="tile-label">${attribute.label}</span>
          <span class="tile-value">${escapeHtml(String(attribute.value(beer) ?? "–"))}${results[i].arrow ? ` ${results[i].arrow}` : ""}</span>
        </div>
      `).join("")}
    </div>
  `;

  guessesContainer.prepend(row);
}

function renderClues() {
  const available = CLUES.filter(clue => clue.value(targetBeer));
  cluesContainer.classList.toggle("hidden", !available.length);

  cluesContainer.innerHTML = `<h2>Ledtrådar</h2>` + available.map(clue => {
    const unlocked = gameOver || guesses.length >= clue.after;
    return unlocked
      ? `<p class="clue"><strong>${clue.label}:</strong> ${escapeHtml(clue.value(targetBeer))}</p>`
      : `<p class="clue locked">${clue.label}: låses upp efter ${clue.after} gissningar</p>`;
  }).join("");
}

function updateGuessesLeft() {
  const left = MAX_GUESSES - guesses.length;
  guessesLeft.textContent = `${left} gissning${left === 1 ? "" : "ar"} kvar`;
}

// ---------- End of game ----------

function endGame(won) {
  gameOver = true;
  input.disabled = true;
  setSuggestionsOpen(false);
  renderClues();
  updateControls();

  showMessage(won
    ? `Snyggt! Du klarade det på ${guesses.length} gissning${guesses.length === 1 ? "" : "ar"}.`
    : revealed ? "Här är svaret." : "Tyvärr, slut på gissningar.");

  answer.classList.remove("hidden");
  answer.innerHTML = `
    <div class="answer-beer">
      ${getImage(targetBeer, "answer-image")}
      <div>
        <div class="answer-title">Rätt svar</div>
        <div class="answer-name">${escapeHtml(getBeerName(targetBeer))}</div>
        <div>${escapeHtml(targetBeer.categoryLevel3)} · ${formatNumber(targetBeer.alcoholPercentage)} % · ${escapeHtml(targetBeer.country)}</div>
      </div>
    </div>
    <button id="share" type="button">Dela resultat</button>
    <div id="stats" class="stats"></div>
  `;

  answer.querySelector("#share").addEventListener("click", shareResult);
  renderStats();
}

function renderStats() {
  const stats = getStats();
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  document.querySelector("#stats").innerHTML = [
    ["Spelade", stats.played],
    ["Vinst %", winRate],
    ["Svit", stats.streak],
    ["Bästa svit", stats.maxStreak]
  ].map(([label, value]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");
}

function getShareText() {
  const won = guesses.includes(targetBeer);
  const rows = guesses.map(beer => getResults(beer).map(result => STATUS_EMOJI[result.status]).join(""));
  const score = won ? `${guesses.length}/${MAX_GUESSES}` : revealed ? "gav upp" : `X/${MAX_GUESSES}`;
  return `Beerdle öl #${beerIndex + 1} ${score}\n\n${rows.join("\n")}\n${location.origin}${location.pathname}?nr=${beerIndex + 1}`;
}

async function shareResult() {
  const text = getShareText();
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    showMessage("Resultatet är kopierat, klistra in det där du vill dela det!");
  } catch (error) {
    if (error.name !== "AbortError") showMessage("Kunde inte dela resultatet");
  }
}

// ---------- Helpers ----------

function formatNumber(number) {
  return number.toLocaleString("sv-SE");
}

function showMessage(text) {
  message.textContent = text;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ---------- Rounds: retry, reveal and next ----------

// Starts guessing beer number `index` in beers_to_guess, optionally replaying saved guesses.
function startRound(index, savedGuesses = [], savedRevealed = false) {
  beerIndex = ((index % beers_to_guess.length) + beers_to_guess.length) % beers_to_guess.length;
  targetBeer = beersById.get(String(beers_to_guess[beerIndex]));
  guesses = [];
  gameOver = false;
  revealed = false;

  guessesContainer.innerHTML = "";
  answer.classList.add("hidden");
  answer.innerHTML = "";
  input.disabled = false;
  input.value = "";
  setSuggestionsOpen(false);
  showMessage("");

  roundLabel.textContent = `Öl ${beerIndex + 1} av ${beers_to_guess.length}`;
  updateGuessesLeft();
  renderClues();

  // Replaying saved guesses doesn't count towards the stats again.
  for (const id of savedGuesses) {
    const beer = beersById.get(id);
    if (beer && !gameOver) addGuess(beer);
  }
  if (savedRevealed && !gameOver) {
    revealed = true;
    endGame(false);
  }

  updateControls();
  saveProgress();
}

function updateControls() {
  retryButton.disabled = !guesses.length && !gameOver;
  revealButton.disabled = gameOver;
}

retryButton.addEventListener("click", () => startRound(beerIndex));
nextButton.addEventListener("click", () => startRound(beerIndex + 1));

revealButton.addEventListener("click", () => {
  if (gameOver) return;
  revealed = true;
  recordResult(false);
  endGame(false);
  saveProgress();
});

// ---------- Start ----------

// "?nr=5" jumps straight to beer number 5 in beers_to_guess, handy for testing and sharing.
const requestedNumber = Number(new URLSearchParams(location.search).get("nr"));
const saved = loadState();
// Saves from the old daily version have no index, so their guesses are for some other beer.
const hasSavedRound = Number.isInteger(saved.index);

if (requestedNumber) {
  const index = requestedNumber - 1;
  const sameRound = hasSavedRound && saved.index === index;
  startRound(index, sameRound ? saved.guesses : [], sameRound && saved.revealed);
  // Drop "?nr" so a reload after pressing "Nästa öl" doesn't jump back.
  history.replaceState(null, "", location.pathname);
} else if (hasSavedRound) {
  startRound(saved.index, saved.guesses || [], saved.revealed);
} else {
  startRound(0);
}
