# Later TODO(don't do right now, maybe write some stuff in this file about how you would do it)
- an admin mode where someone would be admin and they can set the beer to guess. The use case would be if someone has a beer-tasting
event and they wanted to use my game. The host of that event could set the beers to guess and then the others could guess. 
I don't know if this is possible with a static page like we currently have. It would obviously be possible to cheat, but maybe thats ok,
we don't care too much about cheating. 

  **Answer:** Yes, this works on a static page. The trick is to put the beer list in the link instead of on a server:
  1. An admin page (for example `index.html?admin` or `admin.html`) reuses the same search box, but picking a beer adds it to a list instead of guessing.
  2. When the host is done, the page builds a link like `.../beerdle/?lista=64267749,63545454,65949600`. The host sends it in the group chat or shows it as a QR code at the tasting.
  3. When the game sees `?lista=`, it uses that list instead of `daily_beers`. Everything else (retry, reveal, next) stays the same.

  Cheating: anyone can look up the IDs in the link. If that matters a little, encode the list (for example base64, or shuffle the digits with a fixed key) so it isn't readable at a glance. That's enough to stop casual peeking, and real security isn't needed here.

  Limits without a server: the host can't change the beers after the link is sent (they'd send a new link), and there's no shared scoreboard. If a live scoreboard ever matters, a free backend like Firebase or Supabase could be added later, but I'd start with the link version. It might also be fun to play in "blind" mode at a tasting: hide the product images in the guesses, since people might recognise the label.

- I(the user, not cluade) should add more beers

  **Answer:** Noted. Two notes for when you do: `data_managing.js` removes duplicates by name, so beers with the same name in different sizes only show up once. Also, every ID in `daily_beers` must exist in `beer_data.js`, or that round breaks. A quick check is to open the game with `?nr=1`, `?nr=2` and so on, or run `daily_beers.every(id => beers.some(b => b.productId === String(id)))` in the browser console. It should print `true`.