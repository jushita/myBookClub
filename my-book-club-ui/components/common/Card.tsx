import React from "react";
import { View } from "react-native";
import { appStyles } from "../../styles/appStyles";

type CardProps = {
  children: React.ReactNode;
  accent?: boolean;
};

export function Card({ children, accent = false }: CardProps) {
  return <View style={[appStyles.card, accent ? appStyles.cardAccent : null]}>{children}</View>;
}
