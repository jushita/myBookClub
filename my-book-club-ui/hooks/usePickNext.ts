import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing } from "react-native";
import { WheelEngine } from "../domain/WheelEngine";
import type { Book, Club, Recommendation } from "../types";

type PickMode = "randomizer" | "wheel" | "ai";

export function usePickNext(
  selectedClub: Club | undefined,
  _selectedClubMembersCount: number,
  guestLibraryBooks: Book[],
  favoriteBooks: Book[],
  authUser: unknown,
  aiRecommendations: Recommendation[],
  wheelEngine: WheelEngine
) {
  const [pickMode, setPickMode] = useState<PickMode>("ai");
  const [aiPickerPrompt, setAiPickerPrompt] = useState("");
  const [aiPickerGenerated, setAiPickerGenerated] = useState(false);
  const [wheelBookInput, setWheelBookInput] = useState("");
  const [wheelBooks, setWheelBooks] = useState<string[]>([]);
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelWinnerIndex, setWheelWinnerIndex] = useState<number | null>(null);
  const [wheelSpinTarget, setWheelSpinTarget] = useState(360 * 5);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [randomizerResult, setRandomizerResult] = useState<Book | null>(null);
  const [randomizerRunCount, setRandomizerRunCount] = useState(0);
  const wheelSpin = useRef(new Animated.Value(0)).current;

  const randomizerPool = useMemo(() => {
    if (authUser && favoriteBooks.length > 0) {
      return favoriteBooks;
    }

    return guestLibraryBooks;
  }, [authUser, favoriteBooks, guestLibraryBooks]);

  const maxWheelBooks = 7;
  const wheelRotation = wheelSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${wheelSpinTarget}deg`],
  });
  const wheelSlices = useMemo(() => wheelEngine.buildSlices(wheelBooks), [wheelBooks, wheelEngine]);
  const defaultWheelSlices = useMemo(() => wheelEngine.buildDefaultSlices(), [wheelEngine]);

  useEffect(() => {
    if (!selectedClub) {
      return;
    }

    setAiPickerGenerated(false);
    setRandomizerResult(null);
    setRandomizerRunCount(0);
    setWheelBookInput("");
    setWheelBooks([]);
    setWheelResult(null);
    setWheelWinnerIndex(null);
    setWheelSpinTarget(360 * 5);
    wheelSpin.stopAnimation();
    wheelSpin.setValue(0);
  }, [selectedClub, wheelSpin]);

  const generateAiPick = () => {
    setAiPickerGenerated(true);
  };

  const updateAiPrompt = (value: string) => {
    setAiPickerPrompt(value);
    setAiPickerGenerated(false);
  };

  const runRandomizer = () => {
    if (randomizerPool.length === 0) {
      Alert.alert("No books to randomize", "Add or load books before running the randomizer.");
      return;
    }

    const pickedBook = randomizerPool[Math.floor(Math.random() * randomizerPool.length)];
    setRandomizerResult(pickedBook);
    setRandomizerRunCount((count) => count + 1);
  };

  const addWheelBook = () => {
    const trimmed = wheelBookInput.trim();

    if (!trimmed) {
      Alert.alert("Book name required", "Enter a book title to add it to the wheel.");
      return;
    }

    if (wheelBooks.length >= maxWheelBooks) {
      Alert.alert("Wheel is full", `You can add up to ${maxWheelBooks} books for this club.`);
      return;
    }

    if (wheelBooks.some((book) => book.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Already added", "That book is already on the wheel.");
      return;
    }

    setWheelBooks((current) => [...current, trimmed]);
    setWheelBookInput("");
    setWheelResult(null);
    setWheelWinnerIndex(null);
  };

  const removeWheelBook = (bookToRemove: string) => {
    if (wheelSpinning) {
      return;
    }

    setWheelBooks((current) => current.filter((book) => book !== bookToRemove));
    setWheelResult((current) => (current === bookToRemove ? null : current));
    setWheelWinnerIndex(null);
  };

  const spinWheel = () => {
    if (wheelBooks.length < 2 || wheelSpinning) {
      return;
    }

    const { winningBook, winningIndex, spinTarget } = wheelEngine.calculateSpinResult(wheelBooks);

    setWheelSpinning(true);
    setWheelResult(null);
    setWheelWinnerIndex(null);
    setWheelSpinTarget(spinTarget);
    wheelSpin.setValue(0);

    Animated.timing(wheelSpin, {
      toValue: 1,
      duration: 3600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        setWheelSpinning(false);
        return;
      }

      setWheelWinnerIndex(winningIndex);
      setWheelResult(winningBook);
      setWheelSpinning(false);
    });
  };

  return {
    pickMode,
    aiPickerPrompt,
    aiPickerGenerated,
    wheelBookInput,
    wheelBooks,
    wheelResult,
    wheelWinnerIndex,
    wheelSpinning,
    randomizerResult,
    randomizerRunCount,
    randomizerPool,
    maxWheelBooks,
    wheelRotation,
    wheelSlices,
    defaultWheelSlices,
    aiPreviewRecommendations: aiRecommendations,
    setPickMode,
    setWheelBookInput,
    updateAiPrompt,
    generateAiPick,
    runRandomizer,
    addWheelBook,
    removeWheelBook,
    spinWheel,
  };
}
