module.exports = {
  preset: "react-native",
  testMatch: ["**/*.test.tsx"],
  collectCoverageFrom: [
    "components/**/*.tsx",
    "!components/**/*.test.tsx",
  ],
};
