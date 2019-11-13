import moment from 'moment';
import Event from 'events';

const crypto = require('crypto');
// const path = require('path')
// const fs = require('fs')

const delay = millseconds => {
  return new Promise(resolve => {
    if (millseconds <= 0) {
      setImmediate(resolve);
    } else {
      setTimeout(resolve, millseconds);
    }
  });
};

const md5 = data => {
  return crypto
    .createHash('md5')
    .update(data)
    .digest('hex');
};

const sha256 = data => {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
};

const randomHex = len => {
  return crypto
    .randomBytes(Math.ceil(len / 2))
    .toString('hex') // convert to hexadecimal format
    .slice(0, len);
};

const random = function(minNum, maxNum) {
  switch (arguments.length) {
    case 1:
      return parseInt(Math.random() * minNum + 1, 10);
    case 2:
      return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
    default:
      return Math.random();
  }
};

const randomArr = function(arr, randomRate = 10) {
  const result = [...arr];
  const randomLen = result.length * randomRate;
  let lastRandomIndex = random(1, result.length * 10) % result.length;
  for (let i = 0; i < randomLen; i++) {
    const currRandomIndex = random(1, result.length * 20) % result.length;
    const tmp = result[lastRandomIndex];
    result[lastRandomIndex] = result[currRandomIndex];
    result[currRandomIndex] = tmp;
    lastRandomIndex = currRandomIndex;
  }
  return result;
};
const randomStr = function(len) {
  let str = '';
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(
      random(10) < 4 ? random(65, 90) : random(97, 121)
    );
  }
  return str;
};

const secureKey = (() => {
  const rawKey = `${process.env.SECURE_KEY}-cosmic-privacy-data`;

  return md5(rawKey);
  // return `${process.env.SECURE_KEY}-cosmic-privacy-data`
})();

const getAesIv = () => {
  return randomHex(16);
};

const encrypt = data => {
  const iv = getAesIv();
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(secureKey),
    Buffer.from(iv)
  );
  let crypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  crypted += cipher.final('hex');
  return iv + randomHex(16) + crypted;
  // return crypto.AES.encrypt(JSON.stringify(data), getSecureKey()).toString()
};

const decrypt = rawCrypted => {
  const iv = rawCrypted.slice(0, 16);
  const crypted = rawCrypted.slice(32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', secureKey, iv);
  let dec = decipher.update(crypted, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return JSON.parse(dec);
};

// const parseTime = (str) => {

// }

// const requireDir = (dir) => {
//   fs.readdirSync(dir)
//     .filter(file => {
//       return file.indexOf('.') !== 0 && file !== basename && file.slice(-3) === '.js'
//     }).reduce((result, file) => {
//       result[file.split('.')[0]] = require(path.join(dir, file))
//       return result
//     }, {})
// }
let today = null;
const getToday = (t = 0) => {
  if (t === 0) {
    if (today) {
      if (today !== moment(getLocalTime(-4, t)).format('YYYY-MM-DD')) {
        window.location.reload();
      }
      return today;
    }
    today = moment(getLocalTime(-4, t)).format('YYYY-MM-DD');
    return today;
  }
  // const d = new Date()
  // d.setTime(d.getTime() - 12.5 * 3600 * 1000)
  return moment(getLocalTime(-4, t)).format('YYYY-MM-DD');
};

const lockObject = {};
const eventLock = new Event();
const LOCK_TIMEOUT = 150 * 1000;
const lock = (key = 'locking', func, ...args) => {
  // return Promise.resolve()
  if (lockObject[key] && lockObject[key] + LOCK_TIMEOUT > Date.now()) {
    return new Promise((resolve, rejected) => {
      eventLock.once(key, () => resolve());
      setTimeout(() => {
        rejected(new Error('超时'));
      }, LOCK_TIMEOUT);
    })
      .then(() => {
        return lock(key, func, ...args);
      })
      .catch(err => {
        console.log(err);
        return lock(key, func, ...args);
      });
  }
  lockObject[key] = Date.now();
  return func(...args)
    .then(rs => {
      delete lockObject[key]; // = 0
      setImmediate(() => {
        eventLock.emit(key);
      });
      return rs;
    })
    .catch(err => {
      delete lockObject[key];
      setImmediate(() => {
        eventLock.emit(key);
      });
      throw err;
    });
};

const releaseDo = (key, func, ...args) => {
  if (!lockObject[key] || lockObject[key] + LOCK_TIMEOUT < Date.now()) {
    return Promise.resolve().then(() => func(...args));
  }
  return new Promise(resolve => {
    eventLock.once(key, () => resolve());
  }).then(() => func(...args));
};

const CTRL_LOCK_MAX_NUM = 100;
// const ctrlLockObject = {}
const ctrlLockKeys = [];
const CTRL_LOCK_ENENT_KEY = 'CTRL_LOCK';

const getCtrlLockLength = () => ctrlLockKeys.length;
// const CTRL_TIMEOUT = 1000 * 150
const ctrlLock = (key = 'ctrlLock') => {
  if (ctrlLockKeys.includes(key)) {
    return Promise.resolve();
  }
  if (ctrlLockKeys.length > CTRL_LOCK_MAX_NUM) {
    return new Promise(resolve => {
      eventLock.once(CTRL_LOCK_ENENT_KEY, () => {
        resolve();
      });
    }).then(() => ctrlLock(key));
  }
  ctrlLockKeys.push(key);
  console.log('ctrLock ..... releaseLock Enter', key);
  const obj = {
    release: () => {
      console.log('ctrLock ..... releaseLock', key);
      const index = ctrlLockKeys.indexOf(key);
      if (index > -1) {
        ctrlLockKeys.splice(index, 2);
      }
      eventLock.emit(CTRL_LOCK_ENENT_KEY);
    }
  };
  return Promise.resolve(obj);
};

const seqAsync = (cbs, dTime = 0) => {
  const result = [];
  let i = 0;
  if (cbs.length === 0) {
    return Promise.resolve([]);
  }
  const asyncRun = () => {
    const cb = cbs[i];
    return cb().then(r => {
      result.push(r);
      i++;
      if (i < cbs.length) {
        return delay(dTime).then(asyncRun);
      }
      return result;
    });
  };
  return asyncRun();
};

export default {
  md5,
  sha256,
  encrypt,
  decrypt,
  delay,
  getToday,
  getYestoday,
  random,
  randomHex,
  randomStr,
  randomArr,
  lock,
  ctrlLock,
  getCtrlLockLength,
  releaseDo,
  seqAsync
};
