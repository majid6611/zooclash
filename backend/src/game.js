export const ANIMALS = ['lion', 'tiger', 'elephant', 'giraffe', 'zebra'];
export const MAX_GUESSES = 10;

export function validateLayout(layout) {
  if (!Array.isArray(layout) || layout.length !== 5) return false;
  const sorted = [...layout].sort();
  const expected = [...ANIMALS].sort();
  return sorted.every((a, i) => a === expected[i]);
}

export function countCorrectPositions(guess, secret) {
  return guess.filter((animal, i) => animal === secret[i]).length;
}

export function calculateGuessScore(attemptsUsed) {
  return Math.max(0, 11 - attemptsUsed);
}

export function determineWinner(creator, joiner) {
  // creator/joiner: { guessed: bool, guessScore: int }
  if (creator.guessed && !joiner.guessed) {
    return { winner: 'creator', creatorPoints: 3, joinerPoints: 0 };
  }
  if (!creator.guessed && joiner.guessed) {
    return { winner: 'joiner', creatorPoints: 0, joinerPoints: 3 };
  }
  if (creator.guessed && joiner.guessed) {
    if (creator.guessScore > joiner.guessScore) {
      return { winner: 'creator', creatorPoints: 3, joinerPoints: 0 };
    }
    if (joiner.guessScore > creator.guessScore) {
      return { winner: 'joiner', creatorPoints: 0, joinerPoints: 3 };
    }
    return { winner: null, creatorPoints: 1, joinerPoints: 1 };
  }
  // Neither guessed correctly → draw
  return { winner: null, creatorPoints: 1, joinerPoints: 1 };
}
