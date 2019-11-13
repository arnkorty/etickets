const url = require('url')
const path = require('path')
const fs = require('fs')
const rp = require('request-promise')
const cheerio = require('cheerio')

const fetch = require('node-fetch')
// const base64 = require('base64')
const qs = require('querystring')

// const logger = require('../logger')

// const Proxy = require('../proxy')

const Event = require('events')

const FileCookieStore = require('tough-cookie-filestore')

import moment from 'moment'
// const utils = require('../utils')
import utils from '../utils'

import proxy from '../proxy'
// const captchaSolver = require('../captcha_solvers')

// import { staticHostUrl } from '../config' // '../../../config'

import {
  launch,
  // evalScript
} from './browser'

const dataDir = config.dataDir // process.env.DATA_DIR || path.resolve(__dirname, '../../data')

// (
// () => {
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true
  })
}
// }
// )()

const captchaDir = (() => {
  const directory = path.resolve(dataDir, 'captchas')
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    })
  }
  return directory
})()

const EXCLUDE_HEADER_KEYS = [
  'Content-Length', 'Cookie', 'Host', 'Origin', 'Access-Control-Allow-Headers', 'Access-Control-Allow-Methods',
  'Access-Control-Allow-Origin', 'Date', 'ETag', 'Server', 'Transfer-Encoding', 'Vary', 'if-none-match', ':path',
  ':method'
].map(l => l.toLowerCase())

class Base {
  constructor(username) {
    // const storeFile = getCookiesFile(`${this.constructor.name}-${username}`)
    // const cookieKey = `${this.constructor.name}-${username}`
    // console.log(storeFile)
    // const store = new RedisCookieStore(cookieKey, { redis: redis })
    // } catch (err) {
    // console.error(err)
    this.qs = qs
    // this.redis = redis
    // this.store = store
    this.utils = utils
    this.username = username
    // this.captchaSolver = captchaSolver(utils.lowerCase(this.constructor.name))
    this.cacheHTTPGet = Cache.httpGet

    // this.proxyEnable = proxy.isProxyEnabled()
    // this.jar = rp.jar(store)
    // this.request = rp.defaults({ jar: this.jar })
    this.fetch = fetch
    this.url = url
    this.path = path
    this.maxRetry = 10
    this.currentRetry = 0
    this.default_request_options = {}
    this.cheerio = cheerio
    this.event = new Event()
    this.logger = logger({
      platform: this.constructor.name,
      username: this.username
    })
    // this.host = 'm.damai.cn'
    this.protocol = 'https'
    // this.cookie_domains = ['damai.cn']
    // this.exclude_header_keys = ['Content-Length', 'Host', 'Cookie', 'Access-Control-Allow-Headers', '']
    this.default_headers = {
      // 'Referer': this.currentUrl,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      // Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Encoding': 'gzip, deflate',
      'Accept-Language': 'zh-CN,zh;q=0.9',
      'Cache-Control': 'max-age=0',
      'User-Agent': config.pcUserAgent, // 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1',
      Connection: 'keep-alive'
      // ...this.headers()
    }
    // super(arguments[0])
    if (arguments.length === 3) {
      this.password = arguments[1]
      this.options = arguments[2]
    } else if (arguments.length === 2) {
      if (typeof arguments[1] === 'string') {
        this.password = arguments[1]
      } else {
        this.options = arguments[1]
      }
    }
    this.timeoutTimers = []
    // this.proxyExcludes = []

    this.initRequest()

    console.log('engine.....', this)
  }

  static init() {
    const instance = new this(...arguments)
    return instance.init().then(() => instance)
  }

  isMobile() {
    return this.options && this.options.is_mobile
  }

  isProxyEnabled() {
    return proxy.isProxyEnabled() && !((this.state && this.state.get('no_proxy')) || this.options.no_proxy || (this.getConfig && this.getConfig().no_proxy))
  }

  isOnlyApplyProxyEnabled() {
    return this.options.only_apply_proxy_enable || this.state.get('only_apply_proxy_enable') || this.getConfig().only_apply_proxy_enable || C.getConfigs().only_apply_proxy_enable // || CDATASection.
  }

