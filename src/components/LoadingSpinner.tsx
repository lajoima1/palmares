import React from "react";
import { Box, Typography } from "@mui/material";
import { styled, keyframes } from "@mui/material/styles";

const spin = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const SpinnerContainer = styled(Box)(({ theme }) => ({
  width: "80px",
  height: "80px",
  border: `4px solid ${
    theme.palette.mode === "dark"
      ? "rgba(255, 255, 255, 0.08)"
      : "rgba(0, 0, 0, 0.08)"
  }`,
  borderLeft: `4px solid ${theme.palette.primary.main}`,
  borderRadius: "50%",
  animation: `${spin} 1.5s linear infinite`,
  position: "relative",
  "&::after": {
    content: '""',
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "40px",
    height: "40px",
    backgroundImage: `url('${import.meta.env.BASE_URL || "/"}squared-garlic-64x64.webp')`,
    backgroundSize: "contain",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
}));

interface LoadingSpinnerProps {
  title?: string;
  subtitle?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  title = "Palmarès",
  subtitle = "Loading recipes...",
}) => {
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      flexDirection="column"
      gap={3}
    >
      <SpinnerContainer />
      <Box textAlign="center">
        <Typography
          variant="h5"
          component="h1"
          sx={{
            fontWeight: 600,
            margin: 0,
            marginBottom: 1,
            color: "primary.main",
          }}
        >
          {title}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            margin: 0,
            color: "text.secondary",
          }}
        >
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
};
