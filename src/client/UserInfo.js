import React from 'react';
import { RoomContext } from './Room';

export function UserInfo () {
  const state = React.useContext(RoomContext);
  const { joined, user, userInfo, dispatch } = state;
  const { name } = (userInfo || {})[user] || {};

  const [nameState, setNameState] = React.useState(undefined);
  const handleChange = React.useCallback(
    ({ target: { value } }) => {
      setNameState(value);

      if (joined) {
        dispatch({ type: 'userInfo', info: { name: value } });
      }
    },
    [dispatch, joined]
  );

  // There ... is probably a better way to handle this
  const [lastJoined, setLastJoined] = React.useState(false);
  if (lastJoined !== joined) {
    setLastJoined(joined);
  }
  React.useEffect(
    () => {
      if (!lastJoined && joined && nameState) {
        dispatch({ type: 'userInfo', info: { name: nameState } });
      }
    },
    [dispatch, lastJoined, joined, nameState]
  );

  return (
    <section className='user-info'>
      <h2 className='sr-only'>Player Information</h2>
      <label>
        Your name:{' '}
        <input
          type='text'
          placeholder={user}
          value={(nameState === undefined ? name : nameState) || ''}
          onChange={handleChange}
        />
      </label>
    </section>
  );
}
