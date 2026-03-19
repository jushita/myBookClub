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
  wheelEngine: WheelEngine,
  onSearchBooks?: (query: string) => Promise<Book[]>
) {
  const [pickMode, setPickMode] = useState<PickMode>("ai");
  const [aiPickerPrompt, setAiPickerPrompt] = useState("");
  const [aiPickerGenerated, setAiPickerGenerated] = useState(false);
  const [wheelBookInput, setWheelBookInput] = useState("");
  const [wheelBooks, setWheelBooks] = useState<Book[]>([]);
  const [wheelSearchResults, setWheelSearchResults] = useState<Book[]>([]);
  const [selectedWheelBookId, setSelectedWheelBookId] = useState<string | null>(null);
  const [wheelResult, setWheelResult] = useState<Book | null>(null);
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
  const wheelBookTitles = useMemo(() => wheelBooks.map((book) => book.title), [wheelBooks]);
  const wheelSlices = useMemo(() => wheelEngine.buildSlices(wheelBookTitles), [wheelBookTitles, wheelEngine]);
  const defaultWheelSlices = useMemo(() => wheelEngine.buildDefaultSlices(), [wheelEngine]);
  const selectedWheelBook = useMemo(
    () => wheelSearchResults.find((book) => book.id === selectedWheelBookId) ?? null,
    [selectedWheelBookId, wheelSearchResults]
  );

  useEffect(() => {
    if (!selectedClub) {
      return;
    }

    setAiPickerGenerated(false);
    setRandomizerResult(null);
    setRandomizerRunCount(0);
    setWheelBookInput("");
    setWheelBooks([]);
    setWheelSearchResults([]);
    setSelectedWheelBookId(null);
    setWheelResult(null);
    setWheelWinnerIndex(null);
    setWheelSpinTarget(360 * 5);
    wheelSpin.stopAnimation();
    wheelSpin.setValue(0);
  }, [selectedClub, wheelSpin]);

  useEffect(() => {
    const trimmed = wheelBookInput.trim();
    if (!trimmed) {
      setWheelSearchResults([]);
      setSelectedWheelBookId(null);
      return;
    }

    let ignore = false;

    const runSearch = async () => {
      try {
        const books = await onSearchBooks?.(trimmed);
        if (ignore) {
          return;
        }

        setWheelSearchResults(books ?? []);
        setSelectedWheelBookId((current) => {
          if (!current) {
            return null;
          }

          return (books ?? []).some((book) => book.id === current) ? current : null;
        });
      } catch {
        if (!ignore) {
          setWheelSearchResults([]);
          setSelectedWheelBookId(null);
        }
      }
    };

    void runSearch();

    return () => {
      ignore = true;
    };
  }, [onSearchBooks, wheelBookInput]);

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
    if (!wheelBookInput.trim()) {
      Alert.alert("Book search required", "Search for a book and select a result to add it to the wheel.");
      return;
    }

    if (wheelBooks.length >= maxWheelBooks) {
      Alert.alert("Wheel is full", `You can add up to ${maxWheelBooks} books for this club.`);
      return;
    }

    if (!selectedWheelBook) {
      Alert.alert("Select a book", "Tap one of the search results before adding it to the wheel.");
      return;
    }

    if (wheelBooks.some((book) => book.id === selectedWheelBook.id)) {
      Alert.alert("Already added", "That book is already on the wheel.");
      return;
    }

    setWheelBooks((current) => [...current, selectedWheelBook]);
    setWheelBookInput("");
    setWheelSearchResults([]);
    setSelectedWheelBookId(null);
    setWheelResult(null);
    setWheelWinnerIndex(null);
  };

  const removeWheelBook = (bookIdToRemove: string) => {
    if (wheelSpinning) {
      return;
    }

    setWheelBooks((current) => current.filter((book) => book.id !== bookIdToRemove));
    setWheelResult((current) => (current?.id === bookIdToRemove ? null : current));
    setWheelWinnerIndex(null);
  };

  const spinWheel = () => {
    if (wheelBooks.length < 2 || wheelSpinning) {
      return;
    }

    const { winningIndex, spinTarget } = wheelEngine.calculateSpinResult(wheelBookTitles);

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
      setWheelResult(wheelBooks[winningIndex] ?? null);
      setWheelSpinning(false);
    });
  };

  return {
    pickMode,
    aiPickerPrompt,
    aiPickerGenerated,
    wheelBookInput,
    wheelBooks,
    wheelSearchResults,
    selectedWheelBookId,
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
    setSelectedWheelBookId,
    updateAiPrompt,
    generateAiPick,
    runRandomizer,
    addWheelBook,
    removeWheelBook,
    spinWheel,
  };
}
