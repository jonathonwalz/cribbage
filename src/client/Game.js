import React from 'react';
import { RoomContext } from './Room';

import { Card } from './Card';

export function Game ({ user }) {
  const state = React.useContext(RoomContext);
  const { users, hands, dispatch, cut, deck } = state;

  return (
    <>
      <h2>Hand</h2>
      <ul className='hand'>
        {(((hands || {})[user] || {}).cards || []).map(card => (
          <li key={`${card.value}-${card.suit}`}>
            <Card {...card} />
          </li>
        ))}
      </ul>

      <h2>Cut</h2>
      {cut ? <Card {...cut} /> : null}

      <h2>Users</h2>
      <ul>
        {(users || []).map(otherUser => {
          const { cards, count } = (hands || {})[otherUser] || {};
          const handleClick = () => {
            dispatch({ type: 'deal', user: otherUser });
          };

          return (
            <li key={otherUser}>
              {user === otherUser ? '(You) ' : ''}{otherUser} ({cards ? cards.length : (count || 0)}) <button onClick={handleClick}>deal</button>
            </li>
          );
        })}
      </ul>
      <button onClick={() => dispatch({ type: 'cut' })}>cut</button>
      <button onClick={() => dispatch({ type: 'shuffle' })}>shuffle</button>
      <span>{deck} cards remaining</span>
    </>
  );
}