  init() {
    return Promise.resolve().then(() => {
      if (this.getAccessHosts) {
        const uris = this.getAccessHosts()
        return Promise.all(uris.map(uri => {
          if (!uri) {
            return true
          }
          return rp({
            uri,
            timeout: 5000,
            strictSSL: false
          }).then(() => true).catch((err) => {
            this.log('check uri', uri, err)
            return false
          })
        })).then(results => {
          if (results.length === uris.length) {
            return true
          }
          this.sendMail({
            subject: '当前平台的URL存在访问异常',
            content: `
              ${uris.join(' ')}
              ${results.join(' ')}
            `
          })
          this.close()
          throw new Error('当前平台可能会存在网络问题')
        })
      }
    }).then(() => {
      if (this.store && this.store.init) {
        return this.store.init()
      }
    }).then(() => {
      return this.initOriginHeaders()
    }).then(r => {
      if (this._init) {
        return this._init()
      }
      return r
    })
  }

  pageReload(page) {
    return page.reload().then(() => {
      page.updated_at = Date.now()
      return page
    })
  }

  async goto(page, url, {
    tryTimes = 0,
    check,
    ...opt
  } = {}) {
    // this.log('goto url', url, opt)
    // url = this.toUrl(url)
    this.state.updateLiving()
    url = await this.getFullUrl(url)
    this.log('goto url', url, opt)
    return page.goto(url, {
      waitUntil: 'domcontentloaded',
      ...opt
    }).then(async () => {
      if (this.proxyConfig) {
        const isProxyEnabled = await page.evaluate(() => {
          return !['407 Proxy Authentication Required', '502 Bad Gateway'].includes(document.title)
        })
        if (!isProxyEnabled) {
          this.sendMail({
            subject: '当前代理已过期',
            content: `
              ${JSON.stringify(this.proxyConfig)}
            `
          })
          this.changeProxy()
          throw new Error('代理已经过期！！！')
        }
      }
      if (await page.evaluate(() => !!document.querySelector('html[ng-app="blockApp"]'))) {
        this.sendMail({
          subject: '该IP已被禁止',
          content: `${JSON.stringify(this.proxyConfig)}`
        })
        this.changeProxy()
        // this.close()
        throw new Error('账号被停用，请确认或手工处理')
        // return
      }
      // if (this.bestServiceUrl && this.setLoginStatusAndClosePage && page.url().includes(this.bestServiceUrl)) {
      //   return this.setLoginStatusAndClosePage(page, false).then(() => page)
      //   // return this (page).then(() => page)
      // }
      page.update_at = Date.now()
      if (check) {
        if (check(page)) {
          return page
        } else {
          if (tryTimes > 10) {
            this.sendMail({
              subject: '获取路线地址异常',
              content: '获取路线地址异常，请配置路线地址重试！！'
            })
            throw new Error('获取路线地址异常，请配置路线地址重试！！')
          }
          return this.delay(3000).then(() => {
            return this.goto(page, url, {
              tryTimes: tryTimes + 1,
              check,
              ...opt
            })
          })
        }
      } else {
        return page.title().then((title) => {
          if (title && title.includes('合并')) {
            if (tryTimes > 10) {
              this.sendMail({
                subject: '获取路线地址异常',
                content: '获取路线地址异常，请配置路线地址重试！！'
              })
              throw new Error('获取路线地址异常，请配置路线地址重试！！')
            }
            return this.delay(3000).then(() => {
              return this.goto(page, url, {
                tryTimes: tryTimes + 1,
                ...opt
              })
            })
          }
          return page
        })
      }
    }).catch(err => {
      // this.bestServiceUrl = null
      if (this.homePage) {
        this.pageClose(this.homePage, 0)
        this.homePage = null
      }
      if (err.message.includes('net') && this.proxyConfig && this.proxyConfig.ip && tryTimes < 3) {
        // if (this.isProxyEnabled() && !this.isOnlyApplyProxyEnabled()) {
        //   // this.proxyExcludes.push(this.proxyConfig.ip)
        //   this.addExcludeProxyIp(this.proxyConfig.ip)
        // }
        return this.checkCurrentProxy().then(bool => {
          if (!bool) {
            if (this.isProxyEnabled() && !this.isOnlyApplyProxyEnabled()) {
              // this.proxyExcludes.push(this.proxyConfig.ip)
              this.addExcludeProxyIp(this.proxyConfig.ip)
              this.proxyConfig = null
            }
          } else {
            this.addExcludeServiceUrl(this.bestServiceUrl)
          }
          this.bestServiceUrl = null
          return this.closeBrowser(0).then(() => this.delay(2000)).then(() => {
            return this.checkOrInitProxy({
              isBrowser: true
              // reforce: true
            }).then(() => this.getPage().then(page => {
              return this.goto(page, opt.luxian ? url : this.url.parse(url).path, {
                tryTimes: tryTimes + 1,
                ...opt
              })
            }))
          })
        })
        // return this.closeBrowser(0).then(() => this.delay(2000)).then(() => {
        //   return this.checkOrInitProxy({
        //     isBrowser: true,
        //     reforce: true
        //   }).then(() => this.getPage().then(page => {
        //     return this.goto(page, url, { tryTimes: tryTimes + 1, ...opt })
        //   }))
        //   // })
        // })
      } else {
        this.bestServiceUrl = null
      }
      if (tryTimes < 2) {
        this.closeBrowser(0)
        setTimeout(() => {
          this.deleteUserDataDir()
        }, 8000)
        // this.deleteUserDataDir()
        return this.delay(30000).then(() => this.goto(page, opt.luxian ? url : this.url.parse(url).path, {
          tryTimes: tryTimes + 1,
          check,
          ...opt
        }))
      }
      this.log('浏览器网络或代理异常。。。')
      this.sendMail({
        subject: '浏览器网络或代理异常',
        content: `
          ${url}
          ${(this.getExcludeProxyIps()).join(' ')}
          ${this.getProxyUrl() ? this.getProxyUrl() : ''}
          浏览器网络或代理异常, 已重试 ${tryTimes + 1} 次。
        `
      })

      this.changeProxy()
      // this.close()
      // starting
      // this.close({ reforce: true })
      // this.close({ reforce: true })
      // window.$closeEngine(this.options)
      // // return
      // // if (this.state.get('starting') && (this.state.get('status.restart_count') || 0) < 3 || (!this.state.get('status.restart_at') || this.state.get('status.restart_at') < Date.now() - 20 * 60 * 1000)) {
      // //   if (window.$restartEngine) {
      // //     this.state.incr('status.restart_count', 1)
      // //     this.state.incr('status.restart_at', Date.now())
      // //     window.$restartEngine(this.options)
      // //   }
      // // } else {
      // //   if (window.$closeEngine) {
      // window.$closeEngine(this.options)
      //   }
      // }
      // this.close()
      // console.log('网络或代理异常。。。')
      throw err
    })
  }

