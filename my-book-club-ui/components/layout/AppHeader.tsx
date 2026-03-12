import React from "react";
import { Text, View } from "react-native";
import { appStyles } from "../../styles/appStyles";

type AppHeaderProps = {
  kicker: string;
  title?: string | null;
  subtitle?: string | null;
};

export function AppHeader({ kicker, title, subtitle }: AppHeaderProps) {
  return (
    <View style={appStyles.hero}>
      <View style={appStyles.topBar}>
        <View style={appStyles.titleGroup}>
          <Text style={appStyles.kicker}>{kicker}</Text>
          {title ? <Text style={appStyles.title}>{title}</Text> : null}
        </View>
      </View>
      {subtitle ? <Text style={appStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
