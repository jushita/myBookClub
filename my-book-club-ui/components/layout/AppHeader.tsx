import React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { appStyles } from "../../styles/appStyles";

type AppHeaderProps = {
  kicker: string;
  title?: string | null;
  subtitle?: string | null;
  onProfilePress?: () => void;
  profileActive?: boolean;
};

export function AppHeader({ kicker, title, subtitle, onProfilePress, profileActive = false }: AppHeaderProps) {
  return (
    <View style={appStyles.hero}>
      <View style={appStyles.topBar}>
        <View style={appStyles.titleGroup}>
          <Text style={appStyles.kicker}>{kicker}</Text>
          {title ? <Text style={appStyles.title}>{title}</Text> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          onPress={onProfilePress}
          style={({ pressed }) => [
            appStyles.headerProfileButton,
            profileActive ? appStyles.headerProfileButtonActive : null,
            pressed ? appStyles.headerProfileButtonPressed : null,
          ]}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Circle
              cx="12"
              cy="8"
              r="3.5"
              stroke={profileActive ? "#FFFFFF" : "rgba(255, 244, 255, 0.92)"}
              strokeWidth="1.8"
            />
            <Path
              d="M5.5 19C6.8 15.9 9.1 14.5 12 14.5C14.9 14.5 17.2 15.9 18.5 19"
              stroke={profileActive ? "#FFFFFF" : "rgba(255, 244, 255, 0.92)"}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
      {subtitle ? <Text style={appStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}
