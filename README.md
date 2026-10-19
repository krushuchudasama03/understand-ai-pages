# UnderstandAI — static GitHub Pages edition

A quiet study desk for first principles. Ask a question; the app maps it to a concept with TF-IDF and k-means, teaches the underlying model, and gives you a fresh problem to solve. When the local library has no close match, it reads Wikipedia and returns a sourced briefing instead of inventing an answer.

This folder is a complete, dependency-free static site. It is the GitHub Pages version of the original Flask + R + Excel `understand_ai` project.

> **Why this is a separate build:** GitHub Pages only serves static files. Flask, Rscript, `plumber`, and native `.xlsx` writes cannot run there. The R engine has been ported to browser JavaScript, and Excel storage has been replaced with `localStorage`. The original project folder is untouched.

---

## Quick start

Open `index.html` in Chrome, Edge, or Firefox. Everything runs locally.

If your browser restricts `localStorage` or remote calls when opening a file directly, serve the folder instead:

```bash
# Python is usually already installed
python -m http.server 8080
```

Then visit `http://localhost:8080/`.

### Demo account

- Username: `alex_learner`
- Email: `alex@understand.ai`
- Password: `student123`

Or click **Use the demo account** in the account dialog. New accounts are stored only in the current browser.

---

## Deploy to GitHub Pages

### Option A — branch deploy (no build step)

1. Create a new GitHub repository.
2. Upload **the contents of this folder** to the repository root. `index.html` must be at the root, next to `css/`, `js/`, and `assets/`.
3. In the repository, open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select branch `main` and folder `/ (root)`, then save.
6. Wait for the Pages build, then open `https://<your-user>.github.io/<your-repo>/`.

Terminal version:

```bash
git init
git add .
git commit -m "Add UnderstandAI static study desk"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

Then enable Pages in repository settings.

### Option B — drag and drop

GitHub's web uploader accepts folders. Drag `index.html`, `css`, `js`, `assets`, `404.html`, and `.nojekyll` into the repository root.

### Notes for project pages

All paths are relative, so the app works at `username.github.io/repo/` without configuration. `.nojekyll` is included so GitHub serves the files directly instead of running Jekyll. `404.html` matches the app's visual style.

---

## What works without a server

| Original | Static edition |
| --- | --- |
| R TF-IDF + `stats::kmeans` | `js/engine.js` — TF-IDF vectors, spherical k-means (`k = 3`), cosine matching |
| R misconception rules | Browser rule engine for numeric tolerance, common-error mapping, trigger-pattern diagnosis |
| Flask REST API | No API; all logic runs in the page |
| `users.xlsx`, `chats.xlsx`, `user_mastery.xlsx` | Namespaced `localStorage` (`uai.v1.*`) |
| Account passwords hashed in Python | Salted SHA-256 via Web Crypto, comparing digests locally |

### The learning loop

1. **Map** — question tokens are weighted with TF-IDF and compared to five concept vectors. k-means supplies the cluster label. A minimum similarity and keyword threshold prevents forced matches.
2. **Intuition** — the concept's mental model is shown first.
3. **Parallel walkthrough** — a worked example is broken into steps.
4. **Independent practice** — one challenge at a time, with answer and reasoning inputs.
5. **Diagnosis** — wrong answers are matched against common-error maps and misconception triggers. Correct answers add 25 XP; mastery moves +15 / −5.
6. **Research** — if the question falls outside the local corpus, it is sent to the English Wikipedia API. The app shows the article extract, thumbnail, source link, related articles, and a Google search link. Results are cached locally for 30 days.

### Local corpus

Five concepts are bundled in `js/data.js`:

- Percentages & proportions
- Linear equations
- Quadratic equations
- Fractions & rationals
- Kinematics

Add a concept to `window.UAI_CORPUS.concepts` using the same shape as the original `data/concept_corpus.json` and it will be indexed automatically on load. No build step is needed.

---

## Research fallback: what it does and does not do

- **Wikipedia is fetched automatically** through the public MediaWiki API with `origin=*`, which supports browser CORS.
- **Google is a link, not a scrape.** Google does not allow browser-side reads of result pages, and a Google Custom Search key cannot be hidden in a static site. The briefing always offers an “Open in Google” action.
- If no article is found or the lookup fails, the app says so, offers Wikipedia and Google search links, and lets you retry. It never fills the gap with invented text.
- Wikipedia text is attributed and linked, with a CC BY-SA 4.0 note.
- A live internet connection is required only for the research fallback. The five-concept lessons work offline.

---

## Privacy and data

- Sessions, accounts, mastery, and cached briefings are saved in `localStorage` under `uai.v1.*`.
- Nothing is uploaded to a server controlled by this app.
- Sign-up passwords are salted and hashed with SHA-256 in the browser before storage. This is appropriate for a local study demo, not for production authentication.
- To reset everything, open DevTools → Application → Local Storage and delete the `uai.v1.*` keys. Or run this in the console:

```js
Object.keys(localStorage).filter(k => k.startsWith("uai.v1.")).forEach(k => localStorage.removeItem(k));
location.reload();
```

---

## File map

```
understand-ai-pages/
├── index.html            App shell, welcome desk, dialogs
├── 404.html              Matching not-found page
├── .nojekyll             Serve files without Jekyll
├── css/style.css         White / ink / lucid-blue design system
├── js/data.js            Five-concept corpus (ported JSON)
├── js/engine.js          TF-IDF, k-means, reasoning rules, Wikipedia research
├── js/app.js             Accounts, sessions, lesson cards, progress
├── assets/favicon.svg    Book mark
└── README.md
```

---

## Troubleshooting

**The page looks unstyled.** Confirm `css/style.css` is present and the folder structure was preserved. GitHub Pages is case-sensitive; keep lowercase file names.

**Research always fails.** Check that the browser can reach `en.wikipedia.org`. Some school or office networks block Wikipedia. Google/Wikipedia search links still work.

**Opening `index.html` directly shows no fonts.** Fonts come from Google Fonts. The site falls back to Georgia and the system UI font when offline; functionality is unaffected.

**I signed out and lost my progress.** Progress belongs to the local account selected. Use the same username on the same browser, or use the demo account. There is no cloud sync in a static deployment.

**Wikipedia rate-limits many rapid lookups.** Briefings are cached for 30 days and lookups are human-paced in normal use. If it happens, wait a moment and press “Try again”.

---

## Credits

Concept corpus, pedagogy, and diagnostic rules are adapted from the original UnderstandAI project. Wikipedia content is provided by the Wikimedia Foundation under CC BY-SA 4.0. Typefaces: Fraunces and Inter via Google Fonts.
