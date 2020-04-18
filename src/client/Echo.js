import React from 'react';

import { SocketContext } from './Socket';

export function Echo () {
  const { sendMessage, subscribe, unsubscribe } = React.useContext(SocketContext);
  const [messages, setMessages] = React.useState([]);

  React.useEffect(
    () => {
      const handler = message => {
        setMessages(cur => [...cur, message]);
      };

      subscribe(handler);
      return () => {
        unsubscribe(handler);
      };
    }
  );

  const ref = React.useRef();
  const handleClick = React.useCallback(
    () => {
      const value = (ref.current || {}).value || '';
      (ref.current || {}).value = '';
      sendMessage(value);
    },
    [ref, sendMessage]
  );

  return (
    <>
      <input type='text' ref={ref} />
      <button onClick={handleClick}>Echo</button>
      <pre>{JSON.stringify(messages, null, 2)}</pre>
    </>
  );
}
