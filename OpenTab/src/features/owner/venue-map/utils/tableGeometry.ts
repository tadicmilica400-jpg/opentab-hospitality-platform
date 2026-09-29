// Autor: Boško Trifunović ([student ID omitted]) - SSU16-20
import type { TableShape } from "../../../../entities/venue-map/venueMap.types";

type ChairPosition = {
  left: string;
  top: string;
};

export function getTableDimensions(shape: TableShape) {
  if (shape === "rectangle") {
    return {
      width: 110,
      height: 70,
    };
  }

  return {
    width: 80,
    height: 80,
  };
}

export function getPreviewTableDimensions(shape: TableShape) {
  if (shape === "rectangle") {
    return {
      width: 120,
      height: 80,
    };
  }

  return {
    width: 96,
    height: 96,
  };
}

export function getChairPositions(shape: TableShape, count: number, preview = false): ChairPosition[] {
  const safeCount = Math.max(1, Math.min(12, count));
  const positions: ChairPosition[] = [];

  if (shape === "round") {
    const radius = preview ? 48 : 40;
    const chairDistance = radius + (preview ? 12 : 10);

    for (let index = 0; index < safeCount; index += 1) {
      const angle = (index / safeCount) * 2 * Math.PI - Math.PI / 2;
      const x = 50 + (chairDistance / radius) * 50 * Math.cos(angle);
      const y = 50 + (chairDistance / radius) * 50 * Math.sin(angle);

      positions.push({
        left: `${x}%`,
        top: `${y}%`,
      });
    }

    return positions;
  }

  if (shape === "square") {
    const sideLength = preview ? 96 : 80;
    const chairOffset = preview ? 15 : 12;
    const perSide = Math.ceil(safeCount / 4);
    let placed = 0;

    const sides = [
      { axis: "x", baseX: "50%", baseY: `-${chairOffset}px` },
      { axis: "x", baseX: "50%", baseY: `calc(100% + ${chairOffset}px)` },
      { axis: "y", baseX: `-${chairOffset}px`, baseY: "50%" },
      { axis: "y", baseX: `calc(100% + ${chairOffset}px)`, baseY: "50%" },
    ];

    sides.forEach((side) => {
      let currentSideCount = perSide;

      if (safeCount === 6) {
        currentSideCount = side.axis === "y" ? 1 : 2;
      }

      if (safeCount === 10) {
        currentSideCount = side.axis === "y" ? 2 : 3;
      }

      for (let index = 0; index < currentSideCount && placed < safeCount; index += 1) {
        const offset = (index - (currentSideCount - 1) / 2) * (sideLength / Math.max(1, currentSideCount));

        positions.push({
          left: side.axis === "x" ? `calc(50% + ${offset}px)` : side.baseX,
          top: side.axis === "y" ? `calc(50% + ${offset}px)` : side.baseY,
        });

        placed += 1;
      }
    });

    return positions;
  }

  const width = preview ? 120 : 110;
  const height = preview ? 80 : 70;
  const chairOffset = preview ? 15 : 12;
  const sideCount = safeCount >= 8 ? 2 : safeCount >= 4 ? 1 : 0;
  const remainingLongSideSeats = safeCount - sideCount * 2;
  const topCount = Math.ceil(remainingLongSideSeats / 2);
  const bottomCount = Math.floor(remainingLongSideSeats / 2);

  const addHorizontalChairs = (count: number, top: string) => {
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1 ? 0 : (index - (count - 1) / 2) * (width / count);

      positions.push({
        left: `calc(50% + ${offset}px)`,
        top,
      });
    }
  };

  const addVerticalChairs = (count: number, left: string) => {
    for (let index = 0; index < count; index += 1) {
      const offset = count === 1 ? 0 : (index - (count - 1) / 2) * (height / count);

      positions.push({
        left,
        top: `calc(50% + ${offset}px)`,
      });
    }
  };

  addHorizontalChairs(topCount, `-${chairOffset}px`);
  addHorizontalChairs(bottomCount, `calc(100% + ${chairOffset}px)`);
  addVerticalChairs(sideCount, `-${chairOffset}px`);
  addVerticalChairs(sideCount, `calc(100% + ${chairOffset}px)`);

  return positions.slice(0, safeCount);
}