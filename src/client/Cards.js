import React from 'react';

import { Card } from './Card';

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

function RadioCard ({ card, onChange, selectedCardValue }) {
  const radioValue = `${card.value}-${card.suit}`;

  return (
    <label>
      <input type='radio' name='card' value={radioValue} onChange={onChange} checked={selectedCardValue === radioValue} />
      <Card card={card} />
    </label>
  );
}

export function Cards ({ cards, count, className, name, onChange, selectedCard }) {
  const selectedCardValue = selectedCard ? `${selectedCard.value}-${selectedCard.suit}` : undefined;

  const renderedCards = [];
  for (let i = 0; i < Math.max(count || 0, (cards || []).length); i++) {
    if (i < (cards || []).length) {
      const cardOrCardUserPair = cards[i];
      const card = cardOrCardUserPair.card || cardOrCardUserPair;

      renderedCards.push(
        <li key={`${card.value}-${card.suit}`}>
          {!onChange ? <Card card={card} /> : (
            <RadioCard
              name={name}
              card={card}
              onChange={onChange}
              selectedCardValue={selectedCardValue}
            />
          )}
        </li>
      );
    } else {
      renderedCards.push(<li key={i}><Card back /></li>);
    }
  }

  return (
    <ul className={['cards', className].filter(i => i).join(' ')}>
      {renderedCards}
    </ul>
  );
}
