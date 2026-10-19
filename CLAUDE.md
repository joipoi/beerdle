# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Beerdle is a Wordle-style daily beer-guessing game, built as a hobby project for the author's dad and his friends. They are Swedish beer enthusiasts, and some of them work at breweries or pubs. **All user-facing text must be in Swedish.** The site is meant to be hosted on GitHub Pages.

## Running

There is no build step, package manager, linter or test suite. It's plain static HTML/CSS/JS with no dependencies. Open `index.html` directly in a browser, or serve the folder (for example `npx serve .` or `python -m http.server`). Product images load from Systembolaget's CDN, so an internet connection is needed for them. Add `?dag=N` to the URL to play day N in practice mode, which saves nothing. This is useful for testing every beer in `daily_beers`.

## Architecture

- `index.html` loads `beer_data.js`, `daily_beers.js` and then `game.js` as classic scripts (not modules), and they share globals. Keep everything compatible with plain static hosting.
  - `beers` (`beer_data.js`) holds every beer that can be guessed.
  - `daily_beers` (`daily_beers.js`) is a hand-picked list of well-known beers that can be the answer, picked for the target audience. It holds numeric `productId`s, while `beers` stores `productId` as strings, so convert with `String()`.
- **Daily answer:** `getTodayNumber()` counts days in Europe/Stockholm time since `START_DATE` (day #1), and the answer is `daily_beers[(day - 1) % length]`. So the order of `daily_beers` is the schedule.
- **Comparison:** the `ATTRIBUTES` table in `game.js` defines the tiles shown for each guess. Same style (`categoryLevel3`) is "correct" and the same `categoryLevel2` is "close". Numbers are "close" within ±1 % ABV, ±10 kr or ±1 on the 0–12 taste scale, and arrows point toward the answer's value. A `null` taste value shows as "unknown" (grey).
- **Clues:** `CLUES` unlocks the answer's colour and taste text after a set number of guesses.
- Guesses are compared by object identity, or by `productId` when restoring, not by name.
- **Saved state:** `localStorage["beerdle"]` holds `{ day, guesses: [productId], stats }`. Today's guesses are restored on reload. The share button builds a Wordle-style emoji grid.
- Image URLs are built from `productId`: `https://product-cdn.systembolaget.se/productimages/{id}/{id}_400.webp`. Only use them when `hasImage` is true.

## Data

- The data comes from Systembolaget (the Swedish state alcohol retailer) through the third-party Go scraper https://github.com/AlexGustafsson/systembolaget-api, because Systembolaget has no public API. Untappd was considered but has no usable public API.
- The author runs the scraper themselves, and its raw output isn't kept in this repo. Don't run the scraper or hit Systembolaget's servers.
- `data_managing.js` (`node data_managing.js [input]`) converts the scraper output into `beer_data.js`. It picks the fields, removes duplicates by name, and sets taste clocks to `null` when Systembolaget has no taste data, because the source uses 0 for both "no data" and a real 0.
- `beer_data.js` is large; avoid reading all of it. `Full_Beer_Data_Example.json` shows one complete source record.
- Data values (category names, countries, taste text) are in Swedish, as Systembolaget provides them.
