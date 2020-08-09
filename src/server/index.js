const http = require('http');
const path = require('path');
const staticServer = require('node-static');
const sockjs = require('sockjs');
const { v4: uuid } = require('uuid');
const dogNames = require('dog-names');
const shuffle = require('knuth-shuffle-seeded');

const fileServer = new staticServer.Server(path.join(__dirname, '../../build'));

const sockjsOpts = {
  sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js',
  prefix: '/api',
  disable_cors: true
};

const baseDeck = [];
for (const suit of ['club', 'diamond', 'heart', 'spade']) {
  for (let value = 1; value <= 13; value++) {
    baseDeck.push({ suit, value });
  }
}

function canHandPlay (hand, playTotal) {
  for (let i = 0; i < hand.length; i++) {
    if (playTotal + Math.min(hand[i].value, 10) <= 31) {
      return true;
    }
  }

  return false;
}

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

function getScore (cards, cut, isCrib) {
  const isPegging = !cut;
  let flush = [];
  let nobs;
  if (isPegging) {
    const previousPlayIndex = cards.findIndex(({ lastCard }) => lastCard);
    if (previousPlayIndex === 0) {
      return 0;
    }

    cards = cards.slice(0, previousPlayIndex < 0 ? undefined : previousPlayIndex).map(({ card }) => card);
  } else {
    if (isCrib) {
      cards = cards.map(({ card }) => card);
    }

    const cardsWithCut = cards = [...cards, cut];
    const testSuit = (cards[0] || {}).suit;
    const isFlush = cards.every(({ suit }) => suit === testSuit);
    if (isFlush) {
      flush = cut.suit === testSuit ? cardsWithCut : isCrib ? [] : cards;
    }

    nobs = cards.find(({ suit, value }) => value === 11 && suit === cut.suit);
    cards = cardsWithCut;
  }

  const fifteens = isPegging ? 0 : getFifteens(cards);
  const runs = getRuns(cards, isPegging);
  const pairs = getPairs(cards, isPegging);

  return {
    durning: isPegging ? 'play' : 'count',
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
    cards
  };
}

