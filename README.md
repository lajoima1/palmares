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
WORKERS_CI=1 npm run build && npx wrangler dev
```

Then open http://localhost:8787.

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

Edit the theme in `src/App.tsx` to customize colors, fonts, and styling:

```typescript
const theme = createTheme({
  palette: {
    primary: {
      main: '#d32f2f', // Your primary color
    },
    // ... other theme options
  },
});
```

### Adding New Features

The codebase is well-structured for extending with new features:
- Add new search filters in `SearchFilter.tsx`
- Enhance recipe cards in `RecipeCard.tsx`
- Extend recipe format in `types/Recipe.ts`

### Image Commands

## Minifying size

`magick mogrify -format webp -quality 50 -define webp:lossless=false -resize "1200x1200>" **/*.jpg`

## To favicon

`magick input.webp -define icon:auto-resize=16,32,48 favicon.ico`

## Make square

`magick input.webp -gravity center -background transparent -extent 362x362 squared.webp`