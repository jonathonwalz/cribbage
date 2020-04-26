import 'react-app-polyfill/ie9';
import 'react-app-polyfill/stable';

import React from 'react';
import ReactDOM from 'react-dom';
import Modal from 'react-modal';

import App from './client/App';

const appElement = document.getElementById('root');
Modal.setAppElement(appElement);

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  appElement
);
