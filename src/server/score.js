function getFifteens (cards, usedCards = [], startingIndex = 0, count = 0) {
  let fifteens = [];

  for (let i = startingIndex; i < cards.length; i++) {
    const card = cards[i];
    const newCount = count + Math.min(card.value, 10);
    if (newCount === 15) {
      fifteens.push([...usedCards, card]);
    } else if (newCount < 15) {
      fifteens = [...fifteens, ...getFifteens(cards, [...usedCards, card], i + 1, newCount)];
    }
  }

  return fifteens;
}

function getRuns (cards, isPegging = false) {
  if (cards.length < 3) {
    return [];
  }

  if (isPegging) {
    let longestRun;
    for (let i = 3; i < cards.length + 1; i++) {
      const sortedCards = cards.slice(0, i);
      sortedCards.sort(({ value: a }, { value: b }) => a - b);

      if (sortedCards[0].value + sortedCards.length - 1 !== sortedCards[sortedCards.length - 1].value) {
        continue;
      }

      let isNotARun = false;
      for (let j = 1; j < sortedCards.length; j++) {
        if (sortedCards[j - 1].value + 1 !== sortedCards[j].value) {
          isNotARun = true;
          break;
        }
      }

      if (!isNotARun) {
        longestRun = sortedCards;
      }
    }

    return longestRun ? [longestRun] : [];
  }

  const sortedCards = [...cards];
  sortedCards.sort(({ value: a }, { value: b }) => a - b);

  let runs = [];
  let currentRuns = [[]];
  for (let i = 0; i < sortedCards.length; i++) {
    const card = sortedCards[i];
    const value = card.value;
    const run = currentRuns[currentRuns.length - 1];
    const lastValue = (run[run.length - 1] || {}).value || -1;

    if (lastValue + 1 === value) {
      for (const run of currentRuns) {
        run.push(card);
      }
    } else {
      if (run.length >= 3) {
        runs = [...runs, ...currentRuns];
      }
      currentRuns = [[card]];
    }

    const runDuplicates = [];
    while (sortedCards[i + 1] && sortedCards[i + 1].value === value) {
      i++;
      runDuplicates.push(sortedCards[i]);
    }

    if (runDuplicates.length) {
      const currentRunCount = currentRuns.length;
      for (const card of runDuplicates) {
        for (let j = 0; j < currentRunCount; j++) {
          const duplicate = [...currentRuns[j]];
          duplicate[duplicate.length - 1] = card;
          currentRuns.push(duplicate);
        }
      }
    }
  }

  if (currentRuns[0].length >= 3) {
    runs = [...runs, ...currentRuns];
  }

  return runs;
}

const pairCountScores = { 1: 0, 2: 2, 3: 6, 4: 12 };
function getPairs (cards, isPegging = false) {
  if (cards.length < 2) {
    return {};
  }

  const cardCounts = { [cards[0].value]: [cards[0]] };
  for (let i = 1; i < cards.length; i++) {
    const card = cards[i];
    const value = card.value;
    if (!cardCounts[value]) {
      if (isPegging) {
        break;
      }

      cardCounts[value] = [card];
    } else {
      cardCounts[value].push(card);
    }
  }

  Object.entries(cardCounts).forEach(([value, cards]) => {
    const score = pairCountScores[cards.length];
    if (!score) {
      delete cardCounts[value];
    }
  });

  return cardCounts;
}

// "cards":[{"suit":"spade","value":6},{"suit":"spade","value":8},{"suit":"diamond","value":13},{"suit":"heart","value":10},{"suit":"spade","value":11}]}
// {"fifteens":[],"runs":[],"pairs":{},"flush":[],"nobs":{"suit":"spade","value":11}}
// jack flip give everyone nobs

function getScore (cards, cut, isCrib) {
  const isPegging = !cut;
  let flush = [];
  let nobs;
  let cardsToScore = cards;
  if (isPegging) {
    const previousPlayIndex = cards.findIndex(({ lastCard }) => lastCard);
    if (previousPlayIndex === 0) {
      return 0;
    }

    cardsToScore = cards.slice(0, previousPlayIndex < 0 ? undefined : previousPlayIndex).map(({ card }) => card);
  } else {
    if (isCrib) {
      cards = cards.map(({ card }) => card);
    }

    const cardsWithCut = [...cards, cut];
    const testSuit = (cards[0] || {}).suit;
    const isFlush = cards.every(({ suit }) => suit === testSuit);
    if (isFlush) {
      flush = cut.suit === testSuit ? cardsWithCut : isCrib ? [] : cards;
    }

    nobs = cards.find(({ suit, value }) => value === 11 && suit === cut.suit);
    cardsToScore = cardsWithCut;
  }

  const fifteens = isPegging ? [] : getFifteens(cardsToScore);
  const runs = getRuns(cardsToScore, isPegging);
  const pairs = getPairs(cardsToScore, isPegging);

  return {
    during: isPegging ? 'play' : 'count',
    value: (fifteens.length * 2) +
      runs.reduce((a, v) => a + v.length, 0) +
      Object.values(pairs).reduce((a, cards) => a + pairCountScores[cards.length], 0) +
      flush.length +
      (nobs ? 1 : 0),
    fifteens,
    runs,
    pairs,
    flush,
    nobs,
    isCrib,
    cards,
    cut
  };
}

module.exports = { getScore };
