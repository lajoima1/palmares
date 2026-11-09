# Palmares Recette - Family Recipe Collection

A beautiful, static website to showcase and organize your household's favorite recipes. Built with React, TypeScript, and Material-UI, designed for easy hosting on GitHub Pages.

## Features

- 🍳 **Recipe Collection**: Organize recipes with detailed information including ingredients, instructions, prep time, and difficulty
- 🏷️ **Smart Tagging**: Tag recipes for easy categorization and searching
- 🔍 **Advanced Search**: Search by name, ingredients, description, tags, and difficulty level
- 📱 **Responsive Design**: Beautiful Material-UI interface that works on all devices
- 🚀 **Two Sites, One Push**: Each push to `main` deploys to Cloudflare Workers and to GitHub Pages
- 📂 **File-Based**: Simple text file format for easy recipe management

## Recipe Format

Each recipe is stored in its own folder under `public/recipes/` with:
- `recipe.txt`: Recipe details in a simple format
- `image.txt`: Placeholder for recipe image (or add actual image files)

### Recipe Text Format

```
name: Recipe Name
description: Brief description of the recipe
servings: Number of servings
prep_time: Preparation time
cook_time: Cooking time  
total_time: Total time
difficulty: Easy/Medium/Hard
tags: tag1, tag2, tag3

ingredients:
- First ingredient
- Second ingredient
- Third ingredient

instructions:
1. First step
2. Second step
3. Third step

notes: Optional additional notes
```

## Getting Started

### Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Open http://localhost:5173

Checks:

- `npm run lint`: ESLint.
- `npm test`: the unit tests, with Vitest.
- `npm run check:recipes`: each recipe gives the same database rows after a save from the admin
  page. It prints `round-trip OK: <n> recipes`.

### Adding New Recipes

1. Create a new folder in `public/recipes/` with your recipe name (use kebab-case)
2. Add a `recipe.txt` file with your recipe details
3. Add your recipe folder name to `public/recipes/index.json`
4. Optionally add an image file or update the image placeholder

### Deployment

One push to `main` deploys the same commit to two sites:

- `https://palmares.lajoie.workers.dev/`: Cloudflare Workers Builds builds and deploys it.
- `https://lajoima1.github.io/palmares/`: the GitHub Actions workflow in
  `.github/workflows/deploy.yml` builds and deploys it.

The Cloudflare build sets `WORKERS_CI`, so `vite.config.ts` serves the app from `/`. The GitHub
Pages build serves it from `/palmares/`.

`/api/health` on the Cloudflare site returns `{"status":"ok","commit":"<sha>"}`. Use it to see which
commit is live.

To test the Worker on your computer:

```bash
WORKERS_CI=1 npm run build && npx wrangler dev --env local
```

Then open http://localhost:8787.

## Two looks

The Cloudflare site has two looks:

- **The new look** (`src/herb/`, theme `src/theme/herb.ts`) is the default. A recipe opens at
  `/recipe/<slug>`. An old link `/#/<slug>` forwards to that address.
- **The old look** (`src/App.tsx`, `src/components/`, theme `src/theme/themes.ts`) is the app
  before the redesign. Settings → "Old look" switches a device to it. Its colour menu has "Use the
  new look" to switch back.

Each device remembers its look (`look` in `localStorage`) and its appearance (`appearance`:
system, light or dark). `src/main.tsx` loads the code of one look only.

The GitHub Pages copy has only the old look, with `#/<slug>` links. `vite.config.ts` sets
`__LOOKS__` to `false` for that build, so its bundle has no code of the new look. The same build
removes the `<!--herb-->` blocks of `index.html`: the loader, fonts and icons of the new look.
`npm run dev` shows the new look at http://localhost:5173/.

## Install the app

On an Android phone, open `https://palmares.lajoie.workers.dev/` in Chrome. Then tap ⋮ →
"Install app". The app opens full screen at the recipe list, with its own icon. The admin page
opens in the same app.

`public/manifest.webmanifest` holds the name, the colours and the icons. `index.html` links it in a
`<!--herb-->` block, so the GitHub Pages copy is not installable. The app keeps no offline copy:
it loads the recipes at each start, like the web page. Chrome updates an installed app some time
after a change to the manifest, sometimes days later.

## Admin page

The owner adds, changes and deletes recipes at `https://palmares.lajoie.workers.dev/admin/`, from
a phone or a computer. The sign-in is a passkey: the fingerprint, the face or the PIN of the
device. Only the Cloudflare build has this page. The GitHub Pages copy gets each saved recipe
through the next build.

Each save is one commit on `main`, with `recipe.txt`, `image.webp` and `recipes/index.json`. The
commit starts both builds, so the change is live in about two minutes. The browser makes the photo
small and turns it into webp before the upload. On a device where the owner signed in, Settings
on the main page has a "Manage recipes" link. The old look shows it in its header.

### Setup (once)

1. **Make a GitHub token.** GitHub → Settings → Developer settings → Fine-grained tokens:
   - repository access: only `lajoima1/palmares`;
   - permissions: Contents, read and write, and nothing else;
   - expiration: write the end date in `TOKEN_EXPIRES` in `wrangler.jsonc`, as `YYYY-MM-DD`.
     The admin page warns 30 days before that date. Leave it empty for a token with no end date.
2. **Make the KV namespace** `palmares-auth` (Cloudflare → Storage & databases → Workers KV). Its
   ID goes in `wrangler.jsonc` under `kv_namespaces`, with the binding `AUTH`.
