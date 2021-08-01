import React from 'react';
import Modal from 'react-modal';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCrown, faCog, faArrowCircleUp, faArrowCircleDown } from '@fortawesome/free-solid-svg-icons';

import { RoomContext } from './Room';
import { Cards, useRadioCards } from './Cards';
import { Card, MiniCard } from './Card';
import { UserInfo } from './UserInfo';

export function PlayerHand ({ userInfo, playerNumber, index, hand, cribOwner, turn }) {
  const { cards, count } = hand || {};
  const { name } = userInfo || {};

  const rotateMap = {
    0: 90,
    1: 0,
    2: -90
  };
  const cardCount = Math.max(count || 0, (cards || []).length);
  const renderedCards = [];
  const rotate = rotateMap[index];
  for (let i = 0; i < cardCount; i++) {
    if (i < (cards || []).length) {
      renderedCards.push(<li key={i}><Card card={cards[i]} rotate={rotate} /></li>);
    } else {
      renderedCards.push(<li key={i}><Card back rotate={rotate} /></li>);
    }
  }

  return (
    <li className={turn ? 'hand has-action' : 'hand'}>
      <div className='hand-wrapper'>
        <div className='name-wrapper'>
          <header>
            <h3>{name || `Player ${playerNumber}`}</h3>
            {cribOwner ? <span className='owns-crib'><FontAwesomeIcon icon={faCrown} /></span> : null}
          </header>
        </div>
        <div className='cards-wrapper'>
          <ul className='cards'>
            {renderedCards.length ? null : <li className='space-holder'><Card back /></li>}
            {renderedCards}
          </ul>
        </div>
      </div>
    </li>
  );
}

