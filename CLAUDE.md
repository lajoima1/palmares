# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (http://localhost:5173)
npm run build        # Build for production (runs build:recipes first, then TypeScript + Vite)
npm run build:recipes # Compile recipe text files into SQLite DB + copy images to public/
npm run lint         # Run ESLint
npm run preview      # Preview the production build locally
npm run deploy       # Deploy to GitHub Pages (runs build first via predeploy)
npm run add-recipe "Recipe Name"  # Scaffold a new recipe folder with template
npm run tags         # Print all tags currently in use with usage counts
```

## Architecture

This is a **static React/TypeScript SPA** deployed to GitHub Pages at `/palmares/` (configured in `vite.config.ts` as `base: "/palmares/"`).

### Data pipeline (build-time → runtime)

1. **Source of truth**: `recipes/<slug>/recipe.txt` — plain text files with a key-value + sections format. Images live alongside as `image.webp`. `recipes/index.json` is the authoritative list of recipe slugs.

2. **Build step** (`scripts/build-recipes-db.js`): Reads all recipe files, parses them, inserts into an in-memory SQLite database via `sql.js`, then writes `public/recipes.db`. Images are copied to `public/recipes/<slug>.webp`.

3. **Runtime** (`src/utils/recipeDatabase.ts`): Fetches `recipes.db` over HTTP, loads it into `sql.js` (WASM, loaded from `https://sql.js.org/dist/`), queries all recipes into memory on startup, then closes the DB. The entire recipe collection lives in React state.

### SQLite schema

Tables: `recipes`, `ingredients`, `instructions`, `notes`. The `recipes.id` is an autoincrement integer; the app uses `slug` as the external identifier (mapped to `Recipe.id`).

### React app structure

- `App.tsx` — single top-level component managing all state: recipes array, search/filter state, selected recipe, theme, dark mode, content width. All filtering is done client-side with `useMemo`.
- `src/components/` — presentational components: `RecipeCard`, `RecipeDetail`, `SearchFilter`, `ThemeToggle`, `LoadingSpinner`
- `src/theme/themes.ts` — MUI theme factory (`createAppTheme`) and `colorThemes` array
- `src/types/Recipe.ts` — single `Recipe` interface used throughout
- URL routing uses hash-based navigation (`#/<slug>`) via `window.history.pushState` and `hashchange` events — no router library.

### Adding a recipe

1. `npm run add-recipe "Recipe Name"` — creates `recipes/<slug>/recipe.txt` (template) and adds slug to `recipes/index.json`
2. Fill in `recipe.txt` and add `image.webp` to the folder
3. `npm run build:recipes` regenerates the database (or just `npm run build` for a full build)

### Recipe text format

```
name: ...
description: ...
servings: ...
prep_time: ...
cook_time: ...
total_time: ...
difficulty: Easy|Medium|Hard
tags: tag1, tag2

ingredients:
- item

instructions:
1. step

notes:
- note
```
