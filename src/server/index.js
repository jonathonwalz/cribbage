const http = require('http');
const path = require('path');
const staticServer = require('node-static');
const sockjs = require('sockjs');
const { v4: uuid } = require('uuid');
const dogNames = require('dog-names');
const shuffle = require('knuth-shuffle-seeded');
const { getScore } = require('./score');

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

const gameModes = {
  4: {
    players: 4,
    teams: [[0, 2], [1, 3]],
    playerCribDiscards: [1, 1, 1, 1],
    dealToCrib: 0
  },
  '4-no-team': {
    players: 4,
    teams: [[0], [1], [2], [3]],
    playerCribDiscards: [1, 1, 1, 1],
    dealToCrib: 0
  },
  3: {
    players: 3,
    teams: [[0], [1], [2]],
    playerCribDiscards: [1, 1, 1],
    dealToCrib: 1
  },
  2: {
    players: 2,
    teams: [[0], [1]],
    playerCribDiscards: [2, 2],
    dealToCrib: 0
  }
};

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
  let gameMode = gameModes[4];
  const settings = {
    contextMenuAsClick: false,
    autoGo: true,
    showScores: false,
    gameMode: '4'
  };
  function resetPlay () {
    phase = 'pre-shuffle';
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
      cribOwner = (cribOwner + 1) % gameMode.players;
    }

    turn = (cribOwner + 1) % gameMode.players;
    const dealtRemaining = gameMode.playerCribDiscards.map(x => x + 4);
    let cribCount = gameMode.dealToCrib;
    let currentUser = cribOwner;
    function deal () {
      if (cribCount === 0 && dealtRemaining.every(c => c === 0)) {
        phase = 'crib';
      } else {
        if (!dealtRemaining.some(c => c)) {
          const card = deck.pop();
          crib.push({ card });
          cribCount--;
        } else {
          do {
            currentUser = (currentUser + 1) % gameMode.players;
          } while (!dealtRemaining[currentUser]);
          dealtRemaining[currentUser]--;

          const user = order[currentUser];
          const card = deck.pop();
          hands[user] = (hands[user] || []);
          hands[user].push(card);
        }
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
      settings,
      gameMode
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
            case 'gameMode':
              if (gameModes[value]) {
                settings.gameMode = value;
                gameMode = gameModes[value];
                if (gameMode.players < order.length) {
                  order = order.slice(0, gameMode.players);
                } else if (gameMode.players > order.length) {
                  for (const u of Object.keys(userInfo)) {
                    if (!order.includes(u)) {
                      order.push(u);
                      if (order.length === gameMode.players) {
                        break;
                      }
                    }
                  }
                }
                resetPlay();
              }
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
        if (message.order.length !== gameMode.players || message.order.some(u => !users.has(u) && !userInfo[u])) {
          return;
        }

        order = message.order;
        resetPlay();
      } else if (message.type === 'play') {
        const playerIndex = order.indexOf(user);
        if (playerIndex < 0 || (phase !== 'crib' && phase !== 'play')) {
          return;
        }
        if (phase === 'crib' && crib.reduce((a, c) => c.user === user ? a + 1 : a, 0) >= gameMode.playerCribDiscards[playerIndex]) {
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

          turn = (turn + 1) % gameMode.players;

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
            for (let i = 1; i <= gameMode.players; i++) {
              const player = order[(cribOwner + i) % gameMode.players];
              addScore(player, getScore(hands[player], cut));
            }
            addScore(order[cribOwner], getScore(crib, cut, true));
          } else {
            if (!card) {
              goCount++;
              if (goCount === gameMode.players) {
                goCount = 0;
                (play[0] || {}).lastCard = true;
                const lastCardUser = (play[0] || {}).user;
                addScore(lastCardUser, { value: 1, type: 'last-card', during: 'play' });
                playTotal = 0;
              }
            }

            while (!canHandPlay(hands[order[turn]] || [], settings.autoGo ? playTotal : 0)) {
              turn = (turn + 1) % gameMode.players;
              goCount++;
              if (goCount === gameMode.players) {
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

    if (order.length < gameMode.players && !order.includes(user)) {
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
