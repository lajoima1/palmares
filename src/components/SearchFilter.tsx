import React from "react";
import {
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  Stack,
  Autocomplete,
} from "@mui/material";
import Search from "@mui/icons-material/Search";
import FilterList from "@mui/icons-material/FilterList";

interface SearchFilterProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  selectedDifficulty: string;
  onDifficultyChange: (difficulty: string) => void;
  availableTags: string[];
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  searchTerm,
  onSearchChange,
  selectedTags,
  onTagsChange,
  selectedDifficulty,
  onDifficultyChange,
  availableTags,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDifficultyChange = (event: any) => {
    onDifficultyChange(event.target.value);
  };

  const removeTag = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <FilterList color="primary" />
        <Typography variant="h6">Search & filter recipes</Typography>
      </Box>

      <Stack spacing={3}>
        <TextField
          fullWidth
          label="Search recipes..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: <Search sx={{ mr: 1, color: "action.active" }} />,
          }}
          placeholder="Search by name, ingredients, or description"
        />

        <Box display="flex" gap={2} flexWrap="wrap">
          <Box sx={{ minWidth: 300, flexGrow: 1 }}>
            <Autocomplete
              multiple
              id="tags-autocomplete"
              options={availableTags}
              value={selectedTags}
              onChange={(_, newValue) => {
                onTagsChange(newValue);
              }}
              filterSelectedOptions
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    variant="filled"
                    label={option}
                    size="small"
                    {...getTagProps({ index })}
                    key={option}
                  />
                ))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  placeholder={
                    selectedTags.length === 0
                      ? "Search and select tags..."
                      : "Add more tags..."
                  }
                  helperText="Type to search for tags"
                />
              )}
              renderOption={(props, option) => (
                <Box component="li" {...props}>
                  <Chip label={option} size="small" variant="outlined" />
                </Box>
              )}
              noOptionsText="No matching tags found"
            />
          </Box>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Difficulty</InputLabel>
            <Select
              value={selectedDifficulty}
              onChange={handleDifficultyChange}
              label="Difficulty"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Easy">Easy</MenuItem>
              <MenuItem value="Medium">Medium</MenuItem>
              <MenuItem value="Hard">Hard</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {(selectedTags.length > 0 || selectedDifficulty || searchTerm) && (
          <Box>
            <Typography variant="caption" color="text.secondary">
              Active filters:
            </Typography>
            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
              {searchTerm && (
                <Chip
                  label={`Search: "${searchTerm}"`}
                  size="small"
                  variant="outlined"
                  onDelete={() => onSearchChange("")}
                />
              )}
              {selectedDifficulty && (
                <Chip
                  label={`Difficulty: ${selectedDifficulty}`}
                  size="small"
                  variant="outlined"
                  onDelete={() => onDifficultyChange("")}
                />
              )}
              {selectedTags.map((tag) => (
                <Chip
                  key={tag}
                  label={`Tag: ${tag}`}
                  size="small"
                  variant="outlined"
                  onDelete={() => removeTag(tag)}
                />
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};
