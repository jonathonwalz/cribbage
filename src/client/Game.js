import React from 'react';
import Modal from 'react-modal';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown, faCog, faArrowCircleUp, faArrowCircleDown } from '@fortawesome/free-solid-svg-icons';

import { RoomContext } from './Room';
import { Cards, useRadioCards } from './Cards';
import { Card, MiniCard } from './Card';
import { UserInfo } from './UserInfo';

export function PlayerHand ({ userInfo, index, playerNumber, hand, cribOwner, turn }) {
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
    <li className={turn ? 'hand has-action' : 'hand'}>
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
  const { hands, dispatch, cut, phase, play, cribOwner, turn, playTotal, settings } = state;
  const order = state.order || [];
  const crib = state.crib || [];
  const userInfo = state.userInfo || {};
  const { contextMenuAsClick } = settings || {};
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
    const usersHand = (hands || {})[user];
    handsToRender.push(
      <PlayerHand
        key={i}
        index={i}
        userInfo={userInfo[user]}
        hand={usersHand}
        cribOwner={user === cribOwner}
        turn={phase === 'play' ? user === turn : (phase === 'crib' && (usersHand || {}).count === 5)}
      />
    );
  }

  React.useEffect(
    () => {
      if (!contextMenuAsClick) {
        return;
      }

      const preventDefault = event => { event.preventDefault(); };
      window.addEventListener('contextmenu', preventDefault);
      return () => window.removeEventListener('contextmenu', preventDefault);
    },
    [contextMenuAsClick]
  );

  const handlePlayCard = React.useCallback(
    () => dispatch({ type: 'play', card: selectedCard }),
    [dispatch, selectedCard]
  );
  const handleGo = React.useCallback(
    () => dispatch({ type: 'play', go: true }),
    [dispatch]
  );
  const handleCutShuffle = React.useCallback(
    () => dispatch({ type: phase === 'cut' ? 'cut' : 'shuffle' }),
    [dispatch, phase]
  );

  let canPlay = phase === 'crib' && hand.length === 5;
  if (phase === 'play' && turn === user) {
    for (let i = 0; i < hand.length; i++) {
      if (playTotal + Math.min(hand[i].value, 10) <= 31) {
        canPlay = true;
        break;
      }
    }
  }
  const hasAction = canPlay || (phase === 'play' && turn === user);

  return (
    <div className={myIndex === undefined ? 'not-a-player game' : 'game'}>
      <button type='button' className='options' onClick={handleShowModal}><FontAwesomeIcon icon={faCog} /><span className='sr-only'>Options</span></button>
      <Modal isOpen={isShowingOptions} onRequestClose={handleHideModal}>
        <button onClick={handleHideModal}>Close Options</button>
        <Options order={order} watchers={watchers} userInfo={userInfo} dispatch={dispatch} isShowingOptions={isShowingOptions} settings={settings} />
      </Modal>
      <section className={'hand player' + (!canPlay && phase !== 'count' ? ' disabled' : '') + (hasAction ? ' has-action' : '')}>
        <header>
          <h2><UserInfo /><span>'s (Your) Hand</span></h2>
          {cribOwner !== user ? null : <span className='owns-crib'><FontAwesomeIcon icon={faCrown} /></span>}
        </header>
        <Cards
          cards={hand}
          name='card'
          onChange={handleChange}
          selectedCard={selectedCard}
          contextMenuAsClick={contextMenuAsClick}
          disabled={!canPlay}
          playTotal={playTotal}
          min={1}
        />

        <div className='action'>
          {phase === 'play' && turn === user && !canPlay
            ? (
              <button className='play' onClick={handleGo} onContextMenu={handleGo}>
                Go
              </button>
            ) : null}
          {!selectedCard ? null : (
            <button className='play' onClick={handlePlayCard} onContextMenu={handlePlayCard}>
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
            <button
              disabled={phase !== 'cut' && phase !== 'count' && phase !== 'crib' && phase !== 'pre-shuffle'}
              onClick={handleCutShuffle}
              onContextMenu={handleCutShuffle}
              className={phase === 'cut' || phase === 'count' || phase === 'pre-shuffle' ? 'has-action' : undefined}
            >
              {phase === 'cut' ? 'cut' : (phase === 'crib' ? 're-deal' : 'deal')}
            </button>
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
          <span className='play-total'>{playTotal || <>&nbsp;</>}</span>
          <Cards className='mini' mini cards={play} min={1} zIndexReverse />
          <Cards className='full' cards={play} min={1} zIndexReverse />
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

function Options ({ order, watchers, userInfo, isShowingOptions, settings, dispatch }) {
  const [allOrder, setAllOrder] = React.useState([...order, ...watchers]);
  settings = settings || {};

  const handleSetPlayer = React.useCallback(
    () => {
      dispatch({ type: 'order', order: allOrder.slice(0, 4) });
    },
    [dispatch, allOrder]
  );
  React.useEffect(
    () => { setAllOrder(null); },
    [isShowingOptions]
  );

  const handleSetContextMenuAsClick = React.useCallback(
    ({ target: { checked } }) => {
      dispatch({ type: 'settings', settings: { contextMenuAsClick: checked } });
    },
    [dispatch]
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
      <label className='right-click'><input type='checkbox' checked={!!settings.contextMenuAsClick} onChange={handleSetContextMenuAsClick} /> Disable right click for all players and treat it as a click for game actions.</label>
    </>
  );
}
