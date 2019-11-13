// @flow
import {
  ADD_ACCOUNT,
  UPDATE_ACCOUNT,
  DELETE_ACCOUNT,
  ADD_BATCH_ACCOUNT
} from '../actions/accounts';
import type {
  Action
} from './types';

export default function accounts(state = [], action: Action) {

  const data = action.payload
  const exist = state.find(l => l.username === data.username)
  switch (action.type) {
    case ADD_ACCOUNT:
      if (exist) {
        Object.assign(exist, data)
      } else {
        state = [data, ...state]
      }
      return [...state]
    case ADD_BATCH_ACCOUNT:
      (data || []).forEach(item => {
        const exist = state.find(l => l.username === item.username)
        if (exist) {
          Object.assign(exist, item)
        } else {
          state = [item, ...state]
        }
      })
      return [...state]
    case UPDATE_ACCOUNT:
      if (exist) {
        Object.assign(exist, data)
      }
      return [...state]
    case DELETE_ACCOUNT:
      const existIndex = state.findIndex(l => l.username === data.username)
      if (existIndex > -1) {
        state.splice(existIndex, 1)
      }
      return [...state]
    default:
      return state;
  }
}
