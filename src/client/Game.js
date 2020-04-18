import React from 'react';
import { RoomContext } from './Room';

import { Card } from './Card';

function cardToText ({ value }) {
  switch (value) {
    case 11:
      return 'jack';
    case 12:
      return 'queen';
    case 13:
      return 'king';
    default:
      return value;
  }
}

export function Game ({ user }) {
  const state = React.useContext(RoomContext);
  const { users, userInfo, hands, dispatch, cut, crib, deck, phase, play } = state;
  const hand = (((hands || {})[user] || {}).cards || []);

  const [selectedCardState, setSelectedCard] = React.useState();
  const handleChange = React.useCallback(
    ({ target: { value } }) => {
      if (!value) {
        setSelectedCard(undefined);
      } else {
        const [v, s] = value.split('-');
        setSelectedCard({ key: value, value: parseInt(v, 10), suit: s });
      }
    },
    []
  );
  let selectedCard;
  if (selectedCardState) {
    for (let i = 0; i < hand.length; i++) {
      if (hand[i].value === selectedCardState.value && hand[i].suit === selectedCardState.suit) {
        selectedCard = selectedCardState;
        break;
      }
    }
  }

  return (
    <>
      <label>
        Your name:{' '}
        <input
          type='text'
          value={((userInfo || {})[user] || {}).name || ''}
          placeholder={user}
          onChange={({ target: { value } }) => dispatch({ type: 'userInfo', info: { name: value } })}
        />
      </label>

      <h2>Hand</h2>
      <ul className='hand'>
        {hand.map(card => {
          const key = `${card.value}-${card.suit}`;

          return (
            <li key={key}>
              <label>
                <input type='radio' name='card' value={key} onChange={handleChange} checked={selectedCard ? selectedCard.key === key : false} />
                <Card suit={card.suit} value={card.value} />
              </label>
            </li>
          );
        })}
      </ul>
      {!selectedCard ? null : (
        <button
          disabled={phase === 'crib' ? hand.length <= 4 : hands.length === 0}
          className='play'
          onClick={() => dispatch({ type: 'play', card: selectedCard })}
        >
          {phase === 'crib' ? 'Put' : 'Play'} {cardToText(selectedCard)} of {selectedCard.suit}s {phase === 'crib' ? 'in crib' : ''}
        </button>
      )}

      <h2>Cut</h2>
      {cut ? <Card {...cut} /> : null}

      <h2>Crib</h2>
      {Array.isArray(crib) ? (
        <ul className='hand'>
          {crib.map(({ card }) => (
            <li key={`${card.value}-${card.suit}`}><Card suit={card.suit} value={card.value} /></li>
          ))}
        </ul>
      ) : `${crib || 0} cards in crib.`}

      <h2>Play</h2>
      {Array.isArray(play) ? (
        <ul className='hand'>
          {play.map(({ card }) => (
            <li key={`${card.value}-${card.suit}`}><Card suit={card.suit} value={card.value} /></li>
          ))}
        </ul>
      ) : null}

      <h2>Users</h2>
      <ul>
        {(users || []).map(otherUser => {
          const { cards, count } = (hands || {})[otherUser] || {};
          const { name } = (userInfo || {})[otherUser] || {};
          const handleClick = () => {
            dispatch({ type: 'deal', user: otherUser });
          };

          return (
            <li key={otherUser}>
              {user === otherUser ? '(You) ' : ''}{name ? `${name} (${otherUser})` : otherUser} ({cards ? cards.length : (count || 0)}) <button onClick={handleClick}>deal</button>
            </li>
          );
        })}
      </ul>
      <button onClick={() => dispatch({ type: 'cut' })}>cut</button>
      <button onClick={() => dispatch({ type: 'shuffle' })}>shuffle</button>
      <span>{deck} cards remaining</span>

      <h2>Debug</h2>
      <pre>
        {JSON.stringify(state, null, 2)}
      </pre>
    </>
  );
}
