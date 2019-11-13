import {
  client as WebSocketClient
} from 'websocket'
import Event from 'events'

const socketClient = new WebSocketClient()
let currentConnection = null

// let socketConnect = null

const socketEvent = new Event.EventEmitter()
let connnecting = false

const createConnection = (cb) => {
  socketClient.on('connect', function(connection) {
    console.log('WebSocket Client Connected')
    // socketConnect = connection
    currentConnection = connection
    connnecting = false
    socketEvent.emit('socket:connected')
    cb()
    connection.on('error', function(error) {
      currentConnection = null
      console.log('Connection Error: ' + error.toString())
    })
    connection.on('close', function() {
      currentConnection = null
      console.log('echo-protocol Connection Closed')
    })
    connection.on('message', function(data) {
      console.log('on-message', data)
      const info = JSON.parse(data.utf8Data)
      socketEvent.emit(`check:result:${info.ip}`, info)
    })
  })

  socketClient.connect('ws://http.chk.321184.com:7358/IP', null, 'http://h.jiguangdaili.com')
}

const getConnection = () => {
  if (currentConnection) {
    return Promise.resolve(currentConnection)
  }
  if (connnecting) {
    return new Promise(resolve => {
      socketEvent.once('socket:connected', resolve)
    }).then(getConnection)
  }
  connnecting = true
  return new Promise(resolve => {
    createConnection(resolve)
  }).then(() => currentConnection)
}

export const getCheckInfo = ({ ip, port }) => {
  return getConnection().then(() => {
    const url = `http://${ip}:${port}`
    console.log('send...', url)
    currentConnection.send(url)
    return new Promise(resolve => {
      socketEvent.once(`check:result:${ip}`, (info) => resolve(info))
    })
    // return
  })
}

