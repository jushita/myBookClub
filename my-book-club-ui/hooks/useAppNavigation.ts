import { useState } from "react";

type Screen = "home" | "clubs" | "search" | "library" | "profile" | "pick-next";
type EmailAuthMode = "signup" | "login";

export function useAppNavigation(setEmailAuthMode: (mode: EmailAuthMode) => void) {
  const [screen, setScreen] = useState<Screen>("home");

  const goToLogin = () => {
    setEmailAuthMode("login");
    setScreen("profile");
  };

  const goToSignup = () => {
    setEmailAuthMode("signup");
    setScreen("profile");
  };

  return {
    screen,
    setScreen,
    goToLogin,
    goToSignup,
  };
}
