import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

type IconProps = { size?: number; color?: string; strokeWidth?: number };

function Svg({ size = 20, color = "currentColor", strokeWidth = 2, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const LeafIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21c0-9 5-15 14-16-1 9-6 14-14 16z" />
    <path d="M5 21l8-8" />
  </Svg>
);

export const SlidersIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h10" />
    <path d="M18 7h2" />
    <circle cx="16" cy="7" r="2" />
    <path d="M4 17h4" />
    <path d="M12 17h8" />
    <circle cx="10" cy="17" r="2" />
  </Svg>
);

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Svg>
);

export const FilterIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </Svg>
);

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 7l10 10" />
    <path d="M17 7L7 17" />
  </Svg>
);

export const BackIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);

export const SunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M4.9 4.9l1.4 1.4" />
    <path d="M17.7 17.7l1.4 1.4" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
  </Svg>
);

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  </Svg>
);

export const SearchMinusIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
    <path d="M8 11h6" />
  </Svg>
);

export const OfflineIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 8.8a15 15 0 0120 0" />
    <path d="M5.5 12.4a10 10 0 0113 0" />
    <path d="M9 16a5 5 0 016 0" />
    <path d="M3 3l18 18" />
  </Svg>
);

export const BookIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5z" />
    <path d="M4 19.5A2.5 2.5 0 006.5 22H20v-5" />
    <path d="M10 8l4 4" />
    <path d="M14 8l-4 4" />
  </Svg>
);

// The brand mark: a leaf on a herb square.
export function Mark({ size = 40 }: { size?: number }) {
  const t = useTheme().herb;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: `${Math.round(size * 0.3)}px`,
        bgcolor: t.herb,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <LeafIcon size={Math.round(size * 0.55)} color={t.onHerb} />
    </Box>
  );
}
