const http = require('http')
const nodeStatic = require('node-static')
const crypto = require('crypto')

const constructReply = require('./constructReply')
const parseMessage = require('./parseMessage')

const file = new nodeStatic.Server('./')
const server = http.createServer((req, res) => {
  // serve static files i.e html
  req.addListener('end', () => file.serve(req, res)).resume()
})

const port = 3210

server.on('upgrade', (req, socket) => {
  // Make sure that only WebSocket upgrade requests to be handled
  if (req.headers['upgrade'] !== 'websocket') {
    socket.end('HTTP/1.1 400 Bad Request')
    return
  }

  // Websocket key from client
  const acceptKey = req.headers['sec-websocket-key']

  // Generate response key
  const hash = generateAcceptValue(acceptKey)

  // Write the HTTP response into an array of response lines
  const responseHeaders = [
    'HTTP/1.1 101 Web Socket Protocol Handshake',
    'Connection: Upgrade', // Upgrade Connection -
    'Upgrade: WebSocket', // to WebSocket
    `Sec-WebSocket-Accept: ${hash}` // Hashed response key
  ]

  // Read the sub-protocol/websocket-protocol from the client request headers
  const protocols = req.headers['sec-websocket-protocol']

  // Make given protocols array
  const protocolsArr = !protocols ? [] : protocols.split(',').map(s => s.trim())

  // Check if the client provides 'json' protocol then
  // the server agrees to communicate with JSON data
  if (protocolsArr.includes('json')) {
    responseHeaders.push(`Sec-WebSocket-Protocol: json`)
  }

  /*
   Write the response back to the client socket

   Note: Additional two newlines make sure end of the header data so that
          it doesn't continue to wait for more header data
   */
  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n')

  socket.on('data', buffer => {
    const message = parseMessage(buffer)

    if (message) {
      console.log(message)
      socket.write(constructReply({ message: 'Hello from the server!' }))
    } else if (message === null) {
      console.log('WebSocket connection closed by the client.')
    }
  })
})

server.listen(port, () =>
  console.log(`🚀  Server running at http://localhost:${port}`)
)

const generateAcceptValue = acceptKey =>
  crypto
    .createHash('sha1')
    .update(acceptKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', 'binary')
    .digest('base64')
