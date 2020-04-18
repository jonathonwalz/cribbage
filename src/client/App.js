import React from 'react';

// Hash router has to be used for Android 4 support
import { HashRouter as Router, Route } from 'react-router-dom';

import { v4 as uuid } from 'uuid';
import Cookies from 'js-cookie';

import './App.css';

import { SocketProvider } from './Socket';
import { Room } from './Room';
import { Game } from './Game';

function GameRoom ({ match: { params } }) {
  let user = Cookies.get('c_u');
  if (!user) {
    user = uuid();
    Cookies.set('c_u', user);
  }

  return (
    <Room room={params.room} user={user}>
      <Game room={params.room} user={user} />
    </Room>
  );
}

function App () {
  return (
    <Router>
      <SocketProvider>
        <Route path='/r/:room' component={GameRoom} />
      </SocketProvider>
    </Router>
  );
}

export default App;