const rooms = new Map();
const createRoom = (id = uuid()) => {
  const connectionMap = new Map();
  const userInfo = {};
  let roomTimeout;

  let deck = null;
  let hands = null;
  let cut = null;
  let crib = null;
  let play = null;
  let scores = [];
  let phase = 'pre-shuffle';
  let order = [];
  let cribOwner = null;
  let turn = null;
  let playTotal = 0;
  let goCount = 0;
  const settings = {
    contextMenuAsClick: false,
    autoGo: true,
    showScores: false
  };
  function resetPlay () {
    resetDeck();
    cribOwner = null;
    scores = [];
  }
  function resetDeck () {
    deck = [...baseDeck];
    crib = [];
    hands = {};
    play = [];
    cut = null;
    phase = 'pre-shuffle';
    turn = null;
    playTotal = 0;
    goCount = 0;

    sendState();
  }
  function shuffleDeck () {
    // TODO: Use better shuffle
    resetDeck();
    shuffle(deck);
    phase = 'shuffle';

    if (cribOwner === null) {
      cribOwner = 0;
    } else {
      cribOwner = (cribOwner + 1) % 4;
    }

    turn = (cribOwner + 1) % 4;
    let count = 5;
    let currentUser = 0;
    function deal () {
      if (currentUser === order.length) {
        currentUser = 0;
        count--;
      }

      if (count === 0) {
        phase = 'crib';
      } else {
        const user = order[(cribOwner + currentUser++ + 1) % 4];
        const card = deck.pop();
        hands[user] = (hands[user] || []);
        hands[user].push(card);

        setTimeout(deal, 450);
      }
      sendState();
    }
    deal();
  }
  resetPlay();

  function sendState () {
    const users = [...new Set(connectionMap.values())];

    const baseState = {
      hands: {},
      users: users,
      userInfo,
      order,
      cut,
      phase,
      play,
      crib: phase === 'count'
        ? { cards: crib.map(({ card }) => card), count: crib.length }
        : { count: crib.length },
      cribOwner: order[cribOwner] || null,
      turn: order[turn] || null,
      playTotal,
      scores,
      deck: deck.length,
      settings
    };

    for (const [conn, user] of connectionMap) {
      const state = { ...baseState, hands: {} };

      for (const [otherUser, hand] of Object.entries(hands)) {
        if (otherUser === user || phase === 'count') {
          state.hands[otherUser] = { cards: hand || [], count: (hand || []).length };
        } else {
          state.hands[otherUser] = { count: (hand || []).length };
        }
      }

      conn.write(JSON.stringify({ type: 'state', room: id, state }));
    }
  }

  function addScore (user, score) {
    if (!score.value) {
      return;
    }

    scores.push({ user, ...score });
  }

  const connect = (conn, joinMessage) => {
    const clientRoomId = joinMessage.clientRoomId;
    const user = joinMessage.user;

    const leaveRoom = () => {
      connectionMap.delete(conn);
      sendState();
      if (!connectionMap.size) {
        roomTimeout = setTimeout(() => {
          rooms.delete(id);
        }, 1000 * 60 * 60 * 24); // Clean the room up after a day
      }
    };

    connectionMap.set(conn, user);
    if (roomTimeout) {
      clearTimeout(roomTimeout);
      roomTimeout = undefined;
    }

    conn.on('close', leaveRoom);
    conn.on('data', message => {
      try {
        message = JSON.parse(message);
      } catch {}

      if (message.room !== id || phase === 'shuffle') {
        return;
      }

      if (message.type === 'leave') {
        leaveRoom();
      } else if (message.type === 'userInfo') {
        userInfo[user] = message.info;
        sendState();
      } else if (message.type === 'settings') {
        for (const [key, value] of Object.entries(message.settings)) {
          switch (key) {
            case 'contextMenuAsClick':
              settings.contextMenuAsClick = !!value;
              break;
            case 'autoGo':
              settings.autoGo = !!value;
              break;
            case 'showScores':
              settings.showScores = !!value;
              break;
            default:
              break;
          }
        }

        sendState();
      } else if (message.type === 'shuffle') {
        if (phase !== 'count') {
          if (cribOwner !== null) {
            cribOwner--;
          }
        }
        shuffleDeck();
      } else if (message.type === 'cut') {
        if (phase === 'cut') {
          phase = 'play';
          cut = deck.pop();
          if (cut.value === 11) {
            addScore(order[cribOwner], { value: 2, type: 'nobs', during: 'cut' });
          }
          sendState();
        }
      } else if (message.type === 'order') {
        const users = new Set(connectionMap.values());
        if (message.order.length !== 4 || message.order.some(u => !users.has(u) && !userInfo[u])) {
          return;
        }

        order = message.order;
        phase = 'pre-shuffle';
        resetPlay();
      } else if (message.type === 'play') {
        if (!order.includes(user) || (phase !== 'crib' && phase !== 'play')) {
          return;
        }
        if (phase === 'crib' && crib.some(c => c.user === user)) {
          return;
        }
        if (phase === 'play' && turn !== order.indexOf(user)) {
          return;
        }

        let card;
        const hand = hands[user] || [];
        if (phase === 'play' && message.go) {
          if (canHandPlay(hand, playTotal)) {
            return;
          }
        } else {
          for (let i = 0; i < hand.length; i++) {
            if (hand[i].suit === message.card.suit && hand[i].value === message.card.value) {
              card = hand[i];
              if (phase === 'crib') {
                crib.push({ card, user });
              } else if (phase === 'play') {
                if (playTotal + Math.min(hand[i].value, 10) > 31) {
                  return;
                }
                play.unshift({ card, user });
              }
              hand.splice(i, 1);
              break;
            }
          }

          if (!card) {
            return;
          }
        }

        if (phase === 'crib' && crib.length === 4) {
          phase = 'cut';
        } else if (phase === 'play') {
          let hasCard = false;

          turn = (turn + 1) % 4;

          for (const h of Object.values(hands)) {
            if (h && h.length) {
              hasCard = true;
            }
          }

          if (card) {
            goCount = 0;
            playTotal += Math.min(card.value, 10);

            addScore(user, getScore(play));

            if (playTotal === 15) {
              addScore(user, { value: 2, type: '15', during: 'play' });
            } else if (playTotal === 31) {
              (play[0] || {}).lastCard = true;
              addScore(user, { value: 2, type: '31', during: 'play' });
              playTotal = 0;
            } else if (!hasCard) {
              addScore(user, { value: 1, type: 'last-card', during: 'play' });
            }
          }

          if (!hasCard) {
            phase = 'count';
            for (const { card, user } of play) {
              hands[user].unshift(card);
            }
            for (let i = 1; i <= 4; i++) {
              const player = order[(cribOwner + i) % 4];
              addScore(player, getScore(hands[player], cut));
            }
            addScore(order[cribOwner], getScore(crib, cut, true));
          } else {
            if (!card) {
              goCount++;
              if (goCount === 4) {
                goCount = 0;
                (play[0] || {}).lastCard = true;
                const lastCardUser = (play[0] || {}).user;
                addScore(lastCardUser, { value: 1, type: 'last-card', during: 'play' });
                playTotal = 0;
              }
            }

            while (!canHandPlay(hands[order[turn]] || [], settings.autoGo ? playTotal : 0)) {
              turn = (turn + 1) % 4;
              goCount++;
              if (goCount === 4) {
                goCount = 0;
                (play[0] || {}).lastCard = true;
                const lastCardUser = (play[0] || {}).user;
                addScore(lastCardUser, { value: 1, type: 'last-card', during: 'play' });
                playTotal = 0;
              }
            }
          }
        }

        sendState();
      }
    });

    if (!userInfo[user]) {
      // This is ... not ideal
      let name = dogNames.allRandom();
      while (Object.keys(userInfo).length <= dogNames.length) {
        if (Object.values(userInfo).some(info => name === info.name)) {
          name = dogNames.allRandom();
        } else {
          break;
        }
      }
      if (Object.keys(userInfo).length > dogNames.length) {
        name = user;
      }
      userInfo[user] = { name };
    }

    if (order.length < 4 && !order.includes(user)) {
      order.push(user);
    }

    conn.write(JSON.stringify({ type: 'join', room: id, clientRoomId, user }));

    sendState();
  };

  rooms.set(id, connect);

  return connect;
};

const sockjsServer = sockjs.createServer(sockjsOpts);
sockjsServer.on('connection', conn => {
  conn.on('data', message => {
    try {
      message = JSON.parse(message);
    } catch {}

    if (message.type === 'join') {
      const connect = rooms.get(message.room) || createRoom(message.room);
      connect(conn, message);
    }
  });

  conn.on('close', () => {});
});

const server = http.createServer((request, response) => {
  request.addListener('end', () => {
    fileServer.serve(request, response);
  }).resume();
});
sockjsServer.installHandlers(server);
server.listen(process.env.PORT || 9999, '0.0.0.0');
