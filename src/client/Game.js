import React from 'react';
import { RoomContext } from './Room';

import { Cards, useRadioCards } from './Cards';
import { Card, MiniCard } from './Card';

export function PlayerHand ({ user, userInfo, hand, isPlayer, dispatch }) {
  const { cards, count } = hand || {};
  const { name } = userInfo || {};
  const handleClick = React.useCallback(
    () => {
      dispatch({ type: 'deal', user });
    },
    [dispatch, user]
  );

  const renderedCards = [];
  for (let i = 0; i < Math.max(count || 0, (cards || []).length); i++) {
    if (i < (cards || []).length) {
      renderedCards.push(<li key={i}><MiniCard card={cards[i]} /></li>);
    } else {
      renderedCards.push(<li key={i}><MiniCard back /></li>);
    }
  }

  return (
    <li className={isPlayer ? 'hand is-player' : 'hand'}>
      <h3>
        <span>{isPlayer ? '(You) ' : <>&nbsp;</>}</span>
        {name || user}
      </h3>
      <button className='deal' onClick={handleClick}>deal</button>
      <ul className='cards'>{renderedCards}</ul>
    </li>
  );
}

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
    <div className='game'>
      <section className='hand player'>
        <h2>Your Hand</h2>
        <Cards
          cards={hand || []}
          name='card'
          onChange={handleChange}
          selectedCard={selectedCard}
        />

        <div className='action'>
          {!selectedCard ? null : (
            <button
              disabled={phase === 'crib' ? hand.length <= 4 : hands.length === 0}
              className='play'
              onClick={() => dispatch({ type: 'play', card: selectedCard })}
            >
              {phase === 'crib' ? 'Put' : 'Play'} <MiniCard card={selectedCard} horizontal /> {phase === 'crib' ? 'in crib' : ''}
            </button>
          )}
        </div>
      </section>

      <div className='common'>
        <div className='pre-play'>
          <section className='crib'>
            <h2>Deck</h2>
            <Card back />
            <div>
              <span>{deck} cards</span>
              <button onClick={() => dispatch({ type: 'cut' })}>cut</button>
              <button onClick={() => dispatch({ type: 'shuffle' })}>shuffle</button>
            </div>
          </section>

          <section className='crib'>
            <h2>Crib</h2>
            <Cards cards={Array.isArray(cribMapped) ? cribMapped : []} count={Array.isArray(cribMapped) ? cribMapped.length : (cribMapped || 0)} />
          </section>

          <section className='cut'>
            <h2>Cut</h2>
            {cut ? <Card card={cut} /> : null}
          </section>
        </div>

        <section className='users'>
          <h2 className='sr-only'>Players</h2>
          <ol>
            {(users || []).map(otherUser => (
              <PlayerHand
                key={otherUser}
                user={otherUser}
                userInfo={(userInfo || {})[otherUser]}
                hand={(hands || {})[otherUser]}
                isPlayer={user === otherUser}
                dispatch={dispatch}
              />
            ))}
          </ol>
        </section>

        <section className='play'>
          <h2>Play</h2>
          <Cards cards={play} />
        </section>
      </div>
    </div>
  );
}
