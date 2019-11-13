// let caches = []
// {
//  usages, free:
// }
// const proxyCaches = {
//   usages: [],
//   free: []
// }
// const fetchCaches = []
const fetch = require('node-fetch')
// const rp = require('request-promise')
const path = require('path')
const fs = require('fs')
const Event = require('events')

import utils from '../utils'

import { getCheckInfo } from './check'
import { getRedisClient } from '../engines/caches'
// const S = require('../services/config')
import S from '../services/config'

window.getCheckInfo = getCheckInfo

const checkIPValids = (proxy, urls) => {
  return Promise.resolve(true)
  // return Promise.all(urls.map((uri) => {
  //   return rp({ uri, method: 'HEAD', proxy, timeout: 10000, strictSSL: false }).then(() => true).catch((err) => {
  //     console.log(proxy, uri, err)
  //     return false
  //   })
  // })).then(results => {
  //   urls.forEach((uri, i) => {
  //     console.log('check url', uri, results[i])
  //   })
  //   return results
  // }).then(results => results.filter(rs => rs).length === urls.length)
}

// eslint-disable-next-line

// const isJLDL = () => {
//   return saveWhiteUrl().includes('jinglingdaili')
// }

const baseJGWhiteUrl = 'http://webapi.jghttp.golangapi.com/index/index/save_white?neek=4515&appkey=d9b1907d77d4425dcce1494f51a871cd&white='
const baseJLWhiteUrl = 'http://www.jinglingdaili.com/Users-whiteIpAddNew.html?appid=6307&appkey=a643db3d23711275e5fbcb1edef2b8ef&whiteip='

const saveWhiteUrl = (ip, { isJL } = {}) => {
  if (process.env.NODE_ENV === 'production') {
    return getConfigs().proxy_white_url + ip
  }
  if (getConfigs().proxy_white_url) {
    return getConfigs().proxy_white_url + ip
  }
  return `${isJL ? baseJLWhiteUrl : baseJGWhiteUrl}${ip}`
}
// eslint-disable-next-line
const proxyUrl = ({ province_code, city_code, timeType = 3, tryTime = 0, isJL } = {}) => {
  console.log('proxyUrl tryTime...', tryTime)
  if (tryTime > 1) {
    tryTime = 2
    if (tryTime > 5) {
      city_code = ''
      timeType = 3
      if (tryTime > 7) {
        timeType = 2
      }
    }
  }
  if (isJL) {
    return {
      timeType,
      isJL,
      url: `http://t.11jsq.com/index.php/api/entry?method=proxyServer.generate_api_url&packid=0&fa=0&fetch_key=&groupid=0&qty=16&time=${timeType + 1}&pro=${encodeURIComponent(utils.getProvinName(province_code))}&city=${''}&port=1&format=json&ss=5&css=&ipport=1&et=1&pi=1&co=1&dt=1&specialTxt=3&specialJson=&usertype=2`
    }
  }
  return {
    url: `http://d.jghttp.golangapi.com/getip?num=30&type=2&pro=${province_code}&city=${''}&yys=0&port=1&time=${timeType}&ts=1&ys=1&cs=1&lb=1&sb=0&pb=45&mr=2&regions=`,
    isJL,
    timeType
  }
}
// console.log('getConfigs', S.getConfigs())
const getConfigs = S.getConfigs
const isProxyEnabled = S.isProxyEnabled

const event = new Event()

const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../../data')
const proxyFile = path.resolve(dataDir, 'proxy.json')
// const proxyDumpFile = path.resolve(dataDir, 'proxy.dump.json')
let proxyCaches = {
  usages: []
}
if (fs.existsSync(proxyFile)) {
  try {
    proxyCaches = JSON.parse(fs.readFileSync(proxyFile))
  } catch (err) {
    console.log(err)
    proxyCaches = {
      usages: []
      // free: []
    }
  }
}

// const checkProxyRequest = (proxy, hostUrl) => {
//   const r = rp.defaults({
//     proxy: `http://${proxy.ip}:${proxy.port}`
//   })
//   return r.get(hostUrl || 'https://baidu.com', { timeout: 1000 }).then(() => {
//     console.log('check proxy request OK', proxy.ip)
//     return true
//   }).catch((err) => {
//     console.log('request catch...', err)
//     if (err.message.toLowerCase().includes('net') || err.message.toLowerCase().includes('timeout')) {
//       console.log('check proxy request failure', proxy.ip, err.message)
//       return false
//     }
//     console.log('check proxy request OK', proxy.ip)
//     return true
//   })
// }

const checkProxy = (proxy, hostUrl) => {
  // return true
  console.log('checkproxy', `${proxy.ip}:${proxy.port}`)
  return getCheckInfo(proxy).then(info => {
    proxy.delay = parseInt(info.delay)
    proxy.valid = info.ret === 0 && proxy.delay < 280
    return info.ret === 0
  }).then(bool => {
    console.log('checkproxy result ', bool)
    return bool
  })
}

