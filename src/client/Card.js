import React from 'react';

import svgCards from 'svg-cards/svg-cards.svg';

export function Card ({ suit, value }) {
  switch (value) {
    case 11:
      value = 'jack';
      break;
    case 12:
      value = 'queen';
      break;
    case 13:
      value = 'king';
      break;
  }

  return (
    <svg viewBox='0 0 169.075 244.64' xmlns='http://www.w3.org/2000/svg' className='card'>
      <title>{value} of {suit}s</title>
      <use xlinkHref={`${svgCards}#${suit}_${value}`} />
    </svg>
  );
}
