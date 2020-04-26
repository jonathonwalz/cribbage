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
export function MiniCard ({ card, horizontal }) {
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

function CardSVG ({ className, rotate, label, link }) {
  let viewBox = '0 0 169.075 244.64';
  const transform = {};
  if (rotate === 90) {
    viewBox = '0 0 244.64 169.075';
    transform.transform = 'rotate(90) translate(0,-244.64)';
  } else if (rotate === 180) {
    transform.transform = 'rotate(180) translate(-169.075,-244.64)';
  } else if (rotate === 270 || rotate === -90) {
    viewBox = '0 0 244.64 169.075';
    transform.transform = 'rotate(-90) translate(-169.075)';
  }

  return (
    <svg
      viewBox={viewBox}
      xmlns='http://www.w3.org/2000/svg'
      className={className}
      role='img'
      aria-label={label}
    >
      <use xlinkHref={link} {...transform} />
    </svg>
  )
}

export function Card ({ card, back, rotate }) {
  if (back) {
    return (
      <CardSVG
        className='card card-back card-large'
        rotate={rotate}
        label='Playing card back'
        link={`${svgCards}#alternate-back`}
      />
    );
  }

  if (!card) {
    return null;
  }

  const { suit, value } = card;
  const cardValueConfig = cardMappingData[value] || { key: value, short: value, long: value };
  const key = `${suit}_${cardValueConfig.key || value}`;

  return (
    <CardSVG
      className='card card-large'
      rotate={rotate}
      label={`${cardValueConfig.long} of ${suit}s`}
      link={`${svgCards}#${key}`}
    />
  );
}
