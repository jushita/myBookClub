import React from "react";
import { Text, View } from "react-native";
import { appStyles } from "../../styles/appStyles";

type StatProps = {
  label: string;
  value: string;
};

export function Stat({ label, value }: StatProps) {
  return (
    <View style={appStyles.statCard}>
      <Text style={appStyles.statValue}>{value}</Text>
      <Text style={appStyles.statLabel}>{label}</Text>
    </View>
  );
}