const updateProxyFile = (key, proxy) => {
  proxyCaches[key] = proxy
  const redis = getRedisClient()
  if (redis) {
    redis.set(`proxy-${key}`, JSON.stringify(proxy))
  }
  fs.writeFileSync(proxyFile, JSON.stringify(proxyCaches))
}

const getProxyInfo = (key, proxy, addFlag = false) => {
  // console.log('fjdsojfoisdjfodsjfodjjjjjjjjjjjj')
  // const usages = (proxyCaches[key] || {}).usages || []
  // usages.push(proxy)
  if (addFlag) {
    proxyCaches.usages.push(proxy)
  }
  updateProxyFile(key, proxy)
  return proxy
  // return {
  //   ip: proxy.ip,
  //   port: proxy.port,
  //   city: proxy.city,
  //   expired_at: proxy.expired_at
  // }
}

let isFetching = false

const deleteProxy = (key) => {
  const redis = getRedisClient()
  if (redis) {
    redis.del(`proxy-${key}`)
  } else {
    delete proxyCaches[key]
  }
}

const getCache = (key, excludes = []) => {
  const redis = getRedisClient()
  if (redis) {
    return redis.get(`proxy-${key}`).then(text => {
      if (text) {
        const cache = JSON.parse(text)
        if (cache.expired_at > Date.now() + 0.3 * 3600 * 1000 && !excludes.includes(cache.ip)) {
          return cache
        }
      }
    })
  } else {
    if (proxyCaches[key] && proxyCaches[key].expired_at && proxyCaches[key].expired_at > Date.now() + 1 * 3600 * 60 && !excludes.includes(proxyCaches[key].ip)) {
      const cache = proxyCaches[key]
      return Promise.resolve(cache)
    // return Promise.resolve(proxyCaches[key])
    }
  }
  return Promise.resolve()
}

const delay = (millseconds) => {
  return new Promise(resolve => {
    setTimeout(resolve, millseconds)
  })
}

const getProxy = (key, { province_code, city_code, excludes = [], timeType, hostUrl, urls = [], tryTime = 0 } = {}) => {
  if (!isProxyEnabled()) {
    return Promise.resolve()
  }

  console.log('getProxy', { key, province_code, city_code, excludes, tryTime, urls })
  // console.log('excludess....', excludes)

  // let cache = null
  // if (proxyCaches[key] && proxyCaches[key].expired_at && proxyCaches[key].expired_at > Date.now() + 1.5 * 3600 * 60 && !excludes.includes(proxyCaches[key].ip)) {
  //   cache = proxyCaches[key]
  //   // return Promise.resolve(proxyCaches[key])
  // }

  return getCache(key, excludes).then(cache => {
    if (cache) {
      return checkProxy(cache, hostUrl).then(bool => {
        if (bool) {
          return checkIPValids(`http://${cache.ip}:${cache.port}`, urls)
        }
        return bool
      }).then(bool => {
        // console.log('lllllll', bool)
        if (bool) {
          console.log('get proxy from cache', cache.ip, cache.port)
          return cache
          // return getProxyInfo(cache)
        } else {
          excludes.push(cache.ip)
          return delay(tryTime * 1000).then(() => getProxy(key, { province_code, city_code, excludes, hostUrl, urls, tryTime: tryTime + 1 }))
        }
      })
      // return Promise.resolve(cache)
    }

    return fetchProxy({ key, province_code, city_code, timeType, excludes: excludes, urls }).then((proxy) => {
      return getProxyInfo(key, proxy, true)
    })
  })

  // proxyCaches.usages.filter(l)
}

const fetchProxy = ({ key, province_code, city_code, timeType, excludes, urls } = {}) => {
  if (isFetching) {
    return new Promise((resolve) => {
      event.once('fetched', () => {
        resolve()
      })
    }).then(() => delay(1000)).then(() => {
      return fetchProxy({ key, province_code, city_code, excludes, urls })
    })
  } else {
    isFetching = true
    return _fetchData({ key, province_code, city_code, timeType, excludes, urls }).then((r) => {
      isFetching = false
      // console.log('fetching.....', r)
      return r
    }).catch((err) => {
      isFetching = false
      throw err
    })
  }
}

const CACHES_PROXIES_TYPE = {}
const toggleJLProxy = (key) => {
  if (!CACHES_PROXIES_TYPE[key]) {
    CACHES_PROXIES_TYPE[key] = {
      n: 0
      // v: false
    }
  }
  CACHES_PROXIES_TYPE[key].n = CACHES_PROXIES_TYPE[key].n + 1
  // CACHES_PROXIES_TYPE[key].v = !CACHES_PROXIES_TYPE[key].v
  if (CACHES_PROXIES_TYPE[key].n > 3) {
    return CACHES_PROXIES_TYPE[key].n % 2 === 0 ? !getConfigs().proxy_jldl : !!getConfigs().proxy_jldl
  }
  return !!getConfigs().proxy_jldl // ? CACHES_PROXIES_TYPE[key] : !CACHES_PROXIES_TYPE[key]
}

