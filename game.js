const MAX_GUESSES = 6;
const START_DATE = "2026-10-19"; // Day #1
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
const submitButton = form.querySelector("button[type=submit]");
const suggestions = document.querySelector("#beer-suggestions");
const guessesContainer = document.querySelector("#guesses");
const guessesLeft = document.querySelector("#guesses-left");
const dayLabel = document.querySelector("#day-label");
const message = document.querySelector("#message");
const cluesContainer = document.querySelector("#clues");
const answer = document.querySelector("#answer");

const beersById = new Map(beers.map(beer => [beer.productId, beer]));

// "?dag=5" plays day 5 without saving anything, handy for testing and demos.
const dayOverride = Number(new URLSearchParams(location.search).get("dag")) || null;
const dayNumber = dayOverride || getTodayNumber();
const targetBeer = getDailyBeer(dayNumber);

let guesses = [];
let gameOver = false;
let selectedBeer = null;
let activeSuggestion = -1;

// ---------- Daily beer ----------

// Day number in Swedish time, so the beer changes at midnight in Sweden.
function getTodayNumber() {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm" }).format(new Date());
  return Math.round((Date.parse(today) - Date.parse(START_DATE)) / 86400000) + 1;
}

function getDailyBeer(day) {
  const index = (((day - 1) % daily_beers.length) + daily_beers.length) % daily_beers.length;
  return beersById.get(String(daily_beers[index]));
}

// ---------- Saved progress and stats ----------

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  if (dayOverride) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode etc. The game still works, it just won't remember.
  }
}

function getStats() {
  const stats = { played: 0, wins: 0, streak: 0, maxStreak: 0, lastWonDay: null, ...loadState().stats };
  if (stats.lastWonDay !== dayNumber && stats.lastWonDay !== dayNumber - 1) stats.streak = 0;
  return stats;
}

function saveProgress() {
  saveState({ ...loadState(), day: dayNumber, guesses: guesses.map(beer => beer.productId) });
}

function recordResult(won) {
  const stats = getStats();
  stats.played++;
  if (won) {
    stats.wins++;
    stats.streak++;
    stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
    stats.lastWonDay = dayNumber;
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
  return beers
    .filter(beer => !guesses.includes(beer))
    .filter(beer => !normalized ||
      getBeerName(beer).toLowerCase().includes(normalized) ||
      beer.producerName?.toLowerCase().includes(normalized))
    .slice(0, 12);
}

function renderSuggestions(query = "") {
  const matches = findMatches(query);
  suggestions.innerHTML = "";
  activeSuggestion = -1;

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
    item.addEventListener("click", () => {
      selectBeer(beer);
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

function selectBeer(beer) {
  selectedBeer = beer;
  input.value = getBeerName(beer);
  setSuggestionsOpen(false);
}

input.addEventListener("focus", () => renderSuggestions(input.value));
input.addEventListener("input", () => {
  selectedBeer = null;
  renderSuggestions(input.value);
});

input.addEventListener("keydown", event => {
  const open = !suggestions.classList.contains("hidden");
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (!open) renderSuggestions(input.value);
    setActiveSuggestion(activeSuggestion + (event.key === "ArrowDown" ? 1 : -1));
  } else if (event.key === "Enter" && open && activeSuggestion >= 0) {
    event.preventDefault();
    selectBeer(suggestions.querySelectorAll(".suggestion")[activeSuggestion].beer);
  } else if (event.key === "Escape") {
    setSuggestionsOpen(false);
  }
});

document.addEventListener("click", event => {
  if (!event.target.closest(".beer-search")) setSuggestionsOpen(false);
});

// ---------- Guessing ----------

form.addEventListener("submit", event => {
  event.preventDefault();
  if (gameOver) return;

  // Accept an exact name, or the only remaining match for what was typed.
  const matches = findMatches(input.value);
  const guessedBeer = selectedBeer ||
    beers.find(beer => getBeerName(beer).toLowerCase() === input.value.trim().toLowerCase()) ||
    (input.value.trim() && matches.length === 1 ? matches[0] : null);

  if (!guessedBeer) {
    showMessage("Välj en öl från listan");
    return;
  }

  if (guesses.includes(guessedBeer)) {
    showMessage("Du har redan gissat på den ölen");
    return;
  }

  addGuess(guessedBeer);
  saveProgress();

  if (gameOver) {
    recordResult(guessedBeer === targetBeer);
    renderStats();
  }

  input.value = "";
  selectedBeer = null;
  setSuggestionsOpen(false);
});

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
  submitButton.disabled = true;
  renderClues();

  showMessage(won
    ? `Snyggt! Du klarade det på ${guesses.length} gissning${guesses.length === 1 ? "" : "ar"}.`
    : "Tyvärr, slut på gissningar.");

  answer.classList.remove("hidden");
  answer.innerHTML = `
    <div class="answer-beer">
      ${getImage(targetBeer, "answer-image")}
      <div>
        <div class="answer-title">Dagens öl</div>
        <div class="answer-name">${escapeHtml(getBeerName(targetBeer))}</div>
        <div>${escapeHtml(targetBeer.categoryLevel3)} · ${formatNumber(targetBeer.alcoholPercentage)} % · ${escapeHtml(targetBeer.country)}</div>
      </div>
    </div>
    <button id="share" type="button">Dela resultat</button>
    <div id="stats" class="stats"></div>
    <p class="come-back">${dayOverride ? "Övningsläge, resultatet sparas inte." : "Kom tillbaka i morgon för en ny öl!"}</p>
  `;

  answer.querySelector("#share").addEventListener("click", shareResult);
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
  return `Beerdle #${dayNumber} ${won ? guesses.length : "X"}/${MAX_GUESSES}\n\n${rows.join("\n")}\n${location.origin}${location.pathname}`;
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

// ---------- Start ----------

function startGame() {
  dayLabel.textContent = `Beerdle #${dayNumber}${dayOverride ? " (övning)" : ""}`;
  updateGuessesLeft();
  renderClues();

  // Restore today's guesses if the page was reloaded.
  const saved = loadState();
  if (!dayOverride && saved.day === dayNumber) {
    for (const id of saved.guesses || []) {
      const beer = beersById.get(id);
      if (beer && !gameOver) addGuess(beer);
    }
    if (gameOver) renderStats();
  }
}

startGame();
