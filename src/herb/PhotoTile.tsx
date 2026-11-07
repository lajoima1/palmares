import { useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { headingFont } from "../theme/herb";

interface PhotoTileProps {
  src: string;
  name: string;
  aspectRatio?: string;
  // A fixed height in place of the aspect ratio, as for the photo at the top of a recipe page.
  height?: number;
  letterHeight?: number;
  radius: number | string;
  letterSize: number;
  alt?: string;
}

// The recipe photo, or the first letter of the name on the herb tint if the photo is missing or
// does not load.
export function PhotoTile({ src, name, aspectRatio, height, letterHeight, radius, letterSize, alt = "" }: PhotoTileProps) {
  const t = useTheme().herb;
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <Box
        aria-hidden="true"
        sx={{
          width: "100%",
          aspectRatio: height ? undefined : aspectRatio,
          height: letterHeight ?? height,
          borderRadius: radius,
          bgcolor: t.herbTint,
          color: t.herb,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: headingFont,
          fontWeight: 800,
          fontSize: letterSize,
        }}
      >
        {name.charAt(0).toUpperCase()}
      </Box>
    );
  }
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      sx={{ width: "100%", aspectRatio: height ? undefined : aspectRatio, height, objectFit: "cover", borderRadius: radius, display: "block", bgcolor: t.herbTint }}
    />
  );
}
