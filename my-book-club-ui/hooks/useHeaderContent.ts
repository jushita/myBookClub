import { useMemo } from "react";
import type { AuthUser, Club } from "../types";

type Screen = "home" | "clubs" | "search" | "library" | "profile" | "pick-next";

export function useHeaderContent(screen: Screen, authUser: AuthUser | null, selectedClub?: Club) {
  return useMemo(() => {
    const isCompact = screen === "search" || screen === "library";

    return {
      kicker: isCompact || screen === "clubs" ? "My Book Club" : "AI-Powered Book Club",
      title: isCompact
        ? null
        : screen === "clubs"
          ? authUser
            ? selectedClub?.name || "My Book Club"
            : "Clubs"
          : screen === "pick-next"
            ? "Pick Next Book"
            : "My Book Club",
      subtitle: isCompact
        ? null
        : screen === "clubs"
          ? authUser
            ? `Currently tuned to ${selectedClub?.vibe.toLowerCase() || "your club mood"}.`
            : "Join a club, create a club, and unlock shared reading experiences."
          : screen === "pick-next"
            ? `Three ways to choose the next read for ${selectedClub?.name || "your club"}.`
            : "Discover standout reads, explore genre moods, and build a smarter shared shelf.",
    };
  }, [authUser, screen, selectedClub]);
}
