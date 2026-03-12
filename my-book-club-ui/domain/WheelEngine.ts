export type WheelSlice = {
  index: number;
  book: string;
  path: string;
  fill: string;
  label: {
    x: number;
    y: number;
    rotation: number;
  };
  labelLines: string[];
};

export type DefaultWheelSlice = {
  path: string;
  fill: string;
};

export class WheelEngine {
  static readonly SIZE = 280;
  static readonly RADIUS = 126;
  static readonly CENTER = WheelEngine.SIZE / 2;
  private readonly colors = [
    "rgba(255, 175, 92, 0.92)",
    "rgba(255, 255, 255, 0.28)",
    "rgba(252, 145, 94, 0.9)",
    "rgba(210, 170, 255, 0.34)",
    "rgba(255, 211, 137, 0.9)",
    "rgba(255, 255, 255, 0.22)",
  ];

  buildSlices(books: string[]): WheelSlice[] {
    if (books.length === 0) {
      return [];
    }

    const segmentAngle = 360 / books.length;

    return books.map((book, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      return {
        index,
        book,
        path: this.describeSlice(startAngle, endAngle),
        fill: this.colors[index % this.colors.length],
        label: this.getLabelPosition(index, books.length),
        labelLines: this.formatLabel(book),
      };
    });
  }

  buildDefaultSlices(): DefaultWheelSlice[] {
    const count = 3;
    const segmentAngle = 360 / count;

    return Array.from({ length: count }, (_, index) => {
      const startAngle = index * segmentAngle;
      const endAngle = startAngle + segmentAngle;

      return {
        path: this.describeSlice(startAngle, endAngle),
        fill:
          index === 0
            ? "rgba(255, 183, 111, 0.34)"
            : index === 1
              ? "rgba(255, 255, 255, 0.16)"
              : "rgba(231, 177, 255, 0.22)",
      };
    });
  }

  calculateSpinResult(books: string[]) {
    const winningIndex = Math.floor(Math.random() * books.length);
    const segmentAngle = 360 / books.length;
    const winningCenterAngle = winningIndex * segmentAngle + segmentAngle / 2;
    const spinTarget = 360 * 6 + (((360 - winningCenterAngle) % 360) + 360) % 360;

    return {
      winningIndex,
      winningBook: books[winningIndex],
      spinTarget,
    };
  }

  getBoundaryPoint(index: number, sliceCount: number) {
    const segmentAngle = 360 / sliceCount;
    return this.polarToCartesian(WheelEngine.CENTER, WheelEngine.CENTER, WheelEngine.RADIUS, index * segmentAngle);
  }

  private polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  }

  private describeSlice(startAngle: number, endAngle: number) {
    const start = this.polarToCartesian(WheelEngine.CENTER, WheelEngine.CENTER, WheelEngine.RADIUS, endAngle);
    const end = this.polarToCartesian(WheelEngine.CENTER, WheelEngine.CENTER, WheelEngine.RADIUS, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      `M ${WheelEngine.CENTER} ${WheelEngine.CENTER}`,
      `L ${start.x} ${start.y}`,
      `A ${WheelEngine.RADIUS} ${WheelEngine.RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
      "Z",
    ].join(" ");
  }

  private getLabelPosition(index: number, count: number) {
    const segmentAngle = 360 / count;
    const angle = index * segmentAngle + segmentAngle / 2;
    const point = this.polarToCartesian(
      WheelEngine.CENTER,
      WheelEngine.CENTER,
      WheelEngine.RADIUS * 0.66,
      angle
    );

    return {
      x: point.x,
      y: point.y,
      rotation: angle,
    };
  }

  private formatLabel(book: string) {
    if (book.length <= 14) {
      return [book];
    }

    const words = book.split(" ");
    if (words.length === 1) {
      return [`${book.slice(0, 14)}…`];
    }

    const midpoint = Math.ceil(words.length / 2);
    const first = words.slice(0, midpoint).join(" ");
    const second = words.slice(midpoint).join(" ");

    return [
      first.length > 14 ? `${first.slice(0, 14)}…` : first,
      second.length > 14 ? `${second.slice(0, 14)}…` : second,
    ];
  }
}
