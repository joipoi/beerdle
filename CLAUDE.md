# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Beerdle is a Wordle-style daily beer-guessing game, built as a hobby project for the author's dad and his friends. They are Swedish beer enthusiasts, and some of them work at breweries or pubs. **All user-facing text must be in Swedish.** The site is meant to be hosted on GitHub Pages.

## Running

There is no build step, package manager, linter or test suite. It's plain static HTML/CSS/JS with no dependencies. Open `index.html` directly in a browser, or serve the folder (for example `npx serve .` or `python -m http.server`). Product images load from Systembolaget's CDN, so an internet connection is needed for them.

## Architecture

- `index.html` loads `beer_data.js` first, then `game.js`, as classic scripts (not modules). `beer_data.js` defines a global `const beers = [...]` that `game.js` reads directly. Keep this load order, and keep everything compatible with plain static hosting.
- `game.js` holds all game logic in global scope. It picks the daily answer (`getDailyBeer()`: days since 2026-01-01 UTC, modulo `beers.length`, so the answer depends on array order). It also runs the custom search dropdown and compares each guess against the target in `formatComparison()`. A cell is "correct" on an exact match. For numeric fields it's "close" within 1 percentage point of ABV or 10 SEK of price, and the arrows show which direction the answer lies in.
- Beers are currently identified by display name (`getBeerName()` = `productNameBold` + `productNameThin`), not `productId`.
- Image URLs are built from `productId`: `https://product-cdn.systembolaget.se/productimages/{id}/{id}_400.webp`. Not every product has an image (check the `images` array in the source data).

## Data

- The data comes from Systembolaget (the Swedish state alcohol retailer) through the third-party Go scraper https://github.com/AlexGustafsson/systembolaget-api, because Systembolaget has no public API. Untappd was considered but has no usable public API.
- `beer_data.js` holds a hand-extracted subset of fields: `alcoholPercentage`, `categoryLevel2` (category), `categoryLevel3` (style), `price`, `productNameBold` (usually the brewery), `productNameThin`, `volumeText`, `country` and `productId`.
- `Full_Beer_Data_Example.json` shows one complete source record. It has more fields that the game doesn't use yet, such as `producerName`, `volume`, `bottleText`, `assortmentText`, `color`, `taste`, `usage` and `tasteClockBitter/Body/Sweetness/...`.
- The raw scraper output is newline-delimited JSON objects (one per line, wrapped in `[` `]`), not a valid JSON array. The full 372-beer set (`data.js`, `systembolaget_list.json`) was removed from the working tree in commit `a7facfa` but can be recovered from `c740da3`. Currently `beer_data.js` contains only 5 beers.
- Data values (category names, countries) are in Swedish, as Systembolaget provides them.
