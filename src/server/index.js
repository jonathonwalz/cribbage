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
  let phase = 'pre-shuffle';
  let order = [];
  let cribOwner = null;
  let turn = null;
  let playTotal = 0;
  let goCount = 0;
  function resetDeck () {
    deck = [...baseDeck];
    crib = [];
    hands = {};
    play = [];
    cut = null;
    phase = 'pre-shuffle';

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
    turn = cribOwner + 1;
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

        setTimeout(deal, 750);
      }
      sendState();
    }
    deal();
  }
  resetDeck();

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
      cribOwner: order[cribOwner],
      turn: order[turn],
      playTotal,
      deck: deck.length
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
      } else if (message.type === 'shuffle') {
        shuffleDeck();
      } else if (message.type === 'cut') {
        if (phase === 'cut') {
          phase = 'play';
          cut = deck.pop();
          sendState();
        }
      } else if (message.type === 'order') {
        const users = new Set(connectionMap.values());
        if (message.order.length !== 4 || message.order.some(u => !users.has(u))) {
          return;
        }

        order = message.order;
        phase = 'pre-shuffle';
        resetDeck();
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

        const hand = hands[user] || [];
        if (phase === 'play' && message.go) {
          for (let i = 0; i < hand.length; i++) {
            if (playTotal + Math.min(hand[i].value, 10) <= 31) {
              return;
            }
          }

          turn = (turn + 1) % 4;
          goCount++;
          if (goCount === 4) {
            goCount = 0;
            playTotal = 0;
          }
          sendState();
          return;
        }

        let card;
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

        if (phase === 'crib' && crib.length === 4) {
          phase = 'cut';
        } else if (phase === 'play') {
          let hasCard = false;

          turn = (turn + 1) % 4;
          goCount = 0;
          playTotal += Math.min(card.value, 10);
          if (playTotal === 31) {
            playTotal = 0;
          }

          for (const h of Object.values(hands)) {
            if (h && h.length) {
              hasCard = true;
            }
          }
          if (!hasCard) {
            phase = 'count';
            for (const { card, user } of play) {
              hands[user].unshift(card);
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