  deleteUserDataDir(path = null) {
    if (!path) {
      path = this.getBrowserDataDir()
    }
    if (fs.existsSync(path)) {
      fs.readdirSync(path).forEach((file, index) => {
        const curPath = path + '/' + file
        if (fs.lstatSync(curPath).isDirectory()) { // recurse
          this.deleteUserDataDir(curPath)
        } else { // delete file
          // console.debug('delete', curPath)
          fs.unlinkSync(curPath)
        }
      })
      fs.rmdirSync(path)
    }
  }

  getProxyKey() {
    // if (this.options.bank_id) {
    return `proxy-${this.constructor.name}-${this.username}`
    // }
    // return `${this.constructor.name}-${this.username}`
  }

  getProxyParams() {
    let params = {
      timeType: 2
    }
    return params
  }

  initProxy() {
    // debugger
    if (this.isProxyEnabled() || this.isOnlyApplyProxyEnabled()) {
      if (this.options.http_proxy || (this.options.bank && this.options.bank.http_proxy)) {
        this.proxyConfig = {
          url: this.options.http_proxy || (this.options.bank && this.options.bank.http_proxy)
        }
        return Promise.resolve()
      }
      this.log('start init Proxy')
      return proxy.getProxy(this.getProxyKey(), {
        excludes: this.getExcludeProxyIps(),
        hostUrl: this.getBaseURL(),
        ...this.getProxyParams(),
        timeType: this.getProxyType(), // (this.$$only_check_signin || this.isOnlyApplyProxyEnabled()) ? 1 : 2,
        urls: this.getAccessHosts()
      }).then(rs => {
        this.log('end init Proxy ' + JSON.stringify(rs))
        if (!rs) {
          this.sendMail({
            subject: '获取代理失败',
            tag: 'alert',
            content: `
              ${this.getAccessHosts().join(' ')}
            `
          })
          this.close()
          throw new Error('获取代理失败！！！')
          // return this.initRequest()
        }
        this.proxyConfig = rs
      })
    }
    return Promise.resolve()
  }

