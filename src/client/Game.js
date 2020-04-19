import React from 'react';
import { RoomContext } from './Room';

import { Cards, useRadioCards } from './Cards';
import { Card, MiniCard } from './Card';

export function Game ({ user }) {
  const state = React.useContext(RoomContext);
  const { users, userInfo, hands, dispatch, cut, crib, deck, phase, play } = state;
  const hand = ((hands || {})[user] || {}).cards || [];
  const [selectedCard, handleChange] = useRadioCards(hand);

  // TODO: This should be done on the server
  const cribMapped = React.useMemo(
    () => !Array.isArray(crib) ? crib : crib.map(({ card }) => card),
    [crib]
  );

  return (
    <>
      <section className='hand player'>
        <h2>Hand</h2>
        <Cards
          cards={hand || []}
          name='card'
          onChange={handleChange}
          selectedCard={selectedCard}
        />

        {!selectedCard ? null : (
          <button
            disabled={phase === 'crib' ? hand.length <= 4 : hands.length === 0}
            className='play'
            onClick={() => dispatch({ type: 'play', card: selectedCard })}
          >
            {phase === 'crib' ? 'Put' : 'Play'} <MiniCard card={selectedCard} horizontal /> {phase === 'crib' ? 'in crib' : ''}
          </button>
        )}
      </section>

      <h2>Cut</h2>
      {cut ? <Card card={cut} /> : null}

      <section className='crib'>
        <h2>Crib</h2>
        {Array.isArray(cribMapped) ? <Cards cards={cribMapped} /> : `${cribMapped || 0} cards in crib.`}
      </section>

      <section className='play'>
        <h2>Play</h2>
        <Cards cards={play} />
      </section>

      <section className='users'>
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
      </section>

      <button onClick={() => dispatch({ type: 'cut' })}>cut</button>
      <button onClick={() => dispatch({ type: 'shuffle' })}>shuffle</button>
      <span>{deck} cards remaining</span>
    </>
  );
}
