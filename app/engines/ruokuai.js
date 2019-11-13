const rp = require('request-promise')
const utils = require('../utils')

// const cacheKeys = require('../caches').keys
// const logger = require('../../app/logger')

// const filepath = '/Users/ht/Downloads/nodejs 2/captcha_nodejs_2/login.png'

const fs = require('fs')
// const path = require('path')
// const typeMaps = {
//   'EvergrandeFC:login': 6151
// }
module.exports = function ({
  filepath,
  typeName,
  ...other
}) {
  const TYPE = 1310
  // const rp = require('request-promise')
  // const fs = require('fs')

  const username = 'fumes4774'
  const password = 'qwe123QWE'

  // function verify() {
  // const filepath = path.resolve(__dirname, 'img.png')
  // console.log(fs.readFileSync(filepath).toString('base64'))
  const captchaData = fs.readFileSync(filepath).toString('base64') // .split(',')[1]
  // console.log(captchaData)
  return rp.post({
    url: 'https://v2-api.jsdama.com/upload',
    body: JSON.stringify({
      softwareId: 15447,
      softwareSecret: 'NyNi1q8tl1OZxj3oUKrFuQA3VarIg8VXXXNmHgso',
      username,
      password,
      captchaData,
      captchaType: TYPE
    })
  }).then(rs => {
    const json = JSON.parse(rs)
    console.log('verify code result', json)
    if (json.code === 0) {
      const recogn = json.data.recognition
      // const [x] = recogn.split('|')[0].split(',')
      return {
        result: recogn
      }
    }
    return {}
    // if (rs.code ==)
    // console.log('rs....', rs)
  })
  // }
}

// module.exports = function ({ filepath, typeName, ...other }) {
//   console.log('filesss', filepath, typeName)
//   const start = Date.now()
//   const md5Key = utils.md5(fs.readFileSync(filepath))
//   return cacheKeys.get(md5Key).then(value => {
//     if (value) {
//       return value
//     }
//     return rp.post('http://api.ruokuai.com/create.json', {
//       formData: {
//         'username': 'fumes4774',
//         'password': 'a46c18ea3721eb4f77e6b3e28677c574',
//         'typeid': typeMaps[typeName] || '6151',
//         'softid': '120838',
//         'softkey': '171546562b0c45fa99890c29a83d83bb',
//         ...other,
//         'image': fs.createReadStream(filepath)
//         // typeid: ''
//       }
//     }).then(rs => {
//       console.log('.....', rs)
//       logger.info({
//         event: 'ruokuai'
//       }, `ruokuai solve spend ${Date.now() - start} , ${rs}`)
//       const result = JSON.parse(rs).Result
//       return {
//         result,
//         success: () => {
//           cacheKeys.set(md5Key, result)
//         }
//       }
//     }).catch(err => {
//       console.log('err', err)
//       throw err
//     })
//   })
// }

// // const common = require('../../services/common')
// // const OcrLib = require('baidu-aip-sdk').ocr
// // const bdRpCaches = {}

// // let curIncr = 0

// // class Ruokuai {
// //   constructor (options = {}) {
// //     this.options = options
// //   }

// //   solve (image) {
// //     return this.getBaiduAccount().then(account => {
// //       // console.log('baidu account .....', account)
// //       if (!bdRpCaches[account.appId]) {
// //         bdRpCaches[account.appId] = new OcrLib(
// //           account.appId,
// //           account.appKey,
// //           account.secretKey
// //         )
// //       }
// //       const ocr = bdRpCaches[account.appId]
// //       // console.log('ocr....|||||||||||||||', ocr)
// //       return ocr[this.ocrType](typeof image === 'string' ? image : image.toString('base64'))
// //     })
// //   }

// //   getBaiduAccount () {
// //     return common.getBaiduAccouts().then(ats => {
// //       const account = ats[curIncr % ats.length]
// //       curIncr++
// //       return account
// //     })
// //   }
// // }

// // module.exports = Ruokuai
