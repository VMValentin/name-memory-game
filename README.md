# 🧠 Name Memory

A flashcard game for practicing how to remember names and faces.

**Play it:** https://vmvalentin.github.io/name-memory-game/

## The technique
1. **Hear** the name (tap 🔊 to hear it spoken).
2. **Repeat** it in your head.
3. **Picture it:** link the sound of the name to an image, ideally an exaggerated feature of the person.
4. **Say it out loud** while picturing that image.

## How to use
- **Pick:** filter by category (Science, Sports, Historical, Arts & Culture, Business & Tech), tap photos to select them, or use *Select all* or *Random 10*. Tap **Tip & details** to read the suggested memory image, or edit it and write your own.
- **Practice:** the card shows a face. Try to recall the name, then tap to flip and see the name, the tip, and a "say it out loud" prompt. Tap **Remembered** and the card leaves the session. Tap **Forgot** and it goes back into the deck until you get it.
- **Library:** every name you've practiced, with times seen, remembered, and forgotten, plus when you last practiced it. You can review all of them, the ones you forget most, the ones you haven't seen in 7+ days, or ones you check off.
- **Add:** add your own people (name, photo URL, category, tip). For famous people, *Find photo on Wikipedia* fills in the photo for you.

Progress (tips, stats, custom people, the current session) is saved in your browser's `localStorage` on each device. Use **Library → Export / Import** to copy it between devices.

### Add to your iPhone / iPad home screen
Open the link in Safari, tap **Share**, then tap **Add to Home Screen**. It opens full screen like an app.

## Files
- `index.html`, `style.css`, `app.js`: the app (plain HTML/CSS/JS, no build step)
- `logic.js`: the session and stats logic, with no DOM code (unit tested)
- `people.js`: the built-in library of 72 people
- `tests/logic.test.js`: run with `node tests/logic.test.js`
- `tools/`: the script that checked every person against the Wikipedia REST API and collected the photo URLs

## Photos
Photos are thumbnails from Wikipedia / Wikimedia Commons and are loaded directly from Wikimedia. Each photo is under its own license, which you can see on the person's Wikipedia page (linked from *Tip & details*). If a stored image URL ever stops working, the app asks the Wikipedia REST API for the current thumbnail.
