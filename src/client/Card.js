import React from 'react';

import svgCards from 'svg-cards/svg-cards.svg';

const cardMappingData = {
  1: {
    short: 'A',
    long: 'Ace'
  },
  11: {
    key: 'jack',
    short: 'J',
    long: 'Jack'
  },
  12: {
    key: 'queen',
    short: 'Q',
    long: 'Queen'
  },
  13: {
    key: 'king',
    short: 'K',
    long: 'King'
  }
};

const textStyle = { textAnchor: 'middle', fontSize: 15.42 };
export function MiniCard ({ card, horizontal, back }) {
  if (back) {
    return (
      <svg
        viewBox='0 0 169.075 244.64'
        xmlns='http://www.w3.org/2000/svg'
        className={horizontal ? 'card-back card-small' : 'card-back card-small card-horizontal'}
        role='img'
        aria-label='Playing card back'
      >
        <use xlinkHref={`${svgCards}#alternate-back`} />
      </svg>
    );
  }

  if (!card) {
    return null;
  }

  const { value, suit } = card;
  const cardValueConfig = cardMappingData[value] || { key: value, short: value, long: value };

  if (horizontal) {
    return (
      <svg
        viewBox='0 0 39.84 15.88'
        xmlns='http://www.w3.org/2000/svg'
        className='card-small card-horizontal'
        role='img'
        aria-label={`${cardValueConfig.long} of ${suit}s`}
      >
        <text x='7.71' y='50%' dominantBaseline='middle' style={textStyle}>{cardValueConfig.short}</text>
        <use x='15.42' xlinkHref={`${svgCards}#suit-${suit}`} />
      </svg>
    );
  }

  return (
    <svg
      viewBox='0 0 15.42 31.76'
      xmlns='http://www.w3.org/2000/svg'
      className='card-small'
      role='img'
      aria-label={`${cardValueConfig.long} of ${suit}s`}
    >
      <text y='7.94' x='50%' dominantBaseline='middle' style={textStyle}>{cardValueConfig.short}</text>
      <use y='15.88' xlinkHref={`${svgCards}#suit-${suit}`} />
    </svg>
  );
}

export function Card ({ card, back }) {
  if (back) {
    return (
      <span className='card'>
        <MiniCard back />
        <svg
          viewBox='0 0 169.075 244.64'
          xmlns='http://www.w3.org/2000/svg'
          className='card-back card-large'
          role='img'
          aria-label='Playing card back'
        >
          <use xlinkHref={`${svgCards}#alternate-back`} />
        </svg>
      </span>
    );
  }

  if (!card) {
    return null;
  }

  const { suit, value } = card;
  const cardValueConfig = cardMappingData[value] || { key: value, short: value, long: value };
  const key = `${suit}_${cardValueConfig.key || value}`;

  return (
    <span className='card'>
      <MiniCard card={card} />
      <svg
        viewBox='0 0 169.075 244.64'
        xmlns='http://www.w3.org/2000/svg'
        className='card-large'
        role='img'
        aria-label={`${cardValueConfig.long} of ${suit}s`}
      >
        <use xlinkHref={`${svgCards}#${key}`} />
      </svg>
    </span>
  );
}
