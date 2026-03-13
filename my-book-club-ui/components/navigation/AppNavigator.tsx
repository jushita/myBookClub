import React from "react";
import { ScrollView, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import type { AppScreenViews } from "../../types/screenModels";
import { NavButton } from "../common/NavButton";
import { ClubsScreen } from "../screens/ClubsScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { PickNextScreen } from "../screens/PickNextScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { SearchScreen } from "../screens/SearchScreen";

type Screen = "home" | "clubs" | "search" | "library" | "profile" | "pick-next";

type AppNavigatorProps = {
  screen: Screen;
  onScreenChange: (screen: Screen) => void;
  views: AppScreenViews;
};

export function AppNavigator({
  screen,
  onScreenChange,
  views,
}: AppNavigatorProps) {
  return (
    <>
      <ScrollView contentContainerStyle={appStyles.content}>
        {screen === "home" ? <HomeScreen {...views.home} /> : null}
        {screen === "clubs" ? <ClubsScreen {...views.clubs} /> : null}
        {screen === "search" ? <SearchScreen {...views.search} /> : null}
        {screen === "pick-next" ? <PickNextScreen {...views.pickNext} /> : null}
        {screen === "library" ? <LibraryScreen {...views.library} /> : null}
        {screen === "profile" ? <ProfileScreen {...views.profile} /> : null}
      </ScrollView>

      <View style={appStyles.bottomNav}>
        <NavButton icon="⌂" label="Home" active={screen === "home"} onPress={() => onScreenChange("home")} />
        <NavButton icon="◫" label="Clubs" active={screen === "clubs"} onPress={() => onScreenChange("clubs")} />
        <NavButton icon="⌕" label="Search" active={screen === "search"} onPress={() => onScreenChange("search")} />
        <NavButton icon="☰" label="Library" active={screen === "library"} onPress={() => onScreenChange("library")} />
        <NavButton icon="◌" label="Profile" active={screen === "profile"} onPress={() => onScreenChange("profile")} />
      </View>
    </>
  );
}
