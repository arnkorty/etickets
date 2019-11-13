// @flow
import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { createHashHistory } from 'history';
import { routerMiddleware } from 'connected-react-router';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import createRootReducer from '../reducers';
import type { counterStateType } from '../reducers/types';

const persistConfig = {
  key: 'root',
  storage
};
const history = createHashHistory();
const rootReducer = createRootReducer(history);
const router = routerMiddleware(history);
const enhancer = applyMiddleware(thunk, router);

function configureStore(initialState?: counterStateType) {
  const store = createStore<*, counterStateType, *>(
    persistReducer(persistConfig, rootReducer),
    initialState,
    enhancer
  );
  return {
    store,
    persistor: persistStore(store)
  };
}

export default { configureStore, history };
