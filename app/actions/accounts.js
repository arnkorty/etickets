// @flow
// import type { GetState, Dispatch } from '../reducers/types';

// export const INCREMENT_COUNTER = 'INCREMENT_COUNTER';
// export const DECREMENT_COUNTER = 'DECREMENT_COUNTER';

export const ADD_ACCOUNT = 'ADD_ACCOUNT'
export const ADD_BATCH_ACCOUNT = 'ADD_BATCH_ACCOUNT'
export const UPDATE_ACCOUNT = 'UPDATE_ACCOUNT'
export const DELETE_ACCOUNT = 'DELETE_ACCOUNT'

// export function increment() {
//   return {
//     type: INCREMENT_COUNTER
//   };
// }

// export function decrement() {
//   return {
//     type: DECREMENT_COUNTER
//   };
// }

export function addAccount(payload,) {
  return {
    type: ADD_ACCOUNT,
    payload
  }
}

export function addBatchAccount(payload, ) {
  return {
    type: ADD_BATCH_ACCOUNT,
    payload
  }
}

export function updateAccount(payload) {
  return {
    type: UPDATE_ACCOUNT,
    payload
  }
}

export function deleteAccount(payload) {
  return {
    type: DELETE_ACCOUNT,
    payload
  }
}

// export function incrementIfOdd() {
//   return (dispatch: Dispatch, getState: GetState) => {
//     const { counter } = getState();

//     if (counter % 2 === 0) {
//       return;
//     }

//     dispatch(increment());
//   };
// }

// export function incrementAsync(delay: number = 1000) {
//   return (dispatch: Dispatch) => {
//     setTimeout(() => {
//       dispatch(increment());
//     }, delay);
//   };
// }
