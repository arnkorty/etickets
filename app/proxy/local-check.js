import fetch from 'node-fetch'
import S from '../services/config'

const checkProxies = (proxies = []) => {
  const checkUrl = S.getInteractHost() + '/ipcheck'
  return fetch(checkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ proxies })
  })
}

export default checkProxies
