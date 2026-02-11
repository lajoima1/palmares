import { useState, useEffect, useMemo, useRef } from "react";
import {
  ThemeProvider,
  CssBaseline,
  Typography,
  Box,
  Alert,
  AppBar,
  Toolbar,
  Paper,
  Fab,
} from "@mui/material";
import Restaurant from "@mui/icons-material/Restaurant";
import KeyboardArrowUp from "@mui/icons-material/KeyboardArrowUp";
import { type Recipe } from "./types/Recipe";
import { loadAllRecipesFromDb } from "./utils/recipeDatabase";
import { RecipeCard } from "./components/RecipeCard";
import { RecipeDetail } from "./components/RecipeDetail";
import { SearchFilter } from "./components/SearchFilter";
import { ThemeToggle } from "./components/ThemeToggle";
import { LoadingSpinner } from "./components/LoadingSpinner";
import { createAppTheme, colorThemes, type ColorTheme } from "./theme/themes";

// Our Family's Favorite Recipes
// A curated collection of beloved family recipes, passed
// down through generations and tested in our kitchen with love.

function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const recipesLoaded = useRef(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme-mode");
    return saved
      ? JSON.parse(saved)
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [currentColorTheme, setCurrentColorTheme] = useState<ColorTheme>(() => {
    const saved = localStorage.getItem("color-theme");
    if (saved) {
      return JSON.parse(saved);
    }
    // Default to Parchment theme
    return (
      colorThemes.find((t) => t.name === "Parchment") || colorThemes[0]
    );
  });

  // Update localStorage when theme changes
  useEffect(() => {
    localStorage.setItem("theme-mode", JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem("color-theme", JSON.stringify(currentColorTheme));
  }, [currentColorTheme]);

  const currentTheme = createAppTheme(
    isDarkMode ? "dark" : "light",
    currentColorTheme,
  );

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleColorThemeChange = (theme: ColorTheme) => {
    setCurrentColorTheme(theme);
  };

  useEffect(() => {
    // Prevent double-loading in React StrictMode (development only)
    if (recipesLoaded.current) return;
    recipesLoaded.current = true;

    const loadRecipes = async () => {
      try {
        setLoading(true);
        const loadedRecipes = await loadAllRecipesFromDb();
        setRecipes(loadedRecipes);
      } catch (err) {
        setError("Failed to load recipes. Please try again later.");
        console.error("Error loading recipes:", err);
      } finally {
        setLoading(false);
      }
    };

    loadRecipes();
  }, []);

  // Handle URL-based recipe routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const recipeMatch = hash.match(/^#\/(.+)$/);

      if (recipeMatch && recipes.length > 0) {
        const recipeId = recipeMatch[1];
        const recipe = recipes.find((r) => r.id === recipeId);
        if (recipe) {
          setSelectedRecipe(recipe);
        } else {
          // Recipe not found, clear the hash
          window.history.replaceState(null, "", window.location.pathname);
        }
      }
    };

    // Handle initial load
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [recipes]);

  // Handle scroll to top button and AppBar shadow
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.pageYOffset;
      setShowScrollTop(scrollY > 300);
      setIsScrolled(scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Get all unique tags
  const availableTags = useMemo(() => {
    const allTags = recipes.flatMap((recipe) => recipe.tags);
    return Array.from(new Set(allTags)).sort();
  }, [recipes]);

  // Filter recipes based on search criteria
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesSearch =
        searchTerm === "" ||
        recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.ingredients.some((ingredient) =>
          ingredient.toLowerCase().includes(searchTerm.toLowerCase()),
        );

      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.every((tag) => recipe.tags.includes(tag));

      const matchesDifficulty =
        selectedDifficulty === "" || recipe.difficulty === selectedDifficulty;

      return matchesSearch && matchesTags && matchesDifficulty;
    });
  }, [recipes, searchTerm, selectedTags, selectedDifficulty]);

  const handleViewRecipe = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    // Update URL to reflect the selected recipe
    window.history.pushState(null, "", `#/${recipe.id}`);
  };

  const handleCloseRecipe = () => {
    setSelectedRecipe(null);
    // Clear the recipe from URL
    window.history.pushState(null, "", window.location.pathname);
  };

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      // Remove tag if already selected
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      // Add tag if not selected
      setSelectedTags([...selectedTags, tag]);
    }
  };

  if (loading) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <LoadingSpinner />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={currentTheme}>
      <CssBaseline />
      <AppBar
        position="sticky"
        elevation={isScrolled ? 4 : 0}
        sx={{
          backgroundColor: "primary.main",
          backgroundImage: "none",
          borderBottom: `1px solid ${
            isDarkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
          }`,
          transition: "box-shadow 0.2s ease-in-out",
          color: "white", // Force white text for all AppBar content
          "& .MuiTypography-root": {
            color: "white", // Ensure all Typography elements use white text
          },
          "& .MuiSvgIcon-root": {
            color: "white", // Ensure all icons use white color
          },
        }}
      >
        <Toolbar>
          <Restaurant sx={{ mr: 2 }} />
          <Typography
            variant="h6"
            component="div"
            sx={{ flexGrow: 1, fontWeight: 600 }}
          >
            Palmarès
          </Typography>
          <Typography variant="body1" sx={{ mr: 2, fontWeight: "bold" }}>
            {filteredRecipes.length} recipe
            {filteredRecipes.length !== 1 ? "s" : ""}
          </Typography>
          <ThemeToggle
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            currentColorTheme={currentColorTheme}
            onColorThemeChange={handleColorThemeChange}
          />
        </Toolbar>
      </AppBar>{" "}
      {/* Hero Section */}
      <Box sx={{ maxWidth: "900px", margin: "auto" }}>
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, py: 4 }}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 4, sm: 6 },
              mb: 4,
              backgroundColor: "background.paper",
              border: `1px solid ${currentColorTheme.primary}20`,
              width: "100%",
            }}
          >
            <Typography
              variant="h4"
              component="h1"
              gutterBottom
              textAlign="center"
              color="primary.main"
            >
              Palmarès
            </Typography>
            <Typography
              variant="h6"
              textAlign="center"
              color="text.secondary"
              sx={{ maxWidth: 600, mx: "auto" }}
            >
              Une collection de recettes accumulées au fil des générations et
              testées dans notre cuisine familiale
            </Typography>
          </Paper>
        </Box>

        {/* Search and Filter */}
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, mb: 4 }}>
          <SearchFilter
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            selectedDifficulty={selectedDifficulty}
            onDifficultyChange={setSelectedDifficulty}
            availableTags={availableTags}
          />
        </Box>

        {/* Content Area */}
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, mb: 4 }}>
          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 4 }}>
              {error}
            </Alert>
          )}

          {/* Recipe Grid */}
          {filteredRecipes.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                textAlign: "center",
                backgroundColor: "background.paper",
              }}
            >
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No recipes found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search criteria or clear the filters.
              </Typography>
            </Paper>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "repeat(auto-fit, minmax(280px, 1fr))",
                  md: "repeat(auto-fit, minmax(320px, 1fr))",
                  lg: "repeat(auto-fit, minmax(350px, 1fr))",
                  xl: "repeat(auto-fit, minmax(380px, 1fr))",
                },
                gap: { xs: 2, sm: 3, md: 4 },
                width: "100%",
              }}
            >
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onViewRecipe={handleViewRecipe}
                  onTagClick={handleTagClick}
                  selectedTags={selectedTags}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Recipe Detail Modal */}
        <RecipeDetail
          recipe={selectedRecipe}
          open={!!selectedRecipe}
          onClose={handleCloseRecipe}
          onTagClick={handleTagClick}
          selectedTags={selectedTags}
        />

        {/* Scroll to Top Button */}
        {showScrollTop && (
          <Fab
            color="primary"
            size="medium"
            onClick={scrollToTop}
            sx={{
              position: "fixed",
              bottom: 16,
              right: 16,
              zIndex: 1000,
              "& .MuiSvgIcon-root": {
                color: "white", // Force white icon for all themes
              },
            }}
          >
            <KeyboardArrowUp />
          </Fab>
        )}
      </Box>
      {/* Footer */}
      <Box
        component="footer"
        sx={{
          mt: 8,
          py: 4,
          px: { xs: 2, sm: 3, md: 4 },
          backgroundColor: isDarkMode ? "background.paper" : "grey.100",
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Made with 🤖 for our family's culinary journey
        </Typography>
      </Box>
    </ThemeProvider>
  );
}

export default App;

// TODO:
// Make nicer header with the recipes wreath
// Make the app wider. We need to see more recipes at once.
// Make the aestethic better and more consistent. Parchment aestethic.
