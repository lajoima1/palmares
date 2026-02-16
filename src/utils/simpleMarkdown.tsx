import React from "react";
import { Typography } from "@mui/material";

/**
 * Converts simple markdown (bold, italic, and headings) to React elements.
 * Supports:
 * - **text** or __text__ for bold
 * - *text* or _text_ for italic
 * - ***text*** or ___text___ for bold+italic
 * - # Heading 1 through ###### Heading 6
 */
export function parseSimpleMarkdown(text: string): React.ReactNode {
  if (!text) return text;

  // Check if this is a heading line (must start with # after optional whitespace)
  const headingMatch = text.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const content = headingMatch[2];

    // Parse inline markdown within the heading content
    const parsedContent = parseInlineMarkdown(content);

    // Map heading levels to font sizes (not semantic headings, just styled text)
    // Level 1 = same as h6 (1.25rem), then decreasing
    const fontSizeMap: Record<number, string> = {
      1: "1.25rem", // Same as h6
      2: "1.1rem",
      3: "1rem",
      4: "0.95rem",
      5: "0.9rem",
      6: "0.875rem",
    };

    return (
      <Typography
        component="div"
        sx={{
          mt: 1.5,
          mb: 0.5,
          fontWeight: 600,
          fontSize: fontSizeMap[level],
        }}
      >
        {parsedContent}
      </Typography>
    );
  }

  // Not a heading, parse as inline markdown
  return parseInlineMarkdown(text);
}

/**
 * Parse inline markdown elements (bold, italic) within text
 */
function parseInlineMarkdown(text: string): React.ReactNode {
  if (!text) return text;

  const parts: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;

  // Regex patterns for markdown (ordered by priority - longest match first)
  const patterns = [
    // Bold + Italic: ***text*** or ___text___
    {
      regex: /(\*\*\*|___)((?:(?!\1).)+)\1/g,
      render: (match: string) => (
        <strong key={key++}>
          <em>{match}</em>
        </strong>
      ),
    },
    // Bold: **text** or __text__
    {
      regex: /(\*\*|__)((?:(?!\1).)+)\1/g,
      render: (match: string) => <strong key={key++}>{match}</strong>,
    },
    // Italic: *text* or _text_ (but not __)
    {
      regex: /(\*|_)((?:(?!\1).)+)\1/g,
      render: (match: string) => <em key={key++}>{match}</em>,
    },
  ];

  // Process the text with all patterns
  const replacements: Array<{
    start: number;
    end: number;
    element: React.ReactNode;
  }> = [];

  // Find all matches for all patterns
  patterns.forEach((pattern) => {
    let match;
    pattern.regex.lastIndex = 0; // Reset regex
    while ((match = pattern.regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const innerContent = match[2];
      const start = match.index;
      const end = match.index + fullMatch.length;

      // Check if this position is already covered by a previous match
      const isOverlapping = replacements.some(
        (r) =>
          (start >= r.start && start < r.end) ||
          (end > r.start && end <= r.end),
      );

      if (!isOverlapping) {
        replacements.push({
          start,
          end,
          element: pattern.render(innerContent),
        });
      }
    }
  });

  // Sort replacements by start position
  replacements.sort((a, b) => a.start - b.start);

  // Build the final array of nodes
  replacements.forEach((replacement) => {
    // Add text before this replacement
    if (currentIndex < replacement.start) {
      parts.push(text.substring(currentIndex, replacement.start));
    }
    // Add the replacement element
    parts.push(replacement.element);
    currentIndex = replacement.end;
  });

  // Add any remaining text
  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  // If no replacements were made, return original text
  return parts.length === 0 ? text : <>{parts}</>;
}
