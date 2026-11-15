# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Beerdle is a Wordle-style beer-guessing game, built as a hobby project for the author's dad and his friends. They are Swedish beer enthusiasts, and some of them work at breweries or pubs. **All user-facing text must be in Swedish.** The site is meant to be hosted on GitHub Pages.

## Running

There is no build step, package manager, linter or test suite. It's plain static HTML/CSS/JS with no dependencies. Open `index.html` directly in a browser, or serve the folder (for example `npx serve .` or `python -m http.server`). Product images load from Systembolaget's CDN, so an internet connection is needed for them. Add `?nr=N` to the URL to jump to beer N in `beers_to_guess` (1-based). This is useful for testing every beer, and the share text links to it.

## Architecture

- `index.html` loads `beer_data.js`, `beers_to_guess.js` and then `game.js` as classic scripts (not modules), and they share globals. Keep everything compatible with plain static hosting.
  - `beers` (`beer_data.js`) holds every beer that can be guessed.
  - `beers_to_guess` (`beers_to_guess.js`) is a hand-picked list of well-known beers that can be the answer, picked for the target audience. The name is left over from when there was one beer per day. It holds numeric `productId`s, while `beers` stores `productId` as strings, so convert with `String()`.
- **Rounds:** there is no daily schedule. The player plays through `beers_to_guess` in order, and `startRound(index)` sets up a round for `beers_to_guess[index]` (wrapping around at the end). The buttons are "Försök igen" (restart the same beer), "Visa svaret" (give up; counts as a loss) and "Nästa öl".
- **Search:** the suggestion list only shows once something is typed. Clicking a suggestion, or pressing Enter on a highlighted one, guesses it right away (there is no guess button). Enter without a highlighted suggestion accepts an exact name or a single remaining match.
- **Comparison:** the `ATTRIBUTES` table in `game.js` defines the tiles shown for each guess. Same style (`categoryLevel3`) is "correct" and the same `categoryLevel2` is "close". Numbers are "close" within ±1 % ABV, ±10 kr or ±1 on the 0–12 taste scale, and arrows point toward the answer's value. A `null` taste value shows as "unknown" (grey).
- **Clues:** `CLUES` unlocks the answer's colour and taste text after a set number of guesses.
- Guesses are compared by object identity, or by `productId` when restoring, not by name.
- **Saved state:** `localStorage["beerdle"]` holds `{ index, guesses: [productId], revealed, stats }`. The current round is restored on reload. Stats (played, wins, streak of consecutive wins) count each finished round, including retries. Old saves from the daily version (with `day` and no `index`) are ignored apart from stats. The share button builds a Wordle-style emoji grid.
- Image URLs are built from `productId`: `https://product-cdn.systembolaget.se/productimages/{id}/{id}_400.webp`. Only use them when `hasImage` is true.

## Data

- The data comes from Systembolaget (the Swedish state alcohol retailer) through the third-party Go scraper https://github.com/AlexGustafsson/systembolaget-api, because Systembolaget has no public API. Untappd was considered but has no usable public API.
- The author runs the scraper themselves, and its raw output isn't kept in this repo. Don't run the scraper or hit Systembolaget's servers.
- `data_managing.js` (`node data_managing.js [input]`) converts the scraper output into `beer_data.js`. It picks the fields, removes duplicates by name, and sets taste clocks to `null` when Systembolaget has no taste data, because the source uses 0 for both "no data" and a real 0.
- `beer_data.js` is large; avoid reading all of it. `Full_Beer_Data_Example.json` shows one complete source record.
- Data values (category names, countries, taste text) are in Swedish, as Systembolaget provides them.
