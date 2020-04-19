import React from 'react';

import { SocketContext } from './Socket';
import { UserInfo } from './UserInfo';

const initialState = { joined: false, messages: [], people: {}, dispatch: () => {} };
function reducer (state, action) {
  switch (action.type) {
    case 'join':
      return { ...state, joined: true, dispatch: action.dispatch, user: action.user };
    case 'left':
      return { ...state, joined: false, dispatch: () => {} };
    case 'hand':
      return {
        ...state,
        hands: {
          ...state.hands,
          [action.user]: action
        }
      };
    case 'shuffle':
      return { ...state, hands: {} };
    case 'chat':
      return { ...state, messages: [...state.messages, action] };
    case 'users':
      return { ...state, users: action.users, userInfo: action.userInfo };
    case 'cut':
      return { ...state, cut: action.card };
    case 'phase':
      return { ...state, phase: action.phase };
    case 'play':
      return { ...state, play: action.cards };
    case 'crib':
      return { ...state, crib: action.cards || action.count };
    case 'deck':
      return { ...state, deck: action.deck };
    default:
      throw new Error('Missing action ' + action.type);
  }
}

export const RoomContext = React.createContext(initialState);

let roomIdCounter = 0;
export function Room ({ room, user, children }) {
  const { sendMessage, connected, subscribe, unsubscribe } = React.useContext(SocketContext);
  const [state, dispatch] = React.useReducer(reducer, initialState);

  React.useEffect(
    () => {
      let roomId;
      const clientRoomId = roomIdCounter++;

      const handler = message => {
        if (message.room !== roomId && message.clientRoomId !== clientRoomId) {
          return;
        }

        if (message.clientRoomId === clientRoomId && message.room && message.type === 'join') {
          roomId = message.room;
          dispatch({
            ...message,
            type: 'join',
            dispatch: message => sendMessage({
              ...message,
              room: roomId
            })
          });
        } else {
          dispatch(message);
        }
      };

      subscribe(handler);
      sendMessage({ type: 'join', clientRoomId, room, user });

      return () => {
        dispatch({ type: 'left' });
        unsubscribe(handler);
      };
    },
    [connected, room, sendMessage, subscribe, unsubscribe, user]
  );

  return (
    <RoomContext.Provider value={state} children={children}>
      <UserInfo />
      {children}
      <section className='debug'>
        <h2>Debug</h2>
        <pre>
          {JSON.stringify(state, null, 2)}
        </pre>
      </section>
    </RoomContext.Provider>
  );
}
