import React from "react";
import { Pressable, Text } from "react-native";
import { appStyles } from "../../styles/appStyles";

type NavButtonProps = {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

export function NavButton({ icon, label, active, onPress }: NavButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        appStyles.navButton,
        active ? appStyles.navButtonActive : null,
        pressed ? appStyles.navButtonPressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={[appStyles.navIcon, active ? appStyles.navIconActive : null]}>{icon}</Text>
      <Text style={[appStyles.navLabel, active ? appStyles.navLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}
