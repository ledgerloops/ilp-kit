import React from 'react';
import {Router, IndexRoute, Route} from 'react-router';
import { isLoaded as isAuthLoaded, load as loadAuth } from 'redux/actions/auth';
import {
    App,
    Home,
    Login,
    Register,
    Button,
    Settings,
    NotFound,
    Widget
  } from 'containers';

export default (store) => {
  const requireLogin = (nextState, replace, cb) => {
    function checkAuth() {
      const { auth: { user }} = store.getState();
      if (!user) {
        // oops, not logged in, so can't be here!
        replace('/');
      }
      cb();
    }

    if (!isAuthLoaded(store.getState())) {
      store.dispatch(loadAuth()).then(checkAuth).catch(checkAuth);
    } else {
      checkAuth();
    }
  };

  /**
   * Please keep routes in alphabetical order
   */
  return (
    <Router>
      <Route path="widget" component={Widget} />
      <Route path="/" component={App}>
        { /* Home (main) route */ }
        <IndexRoute component={Home}/>

        { /* Routes */ }
        <Route path="login" component={Login}/>
        <Route path="register" component={Register}/>

        { /* Routes requiring login */ }
        <Route onEnter={requireLogin}>
          <Route path="button" component={Button}/>
          <Route path="settings" component={Settings}/>
        </Route>

        { /* Catch all route */ }
        <Route path="*" component={NotFound} status={404} />
      </Route>
    </Router>
  );
};
