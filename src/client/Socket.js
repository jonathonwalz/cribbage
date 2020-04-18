import React from 'react';

const SockJS = window.SockJS;

export const SocketContext = React.createContext();

export function SocketProvider ({ children }) {
  const socketRef = React.useRef({
    connected: false,
    queuedMessages: [],
    subscriptions: new Set(),
    subscribe: func => socketRef.current.subscriptions.add(func),
    unsubscribe: func => socketRef.current.subscriptions.delete(func),
    sendMessage: () => false
  });
  const [value, setValue] = React.useState(socketRef.current);

  React.useEffect(
    () => {
      const socketState = socketRef.current;
      let cleaningUp = false;
      let socket;

      (async () => {
        let connectionTimeout = 1;

        const createSocket = resolve => {
          let hasHandledClose = false;
          const handleClose = () => {
            if (hasHandledClose) {
              return;
            }

            hasHandledClose = true;
            setValue({ ...socketState, connected: false, sendMessage: () => {} });
            resolve();
          };

          socket = new SockJS('/api');
          socket.onopen = () => {
            connectionTimeout = 1;
            setValue({ ...socketState, connected: true, sendMessage: message => socket.send(JSON.stringify(message)) });
          };
          socket.onmessage = ({ data }) => {
            try {
              data = JSON.parse(data);
            } catch {}

            for (const func of socketState.subscriptions) {
              func(data);
            }
          };

          socket.onclose = handleClose;
          socket.onerror = handleClose;
        };

        do {
          await new Promise(createSocket);
          await new Promise(resolve => setTimeout(resolve, 1000 * connectionTimeout)); // eslint-disable-line no-loop-func
          connectionTimeout *= 2;
        } while (!cleaningUp); // eslint-disable-line no-unmodified-loop-condition
      })().catch(error => {
        socketState.error = error;
      });

      return () => {
        cleaningUp = true;
        if (socket) {
          socket.close();
        }
      };
    },
    []
  );

  return <SocketContext.Provider value={value} children={children} />;
}