const _fetchData = ({ key, province_code, city_code, timeType, tryTime = 0, urls, excludes = [] }) => {
  // console.log('-------------- fetchData')
  const isJL = toggleJLProxy(key)
  const { timeType: t, url, isJL: currentIsJL } = proxyUrl({ province_code, city_code, timeType, isJL, tryTime })
  console.log('proxy origin url', url)
  return fetch(url).then(rs => rs.text()).then(text => {
    console.log(text)
    const json = JSON.parse(text.trim())
    json.isJL = currentIsJL
    if ([10003, 10000, 111, 115].includes(json.code)) {
      if (tryTime > 10) {
        throw new Error('没有符合条件的IP')
      }
      return delay(2000).then(() => _fetchData({ key, province_code, city_code, timeType, urls, tryTime: tryTime + 1, excludes }))
    } else if ([113, 5].includes(json.code)) {
      const ip = json.msg.match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/)
      console.log(`proxy ${ip} 未在白名单，现正准备添加`)
      return fetch(saveWhiteUrl(ip, { isJL })).then(() => {
        event.emit('fetched')
        console.log(`proxy ${ip} 已添加到白名单`)
        isFetching = false
        toggleJLProxy()
        return fetchProxy({
          key,
          province_code,
          city_code,
          timeType,
          excludes
        })
      }).catch(() => {
        event.emit('fetched')
      })
    } else {
      console.log('fetchjson', json)
      // event.emit('fetched')
      event.emit('fetched')
      isFetching = false
      if (!json.data) {
        return
      }
      // } else {
      if (json.data.length > 0) {
        proxyCaches.free = []
      }
      json.data = json.data.map(d => {
        const other = {}
        if (d.IP) {
          other.expire_time = d.ExpireTime
          // other.expired_at = Date.now() + (t === 2 ? 3 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000)
          other.expired_at = Math.min(Date.parse(other.expire_time), Date.now() + (t === 3 ? 6 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000))

          const [ip, port] = d.IP.split(':')
          other.ip = ip
          other.port = port
          other.isJL = true
        } else {
          other.isJL = false
        }
        return {
          ...d,
          timeType: t,
          ...other
        }
      })

      json.data.forEach(d => {
        proxyCaches.free.push({
          ...d,
          accounts: [],
          timeType: t,
          // timeType: tryTime > 4 ? 1 : 2,
          expired_at: Date.parse(d.expire_time)// .getTime()
        })
      })

      const proxies = json.data.filter(d => !excludes.includes(d.ip)).map(d => {
        return {
          ...d,
          timeType: t,
          // isJL: json.isJL,
          created_time: new Date(),
          // timeType: tryTime > 4 ? 1 : 2,
          expired_at: Math.min(Date.parse(d.expire_time), Date.now() + (t === 3 ? 6 * 60 * 60 * 1000 : 3 * 60 * 60 * 1000))
        }
      }).sort((x, y) => x.expired_at > y.expired_at ? 1 : -1).filter(x => x.expired_at > Date.now() + ([0.3, 0.3, 2, 4.5][x.timeType] || 2) * 3600 * 1000)
      console.log('proxies', JSON.stringify(json.data), JSON.stringify(proxies))
      if (proxies.length === 0) {
        // console.log('22222222222222没有代理。。。。。。')
        return delay(1500).then(() => fetchProxy({ key, province_code, city_code, excludes, urls, tryTime: tryTime + 1, timeType }))
      }
      // console.log('fetchCaches', proxyCaches)
      return getValidProxy(proxies, urls).then((proxy) => {
        // console.log('没有代理。。。。。。', proxy)
        if (!proxy) {
          return delay(1500).then(() => {
            // console.log('再次获取')
            return fetchProxy({ key, province_code, city_code, timeType, urls, tryTime: tryTime + 1, excludes })
          })
        }
        console.log('get proxy -', proxy)
        return proxy
      })
      // return data
    }
  })
}

const getValidProxy = (proxies, urls) => {
  return Promise.all(proxies.map((proxy) => {
    return checkProxy(proxy)
  })).then(() => {
    // console.log('all valid proxy')
    const getValidProxy = (proxies, urls, index = 0) => {
      if (index > 3) {
        throw new Error('请检查网络问题')
      }
      if (index < proxies.length) {
        const proxy = proxies[index]
        return checkIPValids(`http://${proxy.ip}:${proxy.port}`, urls).then(bool => {
          if (bool) {
            return proxy
          }
          return getValidProxy(proxies, urls, index + 1)
        })
      }
    }
    return getValidProxy(proxies.filter(p => p.valid).sort((x, y) => x.delay > y.delay ? 1 : -1), urls)
  })
}

// module.exports.getProxy = getProxy
export default {
  getProxy: (key, opts = {}) => utils.lock(`proxy:${key}`, () => getProxy(key, opts)),
  deleteProxy,
  isProxyEnabled
}
// window.getProxy = getProxy