3. **Add three Worker secrets** (Cloudflare → the `palmares` Worker → Settings → Variables and
   Secrets). Make `SESSION_SECRET` and `SETUP_CODE` with `openssl rand -base64 32`.
   - `GITHUB_TOKEN`: the token of step 1.
   - `SESSION_SECRET`: signs the session cookie. A new value signs out each device.
   - `SETUP_CODE`: opens the first registration. Keep it in a password manager.
4. Open `/admin/`, enter the setup code, and register the first device.

Add more devices from the "Passkeys" screen. Remove a lost device there: its sessions end at once.
If no passkey is left, delete all keys in `palmares-auth`, `setup:done` too. Then the setup code
opens the registration again.

When the token ends, make a new one, replace the `GITHUB_TOKEN` secret, and change
`TOKEN_EXPIRES`. Until the `SETUP_CODE` secret exists, the setup answers 503.

### Local work

1. Copy `.dev.vars.example` to `.dev.vars`. Git ignores `.dev.vars`. Never commit it.
2. Put a token in `GITHUB_TOKEN`, and random values in `SESSION_SECRET` and `SETUP_CODE`.
   `GITHUB_BRANCH=admin-test` sends local saves to a test branch. The Worker refuses a local save
   to `main`.
3. Run `WORKERS_CI=1 npm run build && npx wrangler dev --env local`, then open
   http://localhost:8787/admin/. Use `localhost`, not `127.0.0.1`: passkeys need it.

For the Vite dev server, run `npx wrangler dev --env local` and `WORKERS_CI=1 npm run dev` together, set
`ORIGIN=http://localhost:5173` in `.dev.vars`, and open http://localhost:5173/admin/. Vite sends
`/api` to the Worker on port 8787.

### Recipe auto-fill

"Fill from a photo or link" at the top of Add recipe reads one photo, one link or one pasted text,
and fills the form. The owner checks the fields and saves. Some sites refuse a request from the
Worker (Budget Bytes answers 403): copy the text of the page and use "Paste text". The Worker
sends the photo, the text of the page or the pasted text to a vision model of Cloudflare Workers
AI through the `AI` binding. `worker/model.ts` holds the
model, the prompt and the call. There is no key: the binding uses the Cloudflare account.

- **Cost.** The Workers Free plan gives 10,000 neurons a day, and it cannot bill more. One read
  costs about 100 neurons, so about 100 reads a day. The allowance starts again at 00:00 UTC.
  After that, the page says "The free limit of the day is reached".
- **Try a model from this computer.** `npm run try:read -- <photo or link>` reads like the admin
  page and prints the fields, the time and the neurons. `--model <id>` tries another model. It
  needs `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in the environment.

Local access to Workers AI, one of two ways:

1. **An API token (preferred).** Cloudflare → My Profile → API Tokens → Create Token → the
   "Workers AI" template. It can use Workers AI and nothing else. Write it in
   `cloudflare-ai.local` (git ignores `*.local`), with the account ID from the dashboard:
   ```
   CLOUDFLARE_ACCOUNT_ID=<account id>
   CLOUDFLARE_API_TOKEN=<token>
   ```
   Load it in the shell with `set -a; . ./cloudflare-ai.local; set +a`.
2. **`npx wrangler login`.** It opens the browser and stores an OAuth token on this computer. That
   token can change most of the Cloudflare account, so prefer the API token.

Workers AI has no local mode. The `local` environment of `wrangler.jsonc` has no `AI` binding, so
`wrangler dev --env local` needs no sign-in, and a read there shows "The service failed". A plain
`wrangler dev` needs a sign-in that can open a remote session (`wrangler login`), and each read
uses the daily allowance. `npm test` never calls the service.

## Project Structure

```
public/
  recipes/
    index.json          # List of all recipe folders
    recipe-name/
      recipe.txt        # Recipe details
      image.txt         # Image placeholder or actual image
src/
  components/           # React components
  types/               # TypeScript type definitions
  App.tsx              # Main application
```

## Technologies Used

- **React 19** with TypeScript
- **Material-UI (MUI)** for beautiful components
- **Vite** for fast development and building
- **GitHub Pages** for hosting
- **GitHub Actions** for automatic deployment

## Customization

### Theming

The colours, fonts and shapes of the new look are in `src/theme/herb.ts`. `src/theme/herb.test.ts`
checks that each text colour has a contrast of 4.5:1 or more on its background. The old look keeps
its six colour themes in `src/theme/themes.ts`.

### Adding New Features

- The new look: the list in `src/herb/ListPage.tsx`, the recipe page in `src/herb/RecipePage.tsx`,
  the filter rules in `src/herb/filters.ts`.
- The recipe format: `src/types/Recipe.ts` and `scripts/build-recipes-db.js`.

### Image Commands

## Minifying size

`magick mogrify -format webp -quality 50 -define webp:lossless=false -resize "1200x1200>" **/*.jpg`

## To favicon

The old look: `magick input.webp -define icon:auto-resize=16,32,48 favicon.ico`

The new look: `public/icon.svg` is the source.

- `rsvg-convert -w 32 -h 32 public/icon.svg -o public/icon-32.png`
- `sed 's/ rx="9"//' public/icon.svg | rsvg-convert -w 180 -h 180 -o public/apple-touch-icon.png`
  (square corners: the phone rounds them)
- `rsvg-convert -w 192 -h 192 public/icon.svg -o public/icon-192.png`, and the same with 512 for
  `public/icon-512.png` (the installed app)
- `sed -e 's/ rx="9"//' -e 's/scale(1.12)/scale(0.9)/' public/icon.svg | rsvg-convert -w 512 -h 512 -o public/icon-maskable-512.png`
  (Android crops this one to a circle or another shape: the smaller leaf stays inside)

## Make square

`magick input.webp -gravity center -background transparent -extent 362x362 squared.webp`