// @flow
import React from 'react';
import { PersistGate } from 'redux-persist/integration/react';

import { Provider } from 'react-redux';
import { ConnectedRouter } from 'connected-react-router';
import { hot } from 'react-hot-loader/root';
import type { Store } from '../reducers/types';
import Routes from '../Routes';

type Props = {
  store: Store,
  persistor: {},
  history: {}
};

const Root = ({ store, history, persistor }: Props) => (
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <ConnectedRouter history={history}>
        <Routes />
      </ConnectedRouter>
    </PersistGate>
  </Provider>
);

export default hot(Root);
