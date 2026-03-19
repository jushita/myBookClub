import React from "react";
import { Pressable, Text, View } from "react-native";
import { appStyles } from "../../styles/appStyles";
import { Card } from "./Card";

type GuestAccessCardProps = {
  title: string;
  description: string;
  sectionTitle?: string;
  onSignIn: () => void;
  onSignUp: () => void;
};

export function GuestAccessCard({
  title,
  description,
  sectionTitle = "Get started",
  onSignIn,
  onSignUp,
}: GuestAccessCardProps) {
  return (
    <Card accent>
      <Text style={appStyles.sectionTitle}>{sectionTitle}</Text>
      <Text style={appStyles.clubName}>{title}</Text>
      <Text style={appStyles.bodyText}>{description}</Text>
      <View style={appStyles.authCtaRow}>
        <Pressable
          style={({ pressed }) => [
            appStyles.neuButton,
            appStyles.primaryButton,
            appStyles.authCtaButton,
            pressed ? appStyles.primaryButtonPressed : null,
          ]}
          onPress={onSignIn}
        >
          <Text style={appStyles.primaryButtonText}>Sign in</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            appStyles.secondaryButton,
            appStyles.authCtaButton,
            pressed ? appStyles.secondaryButtonPressed : null,
          ]}
          onPress={onSignUp}
        >
          <Text style={appStyles.secondaryButtonText}>Sign up</Text>
        </Pressable>
      </View>
    </Card>
  );
}
