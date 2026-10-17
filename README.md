# 🧠 Name Memory

A flashcard game for practicing how to remember names and faces.

**Play it:** https://vmvalentin.github.io/name-memory-game/

## The technique
1. **Hear** the name (tap 🔊 to hear it spoken).
2. **Repeat** it in your head.
3. **Picture it:** link the sound of the name to an image, ideally an exaggerated feature of the person.
4. **Say it out loud** while picturing that image.

## The name-peg method
Number pegs work like this: 9 = flag, 0 = donut, so 90 is a flag stuck in a donut. Name pegs do the same for names. You learn a fixed image **once** for common first names and name sounds: Mike = 🎤 microphone, Bill = 🦆 duck bill, Al = 🦉 owl, -son = ☀️ sun, Mc = 🍔 Big Mac, -stein = 🍺 beer stein, -berg = 🧊 iceberg.

After that, each new person is quick: the **pegs** for the parts of their name + their **exaggerated feature** → one vivid **story**. Picture the story and say the name out loud.

> **Al·bert Ein·stein** = 🦉 owl + 🐦 Big Bird + ☝️ "#1" foam finger + 🍺 beer stein, all nesting in that wild white electric hair.

## How to use
- **Pick:** filter by category (Science, Sports, Historical, Arts & Culture, Business & Tech), tap photos to select them, or use *Select all* or *Random 10*. Tap **Tip & details** to read the suggested memory image, or edit it and write your own.
- **Practice:** the card shows a face. Try to recall the name, then tap to flip and see the name, its parts with their peg images, the feature, the story, and a "say it out loud" prompt. Tap **Remembered** and the card leaves the session. Tap **Forgot** and it goes back into the deck until you get it.
- **Pegs:** 266 built-in pegs (145 first names, 121 sounds and surname parts). Filter, search, and select them, then **drill** them as flashcards: the name or sound is on the front, and you flip to see the image(s). Remembered cards leave the session, and stats are kept. Each peg can have up to 3 images. Pick your primary one, edit any of them, or add your own pegs.
- **Story & details** (tap on any person): the name is split into parts and each part is matched to your primary peg image automatically. You can re-split it (`Al | bert Ein | stein`), choose a different peg or type your own image for any part, set the exaggerated feature, and write the story or tap **✨ Suggest a story**. All 72 built-in people come with a feature and story already filled in. The old quick tip is still there as a fallback.
- **Library:** every name you've practiced, with times seen, remembered, and forgotten, plus when you last practiced it. You can review all of them, the ones you forget most, the ones you haven't seen in 7+ days, or ones you check off.
- **Add:** add your own people (name, photo URL, category, feature, story). The name is matched against your pegs automatically. For famous people, *Find photo on Wikipedia* fills in the photo for you.

Progress (tips, stories, pegs, peg and people stats, custom people, the current session) is saved in your browser's `localStorage` on each device. Use **Library → Export / Import** to copy it between devices. Backups from the first version still import. Data saved by the first version is migrated automatically and nothing is lost.

### Add to your iPhone / iPad home screen
Open the link in Safari, tap **Share**, then tap **Add to Home Screen**. It opens full screen like an app.

## Files
- `index.html`, `style.css`, `app.js`: the app (plain HTML/CSS/JS, no build step)
- `logic.js`: the session and stats logic, with no DOM code (unit tested)
- `people.js`: the built-in library of 72 people (with feature, name parts, and story)
- `pegs.js`: the built-in name pegs
- `tests/`: run with `node tests/logic.test.js && node tests/pegs.test.js`
- `tools/`: data sources and build scripts (`fetch.py` checks photos against the Wikipedia REST API, `build_pegs.py` builds `pegs.js` from `pegs_src.txt`, `build_people.js` adds stories from `stories_src.txt`)

## Photos
Photos are thumbnails from Wikipedia / Wikimedia Commons and are loaded directly from Wikimedia. Each photo is under its own license, which you can see on the person's Wikipedia page (linked from *Tip & details*). If a stored image URL ever stops working, the app asks the Wikipedia REST API for the current thumbnail.
