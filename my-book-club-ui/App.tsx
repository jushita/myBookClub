import React from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { AppHeader } from "./components/layout/AppHeader";
import { AppNavigator } from "./components/navigation/AppNavigator";
import { useBookClubApp } from "./hooks/useBookClubApp";
import { appStyles } from "./styles/appStyles";

export default function App() {
  const { header, navigation, views } = useBookClubApp();

  return (
    <SafeAreaProvider>
      <SafeAreaView style={appStyles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={appStyles.appShell}>
          <AppHeader kicker={header.kicker} title={header.title} subtitle={header.subtitle} />
          <AppNavigator screen={navigation.screen} onScreenChange={navigation.setScreen} views={views} />
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
