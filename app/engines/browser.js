'use strict'

// const puppeteer = require('puppeteer-extra')
import { pcUserAgent } from './config'
import puppeteer from 'puppeteer'
import fs from 'fs'
import path from 'path'

const {
  Touchscreen
} = require('puppeteer/lib/Input')
const delay = (time) => {
  return new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}
Touchscreen.prototype.swipe = async function(x, y, toX, toY, {
  unit = 15,
  delayTime = 0,
  scale = 2
} = {}) {
  await this._client.send('Runtime.evaluate', {
    expression: 'new Promise(x => requestAnimationFrame(() => requestAnimationFrame(x)))',
    awaitPromise: true
  })
  await this._client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{
      x: Math.round(x),
      y: Math.round(y)
    }],
    modifiers: this._keyboard._modifiers
  })
  const dX = toX - x
  const dY = toY - y
  const moveNum = Math.floor(Math.sqrt(dX * dX + dY * dY) / (unit * scale))
  // console.log('moveNum All', moveNum, x, y, toX, toY)
  // await delay(10)
  for (let i = 0; i < moveNum; i++) {
    await (async(i) => {
      // console.log('moveNum i ', i)
      const random = Math.random()
      await this._client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{
          x: Math.round(x + dX * (2 * random + i) / (moveNum)),
          y: Math.round(y + dY * (2 * random + i) / (moveNum))
        }],
        modifiers: this._keyboard._modifiers
      })
      await delay(delayTime + delayTime * (0.5 - random) / 2)
    })(i)
  }

  await this._client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{
      x: Math.round(toX),
      y: Math.round(toY)
    }],
    modifiers: this._keyboard._modifiers
  })

  await this._client.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
    modifiers: this._keyboard._modifiers
  })
}

export const getEvalScript = (playType) => `
var $isWin = navigator.platform.toLowerCase().includes('win')
if (navigator.webdriver) {
  Object.defineProperty(navigator, 'webdriver', {
    get: function() {
      return false
    }
  })
}

if (navigator.doNotTrack) {
  Object.defineProperty(navigator, 'doNotTrack', {
    get: function() {
      return null
    }
  })
}

if (!(navigator.languages || []).includes('zh-CN')) {
  Object.defineProperty(navigator, 'languages', {
    get: function() {
      return ['zh-CN']
    }
  })
}
if (navigator.language !== 'zh-CN') {
  Object.defineProperty(navigator, 'language', {
    get: function() {
      return 'zh-CN'
    }
  })
}

if (navigator.vendor !== ($isWin? 'Google Inc.' : 'Apple Computer, Inc.')) {
  Object.defineProperty(navigator, 'vendor', {
    get: function() {
      return $isWin? 'Google Inc.' : 'Apple Computer, Inc.'
    }
  })
}
if (navigator.standalone) {
  Object.defineProperty(navigator, 'standalone', {
    get: function() {
      return false
    }
  })
}

`

export const launch = async({ custom = {}, ...opts } = {}) => {
  const browser = await puppeteer.launch({
    // devtools: true,
    userAgent: pcUserAgent,
    defaultViewport: {
      height: 900,
      width: 1300
    },
    headless: false,
    ...opts,
    devtools: false,
    // devtools: true,
    timeout: 1000 * 60,
    args: [
      // '--no-sandbox', '--disable-setuid-sandbox',
      '--allow-insecure-localhost',
      '--allow-running-insecure-content',
      '--disable-media-suspend',
      ...opts.args
    ]
    // executablePath: '/Users/arnkorty/code/puppeteer-extra/packages/puppeteer-extra-plugin-flash/node_modules/puppeteer/.local-chromium/mac-526987/chrome-mac/Chromium.app' // '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  })
  // const newPage = browser.newPage
  browser.on('targetcreated', async(target) => {
    // console.log('targetcreated ..... jfjjjjjjjjjjjjjj')
    await target.page().then(async page => {
      // console.log('jfjjjjjjjjjjjjjj')
      if (page) {
        console.log('createTargetCreated')
        // page.setUserAgent(pcUserAgent)
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'zh-CN,zh;q=0.9'
        })
        await page.emulate({
          userAgent: pcUserAgent,
          viewport: {
            height: 900,
            width: 1300
          }})
        page.on('load', () => {
          console.log('page is on load', page.url())
          page.evaluateOnNewDocument(getEvalScript(custom.playType))
        })
        await page.evaluateOnNewDocument(getEvalScript(custom.playType))
        page.on('dialog', (dialog) => {
          setTimeout(() => {
            dialog.dismiss()
          }, 3000)
        })
      }
    })
  })
  return browser
}
