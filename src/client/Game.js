import React from 'react';
import { RoomContext } from './Room';

import { Cards, useRadioCards } from './Cards';
import { Card, MiniCard } from './Card';
import { UserInfo } from './UserInfo';

export function PlayerHand ({ user, userInfo, index, hand }) {
  const { cards, count } = hand || {};
  const { name } = userInfo || {};

  const [size, setSize] = React.useState(0);
  const cardsRef = React.useRef();
  const cardsCallback = React.useCallback(card => {
    cardsRef.current = card;
    if (cardsRef.current) {
      setSize(index === 1 ? cardsRef.current.clientWidth : cardsRef.current.clientHeight);
    }
  }, [index]);

  const [cardSize, setCardSize] = React.useState(0);
  const firstCardRef = React.useRef();
  const firstCardCallback = React.useCallback(card => {
    firstCardRef.current = card;
    if (firstCardRef.current) {
      setCardSize(index === 1 ? firstCardRef.current.clientWidth : firstCardRef.current.clientHeight);
    }
  }, [index]);

  React.useEffect(
    () => {
      const listener = () => {
        if (cardsRef.current) {
          setSize(index === 1 ? cardsRef.current.clientWidth : cardsRef.current.clientHeight);
        }
        if (firstCardRef.current) {
          setCardSize(index === 1 ? firstCardRef.current.clientWidth : firstCardRef.current.clientHeight);
        }
      };

      window.addEventListener('resize', listener);
      return () => window.removeEventListener('resize', listener);
    },
    [index]
  );

  const rotateMap = {
    0: 90,
    1: 180,
    2: -90
  };
  const cardCount = Math.max(count || 0, (cards || []).length);
  const position = (size - cardSize) / (cardCount - 1);
  const renderedCards = [];
  const rotate = rotateMap[index];
  for (let i = 0; i < cardCount; i++) {
    let style;
    if (index === 1) {
      style = { left: i * position };
    } else {
      style = { top: i * position };
    }
    if (index === 2) {
      style.zIndex = -i;
    }
    if (i < (cards || []).length) {
      renderedCards.push(<li key={i} ref={i === 0 ? firstCardCallback : undefined} style={style}><Card card={cards[i]} rotate={rotate} /></li>);
    } else {
      renderedCards.push(<li key={i} ref={i === 0 ? firstCardCallback : undefined} style={style}><Card back rotate={rotate} /></li>);
    }
  }

  return (
    <li className='hand'>
      <div className='hand-wrapper'>
        <div className='name-wrapper'>
          <h3>{name || user}</h3>
        </div>
        <div className='cards-wrapper'>
          <ul className='cards' ref={cardsCallback}>{renderedCards}</ul>
        </div>
      </div>
    </li>
  );
}

export function Game ({ user }) {
  const state = React.useContext(RoomContext);
  const { users, userInfo, hands, dispatch, cut, crib, phase, play } = state;
  const hand = ((hands || {})[user] || {}).cards || [];
  const [selectedCard, handleChange] = useRadioCards(hand);

  // TODO: This should be done on the server
  const cribMapped = React.useMemo(
    () => !Array.isArray(crib) ? crib : crib.map(({ card }) => card),
    [crib]
  );

  // TODO: order player hands based on this player

  return (
    <div className='game'>
      <section className='hand player'>
        <h2><UserInfo /><span>'s (Your) Hand</span></h2>
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
          <section className='deck'>
            <h2>Cut</h2>
            {!cut ? <Card back /> : (
              <>
                <MiniCard className='mini' card={cut} />
                <Card className='full' card={cut} />
              </>
            )}
            <div>

              <div>
                <button onClick={() => dispatch({ type: 'cut' })}>cut</button>
                <button onClick={() => dispatch({ type: 'shuffle' })}>shuffle</button>
              </div>
            </div>
          </section>

          <section className='crib'>
            <h2>Crib</h2>
            <Cards className='mini' mini cards={Array.isArray(cribMapped) ? cribMapped : []} count={Array.isArray(cribMapped) ? cribMapped.length : (cribMapped || 0)} />
            <Cards className='full' cards={Array.isArray(cribMapped) ? cribMapped : []} count={Array.isArray(cribMapped) ? cribMapped.length : (cribMapped || 0)} />
          </section>
        </div>

        <section className='play'>
          <h2>Play</h2>
          <Cards className='mini' mini cards={play} />
          <Cards className='full' cards={play} />
        </section>

        <section className='users'>
          <h2 className='sr-only'>Players</h2>
          <ol>
            {(users || []).filter(otherUser => user !== otherUser && (hands || {})[otherUser]).map((otherUser, i) => (
              <PlayerHand
                key={otherUser}
                index={i}
                user={otherUser}
                userInfo={(userInfo || {})[otherUser]}
                hand={(hands || {})[otherUser]}
              />
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
