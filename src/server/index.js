const http = require('http');
const path = require('path');
const staticServer = require('node-static');
const sockjs = require('sockjs');
const { v4: uuid } = require('uuid');
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
  let roomTimeout;

  let deck;
  let hands;
  let cut;
  function shuffleDeck () {
    // TODO: Use better shuffle
    deck = [...baseDeck];
    shuffle(deck);
    hands = {};
    cut = null;
  }
  shuffleDeck();

  const connect = (conn, joinMessage) => {
    const clientRoomId = joinMessage.clientRoomId;
    const user = joinMessage.user;

    const leaveRoom = () => {
      connectionMap.delete(conn);
      const users = [...new Set(connectionMap.values())];
      for (const [otherConn] of connectionMap) {
        otherConn.write(JSON.stringify({ type: 'users', users, room: id }));
      }
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

      if (message.room !== id) {
        return;
      }

      if (message.type === 'leave') {
        leaveRoom();
      } else if (message.type === 'chat') {
        const data = JSON.stringify({ type: 'chat', text: message.text, from: user, room: id });
        for (const [otherConn] of connectionMap) {
          otherConn.write(data);
        }
      } else if (message.type === 'shuffle') {
        shuffleDeck();
        for (const [otherConn] of connectionMap) {
          otherConn.write(JSON.stringify({ type: 'shuffle', room: id }));
          otherConn.write(JSON.stringify({ type: 'deck', room: id, deck: deck.length }));
          otherConn.write(JSON.stringify({ type: 'cut', room: id, card: cut }));
        }
      } else if (message.type === 'cut') {
        cut = deck.pop();
        for (const [otherConn] of connectionMap) {
          otherConn.write(JSON.stringify({ type: 'cut', room: id, card: cut }));
          otherConn.write(JSON.stringify({ type: 'deck', room: id, deck: deck.length }));
        }
      } else if (message.type === 'deal') {
        const card = deck.pop();
        hands[message.user] = (hands[message.user] || []);
        hands[message.user].push(card);

        for (const [otherConn, otherUser] of connectionMap) {
          if (otherUser === message.user) {
            otherConn.write(JSON.stringify({ type: 'hand', user: message.user, cards: hands[message.user] || [], room: id }));
          } else {
            otherConn.write(JSON.stringify({ type: 'hand', user: message.user, count: (hands[message.user] || []).length, room: id }));
          }
          otherConn.write(JSON.stringify({ type: 'deck', room: id, deck: deck.length }));
        }
      }
    });

    conn.write(JSON.stringify({ type: 'join', room: id, clientRoomId }));
    const users = [...new Set(connectionMap.values())];
    for (const [otherConn] of connectionMap) {
      otherConn.write(JSON.stringify({ type: 'users', users, room: id }));
      otherConn.write(JSON.stringify({ type: 'deck', room: id, deck: deck.length }));
    }
    conn.write(JSON.stringify({ type: 'cut', room: id, card: cut }));
    for (const [, otherUser] of connectionMap) {
      if (otherUser === user) {
        conn.write(JSON.stringify({ type: 'hand', user: otherUser, cards: hands[otherUser] || [], room: id }));
      } else {
        conn.write(JSON.stringify({ type: 'hand', user: otherUser, count: (hands[otherUser] || []).length, room: id }));
      }
    }
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
