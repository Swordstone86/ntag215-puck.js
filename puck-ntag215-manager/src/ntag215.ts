/**
 * This function generates and returns a 572-byte array populated with the data of a blank NTAG215 with a random UID.
 * @returns An array with blank NTAG215 data.
 */
export function getBlankNtag() {
  const tag = new Uint8Array(572)

  tag[0] = 0x04
  tag[1] = Math.round(Math.random() * 255)
  tag[2] = Math.round(Math.random() * 255)
  tag[3] = tag[0] ^ tag[1] ^ tag[2] ^ 0x88
  tag[4] = Math.round(Math.random() * 255)
  tag[5] = Math.round(Math.random() * 255)
  tag[6] = Math.round(Math.random() * 255)
  tag[7] = Math.round(Math.random() * 255)
  tag[8] = tag[4] ^ tag[5] ^ tag[6] ^ tag[7]

  tag.set([0x48, 0x00, 0x00, 0xE1, 0x10, 0x3E, 0x00, 0x03, 0x00, 0xFE], 0x09)
  tag.set([0xBD, 0x04, 0x00, 0x00, 0xFF, 0x00, 0x05], 0x20B)

  return tag
}
