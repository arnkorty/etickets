const path = require('path')
export const dataDir = process.env.DATA_DIR || path.resolve(__dirname, '../data')

export const browsersDataDir = path.resolve(dataDir, 'browsers')
// export const staticPort = 11111
export const staticHostUrl = `/data/`

const isWin = process.platform.toLowerCase().includes('win')

let userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
if (isWin) {
  userAgent = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36'
}

export const pcUserAgent = userAgent

export const initPage = () => {
  Object.defineProperty(navigator, 'webdriver', {
    get: function() {
      return false
    }
  })

  Object.defineProperty(navigator, 'doNotTrack', {
    get: function() {
      return null
    }
  })

  Object.defineProperty(navigator, 'languages', {
    get: function() {
      return ['zh-CN']
    }
  })

  Object.defineProperty(navigator, 'language', {
    get: function() {
      return 'zh-CN'
    }
  })

  Object.defineProperty(navigator, 'vendor', {
    get: function() {
      return 'Apple Computer, Inc.'
    }
  })
  Object.defineProperty(navigator, 'standalone', {
    get: function() {
      return false
    }
  })
}