function Scores ({ userInfo, gameMode, order, scores }) {
  const teams = ((gameMode || {}).teams || [])
    .map(playerIndexes => playerIndexes.map(i => order[i]).filter(i => i))
    .filter(a => a.length);

  const scoreSums = {};
  const userTeamMap = {};
  for (let i = 0; i < teams.length; i++) {
    scoreSums[i] = 0;
    for (const user of teams[i]) {
      userTeamMap[user] = i;
    }
  }

  for (const { user, value } of (scores || [])) {
    scoreSums[userTeamMap[user]] += value;
    if (scoreSums[userTeamMap[user]] >= 121) {
      scoreSums[userTeamMap[user]] = 121;
      break;
    }
  }

  return (
    <dl>
      {teams.map((users, i) => (
        <React.Fragment key={i}>
          <dt>{users.map(user => (userInfo[user] || {}).name || user).join(' and ')}</dt>
          <dd>{scoreSums[i]}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

function ScoresTable ({ userInfo, gameMode, order, scores }) {
  const teams = ((gameMode || {}).teams || [])
    .map(playerIndexes => playerIndexes.map(i => order[i]).filter(i => i))
    .filter(a => a.length);

  const scoreSums = {};
  const userTeamMap = {};
  for (let i = 0; i < teams.length; i++) {
    scoreSums[i] = 0;
    for (const user of teams[i]) {
      userTeamMap[user] = i;
    }
  }

  const rows = [];
  for (const { user, value, during, type, isCrib, cards, fifteens, runs, pairs, flush, nobs } of (scores || [])) {
    scoreSums[userTeamMap[user]] += value;
    if (scoreSums[userTeamMap[user]] >= 121) {
      scoreSums[userTeamMap[user]] = 121;
      break;
    }
    rows.push(
      <React.Fragment key={rows.length}>
        <tr>
          <td rowSpan={2}>{(userInfo[user] || {}).name || user}</td>
          <td rowSpan={2}>{during === 'play' ? 'Pegging' : (isCrib ? 'Crib' : 'Hand')} {type}</td>
          <td>{JSON.stringify({ cards })}</td>
          <td rowSpan={2}>{value}</td>
          <td rowSpan={2}>{scoreSums[userTeamMap[user]]}</td>
        </tr>
        <tr>
          <td>{JSON.stringify({ type, fifteens, runs, pairs, flush, nobs })}</td>
        </tr>
      </React.Fragment>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Player</th>
          <th>Event</th>
          <th>Cards and Score Breakdown</th>
          <th>Points</th>
          <th>Team Total</th>
        </tr>
      </thead>
      <tbody>
        {rows}
      </tbody>
    </table>
  );
}

export function Game ({ user }) {
  const state = React.useContext(RoomContext);
  const { hands, dispatch, cut, phase, play, cribOwner, turn, playTotal, scores, settings, gameMode } = state;
  const order = state.order || [];
  const crib = state.crib || [];
  const userInfo = state.userInfo || {};
  const { contextMenuAsClick } = settings || {};
  const hand = ((hands || {})[user] || {}).cards || [];
  const watchers = Object.keys(userInfo).filter(u => order.indexOf(u) < 0);
  watchers.sort();
  const [selectedCard, handleChange] = useRadioCards(hand);

  const [localShowScores, setLocalShowScores] = React.useState();
  const [isShowingOptions, setIsShowingOptions] = React.useState(false);
  const handleShowModal = React.useCallback(() => setIsShowingOptions(true), []);
  const handleHideModal = React.useCallback(() => setIsShowingOptions(false), []);

  const [isShowingScoreDetails, setIsShowingScoreDetails] = React.useState(false);
  const handleShowScoreDetails = React.useCallback(() => setIsShowingScoreDetails(true), []);
  const handleHideScoreDetails = React.useCallback(() => setIsShowingScoreDetails(false), []);

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

    if ((gameMode.players === 2 && i === (myIndex === undefined ? 1 : 0)) || (myIndex !== undefined && gameMode.players === 3 && i === 1)) {
      handsToRender.push(<li key={-i - 1} style={{ display: 'none' }} />);
    }

    const user = order[index];
    const usersHand = (hands || {})[user];
    handsToRender.push(
      <PlayerHand
        key={i}
        index={handsToRender.length}
        playerNumber={i + 1}
        userInfo={userInfo[user]}
        hand={usersHand}
        cribOwner={user === cribOwner}
        turn={phase === 'play' ? user === turn : (phase === 'crib' && (usersHand || {}).count > 4)}
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

  let canPlay = phase === 'crib' && hand.length > 4;
  if (phase === 'play' && turn === user) {
    for (let i = 0; i < hand.length; i++) {
      if (playTotal + Math.min(hand[i].value, 10) <= 31) {
        canPlay = true;
        break;
      }
    }
  }
  const hasAction = canPlay || (phase === 'play' && turn === user);
  const showScores = localShowScores === false ? false : (localShowScores || !!(settings || {}).showScores);

  return (
    <div className={myIndex === undefined ? 'not-a-player game' : 'game'}>
      <button type='button' className='options' onClick={handleShowModal}><FontAwesomeIcon icon={faCog} /><span className='sr-only'>Options</span></button>
      <Modal isOpen={isShowingOptions} onRequestClose={handleHideModal}>
        <button onClick={handleHideModal}>Close Options</button>
        <Options order={order} gameMode={gameMode} watchers={watchers} userInfo={userInfo} dispatch={dispatch} isShowingOptions={isShowingOptions} settings={settings} localShowScores={localShowScores} setLocalShowScores={setLocalShowScores} />
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
              disabled={(phase === 'pre-shuffle' && order.length !== gameMode.players) || (phase !== 'cut' && phase !== 'count' && phase !== 'crib' && phase !== 'pre-shuffle')}
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

        <div className='play-wrapper'>
          <section className='play'>
            <h2>Play</h2>
            <span className='play-total'>{playTotal || <>&nbsp;</>}</span>
            <Cards className='mini' mini cards={play} min={1} zIndexReverse />
            <Cards className='full' cards={play} min={1} zIndexReverse />
          </section>

          {!showScores ? null : (
            <section className='scores'>
              <h2>Scores</h2>
              <button type='button' onClick={handleShowScoreDetails}>Show score details</button>
              <Modal isOpen={isShowingScoreDetails} onRequestClose={handleHideScoreDetails}>
                <button onClick={handleHideScoreDetails}>Close Score Details</button>
                <ScoresTable userInfo={userInfo} gameMode={gameMode} order={order} scores={scores} />
              </Modal>
              <Scores userInfo={userInfo} order={order} gameMode={gameMode} scores={scores} />
            </section>
          )}
        </div>

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

function Options ({ order, gameMode, watchers, userInfo, isShowingOptions, settings, setLocalShowScores, localShowScores, dispatch }) {
  const [allOrder, setAllOrder] = React.useState([...order, ...watchers]);
  settings = settings || {};

  const handleSetPlayer = React.useCallback(
    () => {
      dispatch({ type: 'order', order: allOrder.slice(0, gameMode.players) });
    },
    [dispatch, allOrder, gameMode]
  );
  React.useEffect(
    () => { setAllOrder(null); },
    [isShowingOptions]
  );

  const handleChangeGameMode = ({ target: { value } }) => dispatch({ type: 'settings', settings: { gameMode: value } });
  const handleCheckboxSettingFactory = setting => ({ target: { checked } }) => {
    dispatch({ type: 'settings', settings: { [setting]: checked } });
  };

  const localShowScoresChecked = localShowScores === false ? false : (localShowScores || !!settings.showScores);
  const handleToggleShowScoresLocally = ({ target: { checked } }) => { setLocalShowScores(checked); };

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
          <li key={u} className={allOrder.indexOf(u) < gameMode.players ? undefined : 'watcher'}>
            {(userInfo[u] || {}).name || u}
            {i === 0 ? null : <button type='button' onClick={handleReorderPlayer} data-index={i} data-dir='u'><FontAwesomeIcon icon={faArrowCircleUp} /><span className='sr-only'>Move Up</span></button>}
            {i === allOrder.length - 1 ? null : <button type='button' onClick={handleReorderPlayer} data-index={i} data-dir='d'><FontAwesomeIcon icon={faArrowCircleDown} /><span className='sr-only'>Move Down</span></button>}
          </li>
        ))}
      </ol>
      <button onClick={handleSetPlayer}>Set Players</button>
      <label className='select-setting'>
        {'Number of players: '}
        <select value={settings.gameMode || '4'} onChange={handleChangeGameMode}>
          <option value='2'>2</option>
          <option value='3'>3</option>
          <option value='4'>4</option>
          <option value='4-no-team'>4 (no teams)</option>
        </select>
      </label>

      <label className='checkbox-setting'><input type='checkbox' checked={localShowScoresChecked} onChange={handleToggleShowScoresLocally} /> Show scores.</label>
      <label className='checkbox-setting'><input type='checkbox' checked={!!settings.contextMenuAsClick} onChange={handleCheckboxSettingFactory('contextMenuAsClick')} /> Disable right click for all players and treat it as a click for game actions.</label>
      <label className='checkbox-setting'><input type='checkbox' checked={!!settings.autoGo} onChange={handleCheckboxSettingFactory('autoGo')} /> Automatically skip players with a "go".</label>
      <label className='checkbox-setting'><input type='checkbox' checked={!!settings.showScores} onChange={handleCheckboxSettingFactory('showScores')} /> Default showing scores for everyone.</label>
    </>
  );
}
