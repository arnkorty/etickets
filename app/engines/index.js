const Base = require('../base')
const moment = require('moment')

const ruokuai = require('./ruokuai')

const HOST = 'https://gzfc-ticket.evergrande.com/'

class EvergrandeFC extends Base {
  constructor(username, password, options = {}) {
    super(username)
    this.default_request_options = {
      gzip: true
    }
    this.proxyEnable = true
    // this.proxyEnable = false
    // if(o)
    this.default_headers['user-agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.109 Safari/537.36'
    this.username = username
    this.password = password
    this.options = options
    this.lastLoginTime = 0
  }

  toUrl(path) {
    // this.url.resolve(HOST, path)
    return `${HOST}${path}`
  }
  checkOrLogin() {
    return this.login()
  }
  login(tryTime = 0) {
    console.log('check logsin....')
    if (tryTime > 15) {
      return Promise.reject(new Error('登陆失败'))
    }
    return this.checkStatus().then((isLogin) => {
      if (isLogin) {
        return isLogin
      }
      // return this.get({ uri: this.toUrl('logout.html') }).then(res => {
      const uri = this.toUrl('login.html')
      // console.log('uri', uri)
      return this.get({
        uri
      }).then(doc => {
        // console.log('log............')
        // return
        return this.delay(1000).then(() => this.download(this.toUrl('captcha/login?t=' + Date.now())).then(filepath => {
          // console.log('log0000000000000')
          return ruokuai({
            typeName: `${this.constructor.name}:login`,
            filepath
          }).then(({
            result: rs,
            success: validSuccess
          }) => {
            // console.log('ruokujai....', rs)
            if (!rs) {
              return this.login(tryTime + 1)
            }
            const ps = rs.split(',')
            if (ps.length < 2) {
              return this.login(tryTime + 1)
            }
            const validCode = parseInt(ps[0], 10) - 20
            if (validCode < 5 || validCode > 220) {
              return this.login(tryTime + 1)
            }
            console.log('ruokujai....', rs, validCode)
            return this.post({
              uri: this.toUrl('captcha/login'),
              form: this.qs.stringify({
                v: validCode
              })
            }).then(({
              body: isValid
            }) => {
              // console.log('body.....', isValid)
              if (isValid !== 'true') {
                return this.login(tryTime + 1)
              }
              if (validSuccess) {
                validSuccess()
              }
              console.log('验证码识别成功，准备登录。。。')
              return this.post({
                uri: this.toUrl('login'),
                form: {
                  from: '',
                  userName: this.username,
                  password: this.password,
                  validateResult: validCode,
                  rememberpwd: true
                }
              })
            })
          }).then(() => {
            return this.checkStatus().then((isLogin) => {
              if (isLogin) {
                console.log(this.username, '登录成功')
                return isLogin
              }
              return this.login(tryTime + 1)
            })
          })
        }))
      })
    })
    // })
  }

  getCurrentCustomer() {
    return this.post({
      uri: this.toUrl('getCurrentCustomers')
    }).then(rs => {
      this.log('getCustomer', rs.body)
      // console.log(rs.body)
    })
  }

  checkStatus() {
    return this.post({
      uri: this.toUrl('getCurrentCustomers'),
      isRetry: false,
      followRedirect: false
    }).then(rs => {
      const json = JSON.parse(rs.body)
      this.log('check user status', json)
      // console.log('check user status', json)
      return json.result.code === 0
    }).then(isLogin => {
      if (isLogin) {
        this.lastLoginTime = Date.now()
      }
      return isLogin
    }).catch(err => {
      if ([301, 302].includes(err.statusCode)) {
        return false
      }
      throw err
    })
  }
  needCheckLogin() {
    if (this.lastLoginTime > 0 && Date.now() - this.lastLoginTime < 5 * 60 * 1000) {
      return false
    }
    return true
  }

  getProjectId(projectId, ticket_key) {
    if (projectId) {
      this.options.projectId = projectId
      return Promise.resolve(projectId)
    }
    if (this.options.projectId) {
      return Promise.resolve(this.options.projectId)
    } else {
      return this.get({
        uri: this.toUrl('plist.html')
      }).then(rs => {
        const $ = this.cheerio.load(rs.body)

        if (ticket_key) {
          // let id
          $('.ticket').map((i, _ele) => {
            const ele = $(_ele)
          })
        } else {
          const ids = []
          $('.btn.buytic-btn').map((i, ele) => {
            ids.push(ele.attribs.sessionid)
          })
          this.options.projectId = ids[ids.length - 1]
        }
        return this.options.projectId
      })
    }
  }

  getProjectInfo(project_id, ticket_key) {
    console.log('spider....', 'getProjectInfo')
    if (this.options.projectInfo) {
      if (project_id && this.options.projectId === project_id) {
        return Promise.resolve(this.options.projectInfo)
      }
      if (!project_id) {
        return Promise.resolve(this.options.projectInfo)
      }
    }
    return this.getProjectId(project_id, ticket_key).then(() => this.get({
      uri: this.toUrl(`session-${this.options.projectId}.html`)
    }).then(rs => {
      const $ = this.cheerio.load(rs.body)
      const startTime = $('.start-time-class').text().trim()
      const name = $('.user-match-order h2').text().trim()
      const venue = $('.user-match-order .center-li .f-red.f14').text().trim()
      const prices = []
      $('#ticPrice li').map((i, ele) => {
        if (ele.attribs.class && ele.attribs.class.indexOf('closed') > -1) {
          return
        }
        prices.push({
          price: ele.attribs['data-price'],
          id: ele.attribs['price-id']
        })
      })

      if (prices.length === 0) {
        throw new Error('没有票了')
      }

      let ticketStartAt = new Date()
      ticketStartAt.setHours(10)
      ticketStartAt.setMinutes(0)
      ticketStartAt.setSeconds(0)
      ticketStartAt.setMilliseconds(0)
      let m = rs.body.match(/startTime\s=\sDate.parse\("(.+?)"/)
      if (m) {
        ticketStartAt = new Date(m[1])
      }

      let limitBuyCount = 3
      m = rs.body.match(/limitBuyCount\s=\sparseInt\("(\d+)"/)
      if (m) {
        limitBuyCount = parseInt(m[1], 10)
      }

      this.options.projectInfo = {
        ticketEndAt: new Date(startTime.split('星期')[0]),
        startTime,
        name,
        venue,
        priceList: prices,
        ticketStartAt,
        limitBuyCount
      }
      return this.options.projectInfo
    }))
  }

  buy() {
    return this.checkOrLogin().then(() => this.getProjectInfo().then(() => {
      this.log('beginBuy.....', this.options.productInfo)
      this.log('beginBuy.....', this.options.projectInfo.ticketStartAt - new Date())
      const delay = this.options.projectInfo.ticketStartAt - new Date()
      // console.log('delay.....')
      if (delay > 0) {
        if (delay > 5 * 60 * 1000) {
          setTimeout(() => {
            this.checkOrLogin()
          }, delay - 1 * 60 * 1000)
        }
        return this.delay(delay)
      }
    })).then(() => {
      if (this.needCheckLogin()) {
        return this.checkOrLogin()
      }
    }).then(() => this.doBuy())
  }

  doBuy() {
    const now = Date.now()
    return this.checkBuylimit().then(() => {
      return this.confirmOrder().then(rs => {
        return {
          rs,
          result_text: `成功，费时${(Date.now() - now) / 1000}s`
        }
      })
    })
  }

  getBuyNum() {
    if (this.options.buyNum) {
      return this.options.buyNum
    }
    if (this.options.projectInfo.limitBuyCount) {
      return Math.min(this.options.projectInfo.limitBuyCount, 3)
      // return Math.max(creditNum, this.options.projectInfo.limitBuyCount)
    }
    const creditNum = (this.options.credentials || []).filter(l => {
      return l.number && l.name
    }).length || 3
    return creditNum
  }

  confirmOrder(tryTime = 0) {
    return this.get({
      uri: this.toUrl('order/confirmByGeneral?') + this.qs.stringify({
        sessionId: this.options.projectId,
        priceId: this.getBestPrice().id,
        buyNum: this.getBuyNum() || 3
      })
    }).catch(err => {
      if (tryTime < 10) {
        return this.delay(200 + 300 * Math.random()).then(() => this.confirmOrder(tryTime + 1))
      } else {
        throw err
      }
    }).then(rs => {
      const $ = this.cheerio.load(rs.body)
      const addrLi = $('#addressUlList li')
      if (addrLi.length > 0) {
        const districtCode = addrLi[0].attribs['districtcode']
        const addressId = addrLi[0].attribs['addressid']
        return this.getCountExpressFee(districtCode).then(() => {
          return this.createOrder($, rs.body, addressId)
        })
      } else {
        return this.createOrder($, rs.body)
      }
    })
  }

  getCountExpressFee(districtCode) {
    const formRaw = {
      districtCode,
      amountPrice: parseInt(this.getBestPrice().price, 10) * (this.getBuyNum() || 3)
    }
    if (!districtCode) {
      return
    }
    return this.post({
      uri: this.toUrl('order/countExpressFee'),
      form: this.qs.stringify({
        ...formRaw
      })
    })
  }

  createOrder($, doc, addressId) {
    const params = this.getSubmitOrderParams($, doc, addressId)
    this.log('createOrder', params)
    // console.log('params....', params)
    return this.post({
      uri: this.toUrl('order/createOrder'),
      body: JSON.stringify(params),
      headers: {
        'content-type': 'application/json; charset=utf-8'
      },
      ajax: true
    }).then(rs => {
      const json = JSON.parse(rs.body)
      if (json.result.code === 0) {
        return this.get({
          uri: this.toUrl(`/pay/toPay/${json.data.orderNo}?payChannel=ALI_PC_DIRECT`)
        }).then(() => {
          return rs.body
        })
      }
      throw new Error(rs.body)
    }).catch(err => {
      this.log('createOrderErr', err)
      // console.log(err)
    })
  }

  getSubmitOrderParams($, doc, addressId) {
    // console.log(doc)
    let productId, designId, seats
    try {
      productId = doc.match(/productId = '(\d+?)'/)[1]
      // const sessionId = doc.match(/var sessionId = \'(d+?)\'/)[1]
      designId = doc.match(/var designId = '(\d+?)'/)[1]
      seats = doc.match(/var seats = '(.+?)'/)[1]
    } catch (err) {
      const msg = ($('.content').text() || '').trim()
      if (msg) {
        throw new Error(msg)
      }
      throw err
    }
    const priceInfo = []
    if ((this.options.credentials || []).length === 0) {
      this.options.credentials = []
      $('.purchaser-list li').map((i, ele) => {
        const info = {}
        info.name = $(ele).find('.purchaser-name').text().trim()
        info.number = $(ele).find('.p10 .mt5').first().text().trim()
        this.options.credentials.push(info)
      })
      this.options.credentials = this.options.credentials.slice(0, this.getBuyNum())
    }
    if (!this.options.credentials || this.options.credentials.length === 0) {
      throw new Error('购票人信息为空')
    }
    $('.real-name-info-class tr').map((i, e) => {
      priceInfo.push({
        idBtbsCertCode: this.options.credentials[i].number,
        idBtbsCertType: '1',
        idBtbsUserName: this.options.credentials[i].name,
        idBtbsUserPhone: '',
        priceId: this.getBestPrice().id,
        seatId: e.attribs['seat_sid_id'],
        seatInfo: e.attribs['seat_info_id'],
        unitPrice: this.getBestPrice().price

      })
    })
    return {
      addressId,
      deliverIdCard: this.options.id_card,
      deliverName: this.options.contact,
      deliverPhone: this.options.phone,
      deliverSelfType: addressId ? null : 3,
      deliverType: addressId ? '2' : '1',
      orderType: '1',
      product: {
        productId
      },
      productSaleIdBtbsDatas: priceInfo,
      seats,
      session: {
        designId,
        sessionId: this.options.projectId
      },
      userSeatList: JSON.stringify(priceInfo)
    }
  }

  checkBuylimit() {
    return this.get({
      uri: this.toUrl('product/checkBuyLimit?vv=' + moment().format('ddd MMM DD HH:mm:ss GT 08:00 YYYY').replace('GT', 'GMT') + '&productSessionId=' + this.options.projectId),
      ajax: true
    }).then(rs => {
      const json = JSON.parse(rs.body)
      if (json.data.yxgIsBuy === 1) {
        throw new Error('当前用户不满足优先购')
      } else if (json.data.yxgIsBuy === 2) {
        throw new Error('当前时间不在优先购时间内')
      } else if (json.data.yxgIsBuy === 0) {
        throw new Error('当前购物需输入套票信息')
      } else if (json.data === 'noLogin') {
        return this.login()
      } else {
        return json.data.yxgIsBuy
      }
    })
  }

  getBestPrice() {
    if (this.options.price && parseInt(this.options.price)) {
      const pl = this.options.projectInfo.priceList.find(p => parseInt(p.price) === parseInt(this.options.price))
      if (pl) {
        return pl
      }
      throw new Error('没票了，或没有找到匹配的票价')
    }
    return this.options.projectInfo.priceList[0]
  }

  getGames() {
    return this.get({
      uri: 'https://ticket.gzevergrandefc.com/plist.html'
    }).then(rs => {
      const $ = this.cheerio.load(rs.body)
      const arrs = []
      $('.home-content .ticket').map((i, _ele) => {
        const ele = $(_ele)
        const o = {
          options: {}
        }
        o.project_name = ele.find('h2').first().text().trim()
        o.project_id = ele.find('.buytic-btn').attr('sessionid')
        arrs.push(o)
        // o.options.project_start_at =
      })
      return arrs
    })
    // return Promise.resolve(true)
  }
}

module.exports = EvergrandeFC
