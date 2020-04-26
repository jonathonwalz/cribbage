import React from 'react';

import { MiniCard, Card } from './Card';

export function useRadioCards (cards) {
  const [selectedCardState, setSelectedCard] = React.useState();
  const handleChange = React.useCallback(
    ({ target: { value } }) => {
      if (!value) {
        setSelectedCard(undefined);
      } else {
        const [v, s] = value.split('-');
        setSelectedCard({ value: parseInt(v, 10), suit: s });
      }
    },
    []
  );

  let selectedCard;
  if (selectedCardState) {
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].value === selectedCardState.value && cards[i].suit === selectedCardState.suit) {
        selectedCard = cards[i];
        break;
      }
    }
  }

  return [selectedCard, handleChange];
}

function RadioCard ({ card, onChange, disabled, selectedCardValue, contextMenuAsClick }) {
  const radioValue = `${card.value}-${card.suit}`;

  const handleContextMenu = React.useCallback(
    () => {
      if (!contextMenuAsClick || !onChange) {
        return;
      }

      return onChange({ target: { value: radioValue } });
    },
    [onChange, contextMenuAsClick, radioValue]
  );

  return (
    <label onContextMenu={handleContextMenu}>
      <input type='radio' name='card' value={radioValue} onChange={onChange} checked={selectedCardValue === radioValue} disabled={disabled} />
      <MiniCard card={card} />
      <Card card={card} />
    </label>
  );
}

export function Cards ({ cards, count, mini, className, name, disabled, playTotal, onChange, selectedCard, min, placeholderBack, contextMenuAsClick }) {
  const selectedCardValue = selectedCard ? `${selectedCard.value}-${selectedCard.suit}` : undefined;

  const renderedCards = [];
  const RenderCard = mini ? MiniCard : Card;
  for (let i = 0; i < Math.max(count || 0, (cards || []).length); i++) {
    if (i < (cards || []).length) {
      const cardOrCardUserPair = cards[i];
      const card = cardOrCardUserPair.card || cardOrCardUserPair;

      renderedCards.push(
        <li key={`${card.value}-${card.suit}`} className={cards[i].lastCard ? 'last-card' : undefined}>
          {!onChange ? <RenderCard card={card} /> : (
            <RadioCard
              name={name}
              card={card}
              onChange={onChange}
              selectedCardValue={selectedCardValue}
              contextMenuAsClick={contextMenuAsClick}
              disabled={disabled || (playTotal ? playTotal + Math.min(card.value, 10) > 31 : false)}
            />
          )}
        </li>
      );
    } else {
      renderedCards.push(<li key={i}><RenderCard back /></li>);
    }
  }

  if (min && renderedCards.length < min) {
    for (let i = renderedCards.length; i < min; i++) {
      renderedCards.push((
        <li key={i} className='space-holder'>
          {!onChange
            ? <RenderCard back={placeholderBack} card={{ suit: 'spade', value: 1 }} />
            : <label><MiniCard card={{ suit: 'spade', value: 1 }} /><Card card={{ suit: 'spade', value: 1 }} /></label>}
        </li>
      ));
    }
  }

  return (
    <ul className={['cards', className].filter(i => i).join(' ')}>
      {renderedCards}
    </ul>
  );
}
