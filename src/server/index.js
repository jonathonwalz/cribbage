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

  let deck;
  let hands;
  let cut;
  let crib;
  let play;
  let phase;
  function shuffleDeck () {
    // TODO: Use better shuffle
    deck = [...baseDeck];
    crib = [];
    shuffle(deck);
    hands = {};
    play = [];
    cut = null;
    phase = 'shuffle';

    sendState();

    const users = [...new Set(connectionMap.values())];
    const toDeal = [];
    for (let i = 0; i < 5; i++) {
      toDeal.push([...users]);
    }

    function deal () {
      const round = toDeal.pop();

      function dealCards () {
        const user = round.pop();

        if (user) {
          const card = deck.pop();
          hands[user] = (hands[user] || []);
          hands[user].push(card);

          sendState();
          setTimeout(dealCards, 750);
        } else {
          setTimeout(deal, 750);
        }
      }

      if (round) {
        dealCards();
      } else {
        phase = 'crib';
        sendState();
      }
    }

    deal();
  }
  shuffleDeck();

  function sendState () {
    const users = [...new Set(connectionMap.values())];

    const baseState = {
      hands: {},
      users: users,
      userInfo,
      cut,
      phase,
      play,
      crib: phase === 'count' ? crib : crib.count,
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
        cut = deck.pop();
        sendState();
      } else if (message.type === 'play') {
        if (phase === 'crib' && crib.some(c => c.user === user)) {
          return;
        }

        const hand = hands[user] || [];
        let card;
        for (let i = 0; i < hand.length; i++) {
          if (hand[i].suit === message.card.suit && hand[i].value === message.card.value) {
            card = hand[i];
            hand.splice(i, 1);
            if (phase === 'crib') {
              crib.push({ card, user });
            } else if (phase === 'play') {
              play.unshift({ card, user });
            }
            break;
          }
        }

        if (!card) {
          return;
        }

        if (phase === 'crib' && crib.length === 4) {
          phase = 'play';
        } else if (phase === 'play') {
          let hasCard = false;
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
        if (Object.values(userInfo).some(info => name === info)) {
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
