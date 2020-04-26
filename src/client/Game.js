import React from 'react';
import Modal from 'react-modal';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown, faCog, faArrowCircleUp, faArrowCircleDown } from '@fortawesome/free-solid-svg-icons';

import { RoomContext } from './Room';
import { Cards, useRadioCards } from './Cards';
import { Card, MiniCard } from './Card';
import { UserInfo } from './UserInfo';

export function PlayerHand ({ userInfo, index, playerNumber, hand, cribOwner }) {
  const { cards, count } = hand || {};
  const { name } = userInfo || {};

  const [size, setSize] = React.useState(0);
  const cardsRef = React.useRef();
  const cardsCallback = React.useCallback(card => {
    cardsRef.current = card;
    if (cardsRef.current) {
      setSize(index === 1 || index === 3 ? cardsRef.current.clientWidth : cardsRef.current.clientHeight);
    }
  }, [index]);

  const [cardSize, setCardSize] = React.useState(0);
  const firstCardRef = React.useRef();
  const firstCardCallback = React.useCallback(card => {
    firstCardRef.current = card;
    if (firstCardRef.current) {
      setCardSize(index === 1 || index === 3 ? firstCardRef.current.clientWidth : firstCardRef.current.clientHeight);
    }
  }, [index]);

  React.useEffect(
    () => {
      const listener = () => {
        if (cardsRef.current) {
          setSize(index === 1 || index === 3 ? cardsRef.current.clientWidth : cardsRef.current.clientHeight);
        }
        if (firstCardRef.current) {
          setCardSize(index === 1 || index === 3 ? firstCardRef.current.clientWidth : firstCardRef.current.clientHeight);
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
  const position = (size - cardSize) / Math.max(cardCount - 1, 4);
  const renderedCards = [];
  const rotate = rotateMap[index];
  for (let i = 0; i < cardCount; i++) {
    let style;
    if (index === 1 || index === 3) {
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
          <header>
            <h3>{name || `Player ${playerNumber || index}`}</h3>
            {cribOwner ? <span className='owns-crib'><FontAwesomeIcon icon={faCrown} /></span> : null}
          </header>
        </div>
        <div className='cards-wrapper'>
          <ul className='cards' ref={cardsCallback}>
            {renderedCards.length ? null : <li className='space-holder'><Card back /></li>}
            {renderedCards}
          </ul>
        </div>
      </div>
    </li>
  );
}

export function Game ({ user }) {
  const state = React.useContext(RoomContext);
  const { hands, dispatch, cut, phase, play, cribOwner } = state;
  const order = state.order || [];
  const crib = state.crib || [];
  const userInfo = state.userInfo || {};
  const hand = ((hands || {})[user] || {}).cards || [];
  const watchers = Object.keys(userInfo).filter(u => order.indexOf(u) < 0);
  watchers.sort();
  const [selectedCard, handleChange] = useRadioCards(hand);

  const [isShowingOptions, setIsShowingOptions] = React.useState(false);
  const handleShowModal = React.useCallback(() => setIsShowingOptions(true), []);
  const handleHideModal = React.useCallback(() => setIsShowingOptions(false), []);

  React.useEffect(
    () => {
      if (phase === 'cut' || phase === 'count' || phase === 'shuffle') {
        handleChange({ target: {} });
      }
    },
    [handleChange, phase]
  );

  let myIndex;
  for (let i = 0; i < order.length; i++) {
    if (order[i] === user) {
      myIndex = i;
      break;
    }
  }
  const handsToRender = [];
  for (let i = 0; i < order.length; i++) {
    let index;

    if (myIndex === undefined) {
      index = i;
    } else {
      if (i === order.length - 1) {
        break;
      }
      index = (myIndex + i + 1) % order.length;
    }

    const user = order[index];
    handsToRender.push(
      <PlayerHand
        key={i}
        index={i}
        userInfo={userInfo[user]}
        hand={(hands || {})[user]}
        cribOwner={user === cribOwner}
      />
    );
  }

  const canPlay = phase === 'play' || (phase === 'crib' && hand.length === 5);

  return (
    <div className={myIndex === undefined ? 'not-a-player game' : 'game'}>
      <button type='button' className='options' onClick={handleShowModal}><FontAwesomeIcon icon={faCog} /><span className='sr-only'>Options</span></button>
      <Modal isOpen={isShowingOptions} onRequestClose={handleHideModal}>
        <button onClick={handleHideModal}>Close Options</button>
        <Options order={order} watchers={watchers} userInfo={userInfo} dispatch={dispatch} isShowingOptions={isShowingOptions} />
      </Modal>
      <section className={!canPlay && phase !== 'count' ? 'hand player disabled' : 'hand player'}>
        <header>
          <h2><UserInfo /><span>'s (Your) Hand</span></h2>
          {cribOwner !== user ? null : <span className='owns-crib'><FontAwesomeIcon icon={faCrown} /></span>}
        </header>
        <Cards
          cards={hand}
          name='card'
          onChange={handleChange}
          selectedCard={selectedCard}
          disabled={!canPlay}
          min={1}
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
                <button disabled={phase !== 'cut'} onClick={() => dispatch({ type: 'cut' })}>cut</button>
                <button onClick={() => dispatch({ type: 'shuffle' })}>shuffle</button>
              </div>
            </div>
          </section>

          <section className='crib'>
            <h2>Crib</h2>
            <div className='crib-owner'>{cribOwner ? `${(userInfo[cribOwner] || {}).name || cribOwner}'s` : <>&nbsp;</>}</div>
            <Cards className='mini' mini cards={crib.cards} count={crib.count} min={4} placeholderBack />
            <Cards className='full' cards={crib.cards} count={crib.count} min={4} />
          </section>
        </div>

        <section className='play'>
          <h2>Play</h2>
          <Cards className='mini' mini cards={play} min={1} />
          <Cards className='full' cards={play} min={1} />
        </section>

        <section className='users'>
          <h2 className='sr-only'>Players</h2>
          <ol>
            {handsToRender}
          </ol>
        </section>

        {myIndex === undefined ? <p>You are {(userInfo[user] || {}).name}</p> : null}
      </div>
    </div>
  );
}

function Options ({ order, watchers, userInfo, isShowingOptions, dispatch }) {
  const [allOrder, setAllOrder] = React.useState([...order, ...watchers]);

  const handleSetPlayer = React.useCallback(
    () => {
      console.log('called');
      dispatch({ type: 'order', order: allOrder.slice(0, 4) });
    },
    [dispatch, allOrder]
  );
  React.useEffect(
    () => { setAllOrder(null); },
    [isShowingOptions]
  );

  const handleReorderPlayer = React.useCallback(
    event => {
      const index = parseInt(event.currentTarget.getAttribute('data-index'), 10);
      const direction = event.currentTarget.getAttribute('data-dir') === 'u' ? -1 : 1;

      const newOrder = [...allOrder];
      newOrder[index] = allOrder[index + direction];
      newOrder[index + direction] = allOrder[index];

      setAllOrder(newOrder);
    },
    [allOrder]
  );

  if (allOrder === null) {
    // Quick hack to just get this done.
    setAllOrder([...order, ...watchers]);
    return null;
  }

  return (
    <>
      <h2>Player Order</h2>
      <ol>
        {allOrder.map((u, i) => (
          <li key={u} className={allOrder.indexOf(u) < 4 ? undefined : 'watcher'}>
            {(userInfo[u] || {}).name || u}
            {i === 0 ? null : <button type='button' onClick={handleReorderPlayer} data-index={i} data-dir='u'><FontAwesomeIcon icon={faArrowCircleUp} /><span className='sr-only'>Move Up</span></button>}
            {i === allOrder.length - 1 ? null : <button type='button' onClick={handleReorderPlayer} data-index={i} data-dir='d'><FontAwesomeIcon icon={faArrowCircleDown} /><span className='sr-only'>Move Down</span></button>}
          </li>
        ))}
      </ol>
      <button onClick={handleSetPlayer}>Set Players</button>
    </>
  );
}
