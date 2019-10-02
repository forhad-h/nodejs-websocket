const parseMessage = buffer => {
  /*
    First Byte of incoming buffer, which contains -
    isFinal - 1 bit, Reserved flags - 3 bits and Opcode - 4 bits
    for example if the firstByte = 10101011
    then, isFinal = 1, Reserved flags = 010, Opcode = 1011
  */
  const firstByte = buffer.readUInt8(0)
  const isFinalFrame = Boolean((firstByte >>> 7) & 0x1)
  const [reserved1, reserved2, reserved3] = [
    Boolean((firstByte >>> 6) & 0x1),
    Boolean((firstByte >>> 5) & 0x1),
    Boolean((firstByte >>> 4) & 0x1)
  ]
  const opCode = firstByte & 0xf

  // Return null for close connection frame
  if (opCode === 0x8) return null

  // Only accept text frames
  if (opCode !== 0x1) return

  /*
   Second Byte, which contains
   isMasked - 1 bit, Payload length - 7 bits
   for example if secondByte = 11010011
   then isMasked = 1, Payload length = 1010011
 */
  const secondByte = buffer.readUInt8(1)
  const isMasked = Boolean((secondByte >>> 7) & 0x1)
  let currentOffset = 2
  let payloadLength = secondByte & 0x7f

  if (payloadLength > 125) {
    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(currentOffset)
      currentOffset += 2
    } else {
      // if the length is 127
      const leftPart = buffer.readUInt32BE(currentOffset)
      const rightPart = buffer.readUInt32BE((currentOffset += 4))
    }
  }

  // get masking key
  let maskingKey
  if (isMasked) {
    maskingKey = buffer.readUInt32BE(currentOffset)
    currentOffset += 4
  }

  // Allocate for store final message data
  const data = Buffer.alloc(payloadLength)

  if (isMasked) {
    // unmasking data
    for (let i = 0, j = 0; i < payloadLength; ++i, j = i % 4) {
      // extract the correct byte mask from masking key
      const shift = j == 3 ? 0 : (3 - j) << 3
      const mask = (shift == 0 ? maskingKey : maskingKey >>> shift) & 0xff

      // read a byte from the source buffer
      const source = buffer.readUInt8(currentOffset++)
      // XOR the source byte and write the result
      data.writeUInt8(mask ^ source, i)
    }
  } else {
    // if not masked, read the data as-is
    buffer.copy(data, 0, currentOffset++)
  }

  const json = data.toString('utf8')
  return JSON.parse(json)
}

module.exports = parseMessage
