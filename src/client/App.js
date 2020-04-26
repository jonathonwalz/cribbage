import React from 'react';

// Hash router has to be used for Android 4 support
import { HashRouter as Router, Route, Switch, Redirect } from 'react-router-dom';

import { v4 as uuid } from 'uuid';
import Cookies from 'js-cookie';

import 'typeface-roboto';
import './App.scss';

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

function Home () {
  return <Redirect to='/r/default' />;
}

function App () {
  return (
    <Router>
      <SocketProvider>
        <Switch>
          <Route path='/r/:room' component={GameRoom} />
          <Route path='/' component={Home} />
        </Switch>
      </SocketProvider>
    </Router>
  );
}

export default App;