  getKey() {
    if (this.$key) {
      return this.$key
    }
    this.$key = `${this.constructor.name.toLowerCase()}:${this.username}`
    return this.$key
  }

  getProxyUrl() {
    if (this.options && this.options.http_proxy || (this.options && this.options.bank && this.options.bank.http_proxy)) {
      return this.options.http_proxy || this.options.bank.http_proxy
    }
    if ((this.isProxyEnabled() || this.isOnlyApplyProxyEnabled()) && this.proxyConfig) {
      return `http://${this.proxyConfig.ip}:${this.proxyConfig.port}`
    }
    // if(this.options.htt)
  }

  getJarConfigFile() {
    const directory = path.resolve(dataDir, 'cookies') // , `${this.constructor.name}-${this.username}`)
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, {
        recursive: true
      })
    }
    const filePath = path.resolve(directory, `${this.constructor.name}-${this.username}.json`)
    if (fs.existsSync(filePath)) {
      try {
        JSON.parse(fs.readFileSync(filePath))
      } catch (_) {
        fs.unlinkSync(filePath)
        fs.writeFileSync(filePath, '')
      }
    } else {
      fs.writeFileSync(filePath, '')
    }
    return filePath
  }

  initRequest() {
    // if (this.isInitedRequest) {
    //   return Promise.resolve()
    // }
    // const cookieKey = `${this.constructor.name}-${this.username}`

    // this.store = new RedisCookieStore(cookieKey, {
    //   redis: redis
    // })
    // const timer = setTimeout(() => {
    //   this.
    // })
    this.store = new FileCookieStore(this.getJarConfigFile())
    this.jar = rp.jar(this.store)
    this.request = rp.defaults({
      jar: this.jar,
      strictSSL: false
    })
    // if (this.isProxyEnabled() && this.getProxyUrl()) {
    //   this.proxy_request = rp.defaults({
    //     jar: this.jar,
    //     strictSSL: false,
    //     proxy: this.getProxyUrl() || process.env.HTTP_PROXY
    //   })
    // }
    return this.delay(200)
  }

  checkOrInitProxy({
    isBrowser,
    reforce
  } = {}) {
    // debugger
    if (
      isBrowser ? (this.isProxyEnabled() && !this.isOnlyApplyProxyEnabled()) : (this.isProxyEnabled() || this.isOnlyApplyProxyEnabled())
    ) {
      if (!reforce && this.proxyConfig && this.proxyConfig.expired_at > Date.now() + 60 * 1000) {
        return Promise.resolve({
          proxy: this.getProxyUrl()
        })
      }
      return this.initProxy().then(() => {
        if (this.getProxyUrl()) {
          return {
            proxy: this.getProxyUrl()
          }
        }
      })
    }
    return Promise.resolve(null)
  }

  // getRequest({ proxy = false }) {
  //   // if (proxy) {
  //   //   return this.request
  //   // }
  //   // if (this.pure_request) {
  //   //   return this.pure_request
  //   // }
  //   return this.request
  // }

  getHeadlessBrowser(headless = true) {
    return this.getBrowser()
  }

  getBrowser() {
    this.log('begin get Browser')
    return this.utils.lock(this.getKey() + ':browser', () => this._getBrowser().then(() => {
      this.browser.updated_at = Date.now()
      if (this.browser.closeAt || this.browser.isClosed) {
        this.browser.closeAt = null
        this.browser.isClosed = false
      }
      return this.browser
      // this.
    }))
  }

  getBrowserDataDir() {
    return path.resolve(config.browsersDataDir, `${this.constructor.name.toLowerCase()}/${this.username}`)
  }

  async _getBrowser() {
    // if (tryTime > 3) {
    //   return Promise.reject(new Error('启动浏览器失败'))
    // }
    this.log('running in get Browser action', this.browser)
    if (this.browser && this.browser.version && await this.browser.version()) {
      return Promise.resolve(this.browser)
    } else {
      return this.utils.ctrlLock(this.getKey()).then(async (ctrlLock) => {
        this.log('running in get Browser local lock', this.browser, ctrlLock)
        this.ctrlLock = ctrlLock
        const userDataDir = this.getBrowserDataDir()
        const args = []
        await this.checkOrInitProxy({
          isBrowser: true
        })
        // console.log('.de....', this.isProxyEnabled(), this.isOnlyApplyProxyEnabled(), this.getProxyUrl())
        // debugger
        if (this.isProxyEnabled() && !this.isOnlyApplyProxyEnabled() && this.getProxyUrl()) {
          const uri = this.url.parse(this.getProxyUrl())
          args.push(`--proxy-server=${uri.hostname}:${uri.port || 80}`)
          console.log('args....', args)
        }
        if (this.proxyConfig && this.proxyConfig.expired_at) {
          setTimeout(() => {
            if (this.browser && !this.isClosed()) {
              this.sendMail({
                tag: 'alert',
                subject: 'IP过期',
                content: `${JSON.stringify(this.proxyConfig)}`
              })
              this.changeProxy()
              // this.proxyConfig = null
            }
          }, this.proxyConfig.expired_at - Date.now())
        }
        return launch({
          headless: false,
          devtools: this.isTest ? this.isTest() && (this.isNew ? !this.isNew() : true) : false,
          custom: {
            playType: this.getPlayType()
            // isDzxx: this.isDzxx()
          },
          // headless: this.isHeadless !== false,
          userDataDir,
          args
        }).catch(err => {
          console.log(err)
          const userDataDir = path.resolve(dataDir, `tmps/${this.constructor.name}/${this.username}-${this.utils.randomHex(4)}`)
          return launch({
            headless: false,
            userDataDir,
            devtools: this.isTest ? this.isTest() && (this.isNew ? !this.isNew() : true) : false,
            args
          })
        }).then(browser => {
          // this.isHeadless = headless
          this.browser = browser
          this.browser.isHeadless = this.isHeadless
          this.browser.key = `${this.options.platform}:${this.username}`
          if (!window.cacheBrowsers) {
            window.cacheBrowsers = []
          }
          // browser.getMaster = () => this
          window.cacheBrowsers.push(browser)

          // const newPage = browser.newPage
          // browser.newPage = async() => {
          //   const page = await newPage.call(browser)
          //   await this.setPageCookies(page)
          //   return page
          // }
          browser.on('disconnected', () => {
            this.browser = null
          })
          return browser
        })
      })
    }
  }
  closeBrowser(delay = 30 * 1000) {
    if (this.browser) {
      this.browser.isClosed = true
      // const closeDelay = 30 * 1000
      this.browser.closeAt = Date.now() + delay
      // this.browser.isClosed = true
      const doClose = () => {
        if (this.ctrlLock && this.ctrlLock.release) {
          this.ctrlLock.release(this.getKey())
          delete this.ctrlLock
          // this.
        }
        if (this.browser && this.browser.isClosed) {
          return this.browser.close().then(() => {
            let countIndex = 0
            window.cacheBrowsers.forEach((cache) => {
              const key = `${this.options.platform}:${this.username}`
              if (cache.key === key) {
                if (!cache.closeAt || Date.now() - cache.closeAt < 36 * 1000) {
                  cache.close()
                  // setTimeout(() => {
                  // const index = window.cacheBrowsers.findIndex(ce => ce === cache)
                  // window.cacheBrowsers.splice(index, 1)
                  // }, (1 + countIndex * 1) * 1000)
                }
                // else {
                // setTimeout(() => {
                const index = window.cacheBrowsers.findIndex(ce => ce === cache)
                window.cacheBrowsers.splice(index, 1)
                // }, (countIndex + Math.random()) * 1000)
                // }
              }
              countIndex = countIndex + 1
            })
            this.browser = null
          })
        }
      }
      if (delay <= 0) {
        doClose()
      } else {
        setTimeout(() => {
          doClose()
        }, delay)
      }
      // return this.browser.close().then(() => {
      // this.browser = null
      return Promise.resolve(true)
      // })
    } else {
      return Promise.resolve(true)
    }
  }

  getPage() {
    return this._getPage()
    // return this.utils.releaseDo('autoPlay', this._getPage.bind(this))
  }

  _getPage() {
    return this.getBrowser().then(browser => {
      return browser.newPage()
    }).then(async page => {
      page.setDefaultNavigationTimeout(180 * 1000)
      // await page.evaluateOnNewDocument(evalScript)
      return page
    })
  }

  dynamicHeaders() {
    if (this.currentUrl) {
      return {
        Referer: this.currentUrl
      }
    }
    return {}
  }

  getHeaders() {
    return {
      ...(this.hasOriginHeaders ? this.validOriginHeaders : this.default_headers),
      ...this.dynamicHeaders()
      // ...this.getForceOriginHeaders()
    }
  }

  getExcludeHeaderKeys() {
    return [
      ...EXCLUDE_HEADER_KEYS,
      ...(this.default_exclude_header_keys || [])
    ]
  }

  getProxyHeaders() {
    // if (this.proxyEnable) {
    //   if (!this.proxyHeader) {
    //     const secret = Buffer.from('471877445@qq.com:fufreedom7').toString('base64')
    //     this.proxyHeader = {
    //       'Proxy-Authorization': `Basic ${secret}`
    //     }
    //   }
    //   return this.proxyHeader
    // }
    return {}
  }

  getHost() {
    // return '请求网站的主机'
    return this.host
  }

  getCookieDomains() {
    return this.cookie_domains || []
  }

  getProtocol() {
    return this.protocol || 'https'
  }

  getHostUri() {
    return `${this.getProtocol()}://${this.getHost()}`
  }

  toUrl(uri) {
    let baseUrl = this.getHostUri()
    if (this.bestServiceUrl) {
      baseUrl = this.bestServiceUrl
    }
    return this.url.resolve(baseUrl, uri)
  }

  log(...contents) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(moment().format('HH:mm:ss.SSS'), this.constructor.name, this.username, ...contents)
    }
    this.logger.info({
      s: contents
    })
    // console.log(this.username, new Date(), ...arguments)
  }

  get(args) {
    return this.http(args)
  }

  post(args) {
    // console.log('post args...', args)
    return this.http({
      ...args,
      method: 'POST'
    })
  }

  http({
    showLog = true,
    ...args
  } = {}) {
    if (showLog) {
      this.log('start http', args.method || 'get', args.uri)
    }
    return this.baseHttp(args).then(r => {
      // console.log(r.request.headers)
      if (r && r.body && showLog) {
        this.log('end http', args.method || 'get', args.uri, r.body.split('\n')[0])
      }
      // this.log('end http', args.method || 'get', args.uri, r.headers, this.getCookies())
      return r
    })
  }

  baseHttp({
    uri,
    method = 'GET',
    useToken,
    params = {},
    headers = {},
    ajax,
    proxy,
    isRetry = true,
    followRedirect = true,
    tryTimes = 0,
    ...other
  }) {
    if (ajax && !headers['Accept']) {
      headers['Accept'] = 'application/json, text/plain, */*'
    }
    const rqHeaders = {
      // ...this.originHeaders,
      ...this.getHeaders(),
      ...this.getProxyHeaders(),
      // ...this.dynamicHeaders(),
      ...headers
      // ...this.getForceOriginHeaders()
    }
    // this.log(rqHeaders)
    if (ajax) {
      rqHeaders['X-Requested-With'] = 'XMLHttpRequest'
    }
    if (useToken && this.__RequestVerificationToken) {
      rqHeaders['c02b5'] = this.__RequestVerificationToken
    }
    if (!rqHeaders['Origin']) {
      const u = this.url.parse(uri)
      rqHeaders['Origin'] = `${u.protocol}//${u.host}`
    }
    const requestOptions = {
      method,
      uri,
      resolveWithFullResponse: true,
      gzip: true,
      ...params,
      headers: rqHeaders,
      ...this.default_request_options,
      ...other
    }
    // console.log('userToken', useToken, this.__RequestVerificationToken, other)
    // console.log('rqHeaders....', rqHeaders)
    // console.log(requestOptions)
    return this.checkOrInitProxy({
      proxy,
      isBrowser: other.isBrowser
    }).then((proxyOpts) => this.request({
      ...requestOptions,
      ...proxyOpts
    }).then(res => {
      if (!ajax) {
        this.currentUrl = uri
      }
      this.currentRetry = 0
      return res
    }).catch(err => {
      // fs.writeFileSync('/Users/arnkorty/tmp.html', err.error)
      if (tryTimes < 3 && uri.includes('play')) {
        return this.baseHttp({
          uri: uri,
          headers,
          method,
          useToken,
          params,
          ajax,
          isRetry,
          proxy,
          tryTimes: tryTimes + 1,
          ...other
        })
      }
      console.log('request err', uri, err, err.name, this.proxyConfig)
      throw err
      // }
    }))
  }

  getRedisHeadersKey() {
    const headersKey = `headers:${this.constructor.name}-${this.username}`
    return headersKey
  }

  getCookies() {
    return Object.values(this.store.idx).reduce((prev, curr) => {
      Object.values(curr).forEach(cks => {
        Object.assign(prev, cks)
      })
      return prev
    }, {})
  }

  getCookieValue(key) {
    const cookies = this.getCookies()
    if (cookies[key]) {
      return cookies[key].value
    }
  }

  delay(mileseconds = 0) {
    return utils.delay(mileseconds)
  }

  initOriginHeaders() {
    if (!this.originHeaders) {
      return {}
      // return this.redis.get(this.getRedisHeadersKey()).then(result => {
      //   if (result) {
      //     this.forceLogin(result)
      //   } else {
      //     this.originHeaders = {}
      //   }
      //   return this.originHeaders
      // })
      // if(fs.existsSync)
    } else {
      return Promise.resolve(this.originHeaders)
    }
  }
  getDataDir() {
    return dataDir
  }

  download(uri, {
    tryTime = 0,
    headers = {},
    ...other
  } = {}) {
    return new Promise((resolve, reject) => {
      // const oldCs = this.getCookies()
      // console.log('cookiessssssssssssssssssssssssssssss', this.getCookies())
      // console.lok
      const captchaPath = path.resolve(captchaDir, `${this.constructor.name}-${this.username}-code.png`)
      return this.request({
        uri,
        headers: {
          ...this.getHeaders(),
          ...headers
        },
        ...this.default_request_options,
        ...other
        // gzip: true
      }).pipe(fs.createWriteStream(
        captchaPath
      )).on('close', (rs) => {
        // console.log('download....', rs)
        resolve(captchaPath)
      })
    }).then(path => {
      // console.log(path, tryTime)
      const res = fs.readFileSync(path, {
        encoding: 'utf8'
      })
      if (res.includes('<html>')) {
        this.log('验证码保护。。。。', path)
        // console.log('res...', tryTime, res)
        const matches = res.match(/<script .+window.location=(.+)([\s\S]*)<\/script>/)
        if (matches && tryTime < 3) {
          try {
            // eslint-disable-next-line
            const url = eval(matches[1])

            return this.download(this.url.resolve(uri, url), {
              tryTime: tryTime + 1,
              headers,
              ...other
            })
            // return this.checkRq({
            //   ...opts,
            //   uri: this.url.resolve(opts.uri, uri),
            //   tryTime: tryTime + 1
            // })
          } catch (err) {
            throw err
            // throw new Error(err)
          }
        }
        throw new Error(`检查验证码图片 ${path}`)
      }
      return path
    })
  }

  setPuppeteerCookies(cookies) {
    // console.log('getCookiesDomains', this.getCookieDomains(), cookies)
    // 启动浏览器时，不设定 cookies
    // this.getCookieDomains().forEach(domain => {
    //   cookies.forEach(c => {
    //     const cookie = rp.cookie(`${c.name}=${c.value}` + `;Path=/;Domain=${domain};Max-Age=604800`)
    //     // console.log('setPuppeteerCookie', cookie, domain, this.jar)
    //     this.jar.setCookie(cookie.toString(), this.getHostUri())
    //   })
    // })
  }

  async setPuppeteerCookiesToRq(page, url) {
    // console.log('url.....', url)
    // debugger
    // await this.utils.delay(5000)
    const cookies = await page.cookies(url)
    // console.log('cookies.....', cookies)
    const uri = this.url.parse(url)
    cookies.forEach(c => {
      const cookie = rp.cookie(`${c.name}=${c.value}` + `;Path=/;Domain=${uri.host};Max-Age=604800`)
      // console.log('setPuppeteerCookie', cookie, domain, this.jar)
      this.jar.setCookie(cookie.toString(), url)
    })
  }

  clearCookies() {
    // const cookieKey = `${this.constructor.name}-${this.username}`
    // return redis.del(cookieKey).then(() => {
    //   this.initRequest()
    //   return this.delay(100)
    //   // this.store = new RedisCookieStore(cookieKey, { redis: redis })
    //   // this.jar = rp.jar(this.store)
    //   // this.request = rp.defaults({
    //   //   jar: this.jar
    //   // })
    // })
  }

  isClose() {
    return this.isClosed
  }

  close({
    reforce,
    delay = 0
  } = {}) {
    const $close = () => {
      if (!this.isClosed) {
        setTimeout(() => {
          if (window.$closeEngine) {
            window.$closeEngine(this.options)
          }
        })
      }
      this.isClosed = true
      this.isMoniting = false
      this.timeoutTimers.forEach(timer => {
        clearTimeout(timer)
      })
      if (this.browser) {
        this.closeBrowser(delay)
        // this.browser.close()
      }
      if (reforce) {
        // this.deleteProxy()?
        proxy.deleteProxy(this.getProxyKey())
        setTimeout(() => {
          this.deleteUserDataDir()
        }, 5 * 1000)
      }
    }
    if (this.isPlaying && this.isPlaying()) {
      this.state.clearPlaying()
      if (this.stopPlay) {
        this.stopPlay()
        return this.delay(20 * 1000).then(() => {
          return $close()
        })
      }
    }
    return $close()
  }

  async setPageCookies(page) {
    const _cookies = this.jar.getCookies(this.getHostUri())
    // console.log(_cookies)
    const cookies = _cookies.map(l => {
      return {
        name: l.key,
        value: l.value,
        domain: '.' + l.domain,
        path: l.path,
        // expires: l.expires,
        httpOnly: l.httpOnly,
        session: l.session,
        size: l.size,
        secure: l.secure,
        sameSite: l.sameSite || 'Lax'
      }
    })
    await page.setCookie(...cookies)
  }
  async getLoginCookies(page) {
    // console.log('getLoginCookies', this.getHostUri())
    // window.page = page
    // window.c4 = this
    const cookies = await page.cookies(this.getHostUri())
    // console.log(cookies)
    // console.log('setCookies')
    this.setPuppeteerCookies(cookies)
    // console.log(cookies)
  }

  onCb(obj) {
    if (this.options.onCb) {
      this.options.onCb({
        ...obj,
        platform: this.constructor.name.toLowerCase(),
        username: this.username
      })
    }
  }

  dispatch(funcName, ...args) {
    return this.utils.lock(this.getKey(), this[funcName], ...args)
  }


  changeProxy({
    reforce
  } = {}) {
    proxy.deleteProxy(this.getProxyKey())
    // if (reforce) {
    this.state.set('proxy_type', 2)
    // }
    this.proxyConfig = null
    this.close({
      delay: 0,
      reforce
    })
    return Promise.resolve('已排除当前IP，请15秒后重新启动即可')
  }


  checkUrlsFormTime(uris, opts = {}) {
    // await this.check
    return this.checkOrInitProxy(opts).then(() => Promise.all(uris.map((uri) => this.checkUrlForTime(uri, opts)))).then(tms => {
      // return tms.filter(tm => tm > 0)
      const result = []
      uris.forEach((uri, i) => {
        if (tms[i] > 0) {
          result.push({
            uri,
            tm: tms[i] + (uri.includes('https') ? 0 : 10)
          })
        }
      })
      return result.sort((x, y) => x.tm > y.tm ? 1 : -1)
    })
  }

  checkUrlForTime(uri, opts = {}) {
    return this.checkOrInitProxy(opts).then((rqOpts) => {
      const tm = Date.now()
      this.log('start', uri, tm)
      return this.request(uri, {
        timeout: 5000,
        ...rqOpts
      }).then(() => {
        this.log('end', uri, Date.now())
        return Date.now() - tm
      }).catch((err) => {
        this.log('check', uri, err)
        if (err.message.includes('html')) {
          return Date.now() - tm
        }
        return -1
      })
    }).catch((err) => {
      this.log('check', uri, err)
      return -1
    })
  }

  checkCurrentProxy() {
    if (this.getProxyUrl()) {
      return this.request('http://www.baidu.com', {
        timeout: 2000,
        proxy: this.getProxyUrl()
      }).then(() => true).catch(() => false)
    }
    return Promise.resolve(true)
  }
}

export default Base
// module.exports = Base
