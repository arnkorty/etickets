import React, { Fragment } from 'react';

import { render } from 'react-dom';
import { AppContainer as ReactHotAppContainer } from 'react-hot-loader';
import Root from './containers/Root';
import { configureStore, history } from './store/configureStore';
// import './app.global.css';
import 'antd/dist/antd.css';

const { store, persistor } = configureStore();

const AppContainer = process.env.PLAIN_HMR ? Fragment : ReactHotAppContainer;



window.$store = store

render(
  <AppContainer>
    <Root store={store} persistor={persistor} history={history} />
  </AppContainer>,
  document.getElementById('root')
);
