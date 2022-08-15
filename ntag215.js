/* Copyright (c) 2020 Daniel Radtke. See the file LICENSE for copying permission. */
/* Copyright (c) 2018 Andreas Dröscher. See the file LICENSE for copying permission. */
/* Copyright (c) 2013 Gordon Williams, Pur3 Ltd

------------------------------------------------------------------------------

All sections of code within this repository are licensed under an MIT License:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

const NUM_TAGS = 7;
const SERVICE_ID = "78290001-d52e-473f-a9f4-f03da7c67dd1";
const COMMAND_CHARACTERISTIC = "78290002-d52e-473f-a9f4-f03da7c67dd1";
const RETURN_CHARACTERISTIC = "78290003-d52e-473f-a9f4-f03da7c67dd1";
const NAME_CHARACTERISTIC = "78290004-d52e-473f-a9f4-f03da7c67dd1";
let storage = require("Storage");
let enableUart = false;
let currentTag, cacheTag;
let tagInfos = [];
let changeTag;

class NFCTag {
  constructor(data) {
    this.setData(data);
    this.authenticated = false;
    this.backdoor = false;
    this.tagWritten = false;
    this.lockedPages = [];
    this.slot = 0;
    this.callbacks = this._callbacks;

    let self = this;

    NRF.on('NFCon', function nfcOn() {
      flashSlotOnLEDs(self.slot);
    });

    NRF.on('NFCoff', function nfcOff() {
      writeLEDs();

      self.authenticated = false;
      self.backdoor = false;
      self.callbacks = self._callbacks;

      this.lockedPages = self._getLockedPages();

      if (self.tagWritten == true) {
        console.log("Saving tag to flash");
        saveTagToFlash(self.slot, self._data);
        self.tagWritten = false;
      }

      if (self._fixUid()) {
        NRF.nfcStop();
        NRF.nfcStart(new Uint8Array([self._data[0], self._data[1], self._data[2], self._data[4], self._data[5], self._data[6], self._data[7]]));
      }
    });

    NRF.on('NFCrx', function nfcRx(rx) {
      if (rx && self.callbacks[rx[0]]) {
        self.callbacks[rx[0]](rx, self);
      } else {
        NRF.nfcSend(0);
      }
    });
  }
}

NFCTag.prototype = {
  _fixUid: function() {
    let bcc0 = this._data[0] ^ this._data[1] ^ this._data[2] ^ 0x88;
    let bcc1 = this._data[4] ^ this._data[5] ^ this._data[6] ^ this._data[7];

    if (this._data[3] != bcc0 || this._data[8] != bcc1) {
      this._data[3] = bcc0;
      this._data[8] = bcc1;

      console.log("Fixed bad bcc");

      return true;
    }

    return false;
  },
  _getLockedPages: function() {
    let locked = [0, 1];

    // Static Lock Bytes
    for (let bit = 0; bit < 8; bit++) {
      if (this._data[11] & (1 << bit)) {
        locked.push(bit + 8);
      }

      if (this._data[10] & (1 << bit)) {
        switch (bit) {
          case 0: //BL-CC
          case 1: //BL-9-4
          case 2: //BL-15-10
          case 3: //L-CC
            break;

          default:
            locked.push(bit + 4);
        }
      }
    }

    if (!this.authenticated) {
      // Dynamic Lock Bytes
      if (this._data[520] & 0b00000001 > 0) {
        locked.push(16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31);
      }

      if (this._data[520] & 0b00000010 > 0) {
        locked.push(32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47);
      }

      if (this._data[520] & 0b00000100 > 0) {
        locked.push(48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63);
      }

      if (this._data[520] & 0b00001000 > 0) {
        locked.push(64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79);
      }

      if (this._data[520] & 0b00010000 > 0) {
        locked.push(80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95);
      }

      if (this._data[520] & 0b00100000 > 0) {
        locked.push(96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111);
      }

      if (this._data[520] & 0b01000000 > 0) {
        locked.push(112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127);
      }

      if (this._data[520] & 0b10000000 > 0) {
        locked.push(128, 129);
      }
    }

    return locked;
  },
  _readPage: function(page) {
    if (this.backdoor == false && (page < 0 || page > 134)) {
      return 0x00;
    }

    if (!this.backdoor && (page == 133 || page == 134)) {
      return new Uint8Array(4);
    }

    //send response
    return new Uint8Array(self._data.buffer, page * 4, 4);
  },
  _responses: {
    version: new Uint8Array([0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x11, 0x03]),
    pwdSuccess: new Uint8Array([0x80, 0x80]),
    puckSuccess: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
  },
  _callbacks: {
    type: function() {
      return "normal";
    },
    0x30: function read(rx, self) {
      if (rx.length < 2) {
        NRF.nfcSend(0x00);

        return;
      }

      NRF.nfcSend(new Uint8Array(self._data.buffer, rx[1] * 4, 16));
    },
    0xa2: function write(rx, self) {
      if (!self.backdoor && (rx[1] < 0 || rx[1] > 134 || self.lockedPages.indexOf(rx[1]) != -1)) {
        NRF.nfcSend(0x00);

        return;
      }

      if (!self.backdoor) {
        if (rx[1] == 2) {
          NRF.nfcSend(0x0A);
          self._data[10] = self._data[10] | rx[4];
          self._data[11] = self._data[11] | rx[5];

          return;
        }

        if (rx[1] == 3) {
          NRF.nfcSend(0x0A);
          self._data[16] = self._data[16] | rx[2];
          self._data[17] = self._data[17] | rx[3];
          self._data[18] = self._data[18] | rx[4];
          self._data[19] = self._data[19] | rx[5];

          return;
        }

        /*if (rx[1] == 130) {
          // TODO: Dynamic lock bits
        }*/
      }

      //calculate block index
      let idx = rx[1] * 4;

      //store data if it fits into memory
      if (idx > self._data.length) {
        NRF.nfcSend(0x00);
      } else {
        NRF.nfcSend(0x0A);
        self._data.set(new Uint8Array(rx, 2, 4), idx);
      }

      self.tagWritten = true;
    },
    0x60: function version(rx, self) {
      NRF.nfcSend(self._responses.version); 
    },
    0x3a: function fastRead(rx, self) {
      if (rx[1] > rx[2] || rx[1] < 0 || rx[2] > 134) {
        NRF.nfcSend(0x00);
        console.log("Invalid fast read command");

        return;
      }

      if (rx[1] == 133 && rx[2] == 134) {
        NRF.nfcSend(self._responses.puckSuccess);
        self.backdoor = true;
        self.callbacks = self._unrestrictedCallbacks;

        return;
      }

      NRF.nfcSend(new Uint8Array(self._data.buffer, rx[1] * 4, (rx[2] - rx[1] + 1) * 4));
    },
    0x1b: function pwdAuth(rx, self) {
      NRF.nfcSend(self._responses.pwdSuccess);
      self.authenticated = true;
    },
    0x3c: function readSig(rx, self) {
      NRF.nfcSend(new Uint8Array(self._data.buffer, 540, 32));
    },
    0x88: function restartNfc(rx, self) {
      NRF.nfcSend(0x0A);
    },
    0x1a: function keepAlive(rx) {
      NRF.nfcSend();
    },
    0x93: function keepAlive(rx) {
      NRF.nfcSend();
    },
  },
  setData: function setData(data) {
    //shutdown
    NRF.nfcStop();

    //store data
    this._data = data || new Uint8Array(572);

    //fix bcc0 and bcc1 if needed
    this._fixUid();

    //re-start
    let header = NRF.nfcStart(new Uint8Array([data[0], data[1], data[2], data[4], data[5], data[6], data[7]]));

    //store UID/BCC
    this._data.set(header, 0);
  },
  getData: function getData() {
    return this._data;
  }
};

NFCTag.prototype._unrestrictedCallbacks = {
  type: function() {
    return "unrestricted";
  },
  0x30: NFCTag.prototype._callbacks[0x30],
  0xa2: function write(rx, self) {
    NRF.nfcSend(0x0A);
    self._data.set(new Uint8Array(rx, 2, 4), rx[1] * 4);

    self.tagWritten = true;
  },
  0x60: NFCTag.prototype._callbacks[0x60],
  0x3a: NFCTag.prototype._callbacks[0x3a],
  0x1b: NFCTag.prototype._callbacks[0x1b],
  0x3c: NFCTag.prototype._callbacks[0x3c],
  0x88: NFCTag.prototype._callbacks[0x88],
  0x1a: NFCTag.prototype._callbacks[0x1a],
  0x93: NFCTag.prototype._callbacks[0x93]
};

function getFilenameFromSlot(slot) {
  return "tag" + slot + ".bin";
}

function getTagFromFlash(slot) {
  let filename = getFilenameFromSlot(slot);
  let tag = getBufferClone(storage.readArrayBuffer(filename));
  console.log("Read " + filename);
  return tag;
}

function saveTagToFlash(slot, data) {
  // Store tag metadata in memory for quick retrieval later
  tagInfos[slot] = new Uint8Array(80)
  tagInfos[slot].set(data.slice(0, 8), 0);
  tagInfos[slot].set(data.slice(16, 24), 8);
  tagInfos[slot].set(data.slice(32, 52), 20);
  tagInfos[slot].set(data.slice(84, 92), 40);
  tagInfos[slot].set(data.slice(96, 128), 48);

  let filename = getFilenameFromSlot(slot);
  storage.write(filename, data);
  console.log("Saved " + filename);
}

function initializeTags(numTags) {
  for (let i = 0; i < numTags; i++) {
    let tempTag = new Uint8Array(572);
    let buffer = getTagFromFlash(i);
    
    if (buffer) { // If the tag doesn't already exist on the filesystem, create it
      tempTag = buffer;
    } 
    else {
      tempTag[3] = 0x88;
      tempTag.set([0x48, 0x00, 0x00, 0xE1, 0x10, 0x3E, 0x00, 0x03, 0x00, 0xFE], 0x09);
      tempTag.set([0xBD, 0x04, 0x00, 0x00, 0xFF, 0x00, 0x05], 0x20B);
    }
    saveTagToFlash(i, tempTag);
  }
  // Initialize currentTag values
  currentTag = new NFCTag(getTagFromFlash(0));
  currentTag.slot = 0;
}

function getBufferClone(buffer){
  if (buffer) {
    let output = new Uint8Array(buffer.length);
    for (let buffPos = 0; buffPos < buffer.length; buffPos++) {
      output[buffPos] = buffer[buffPos];
    }

    return output;
  }
}

function setUartWatch(){
  NRF.setServices({ }, { uart : true });

  enableUart = false;

  writeLEDs(1, 1, 1);

  setWatch(function() {
    enableUart = true;
    LED1.write(0);
    LED2.write(0);
  }, BTN, { repeat: false, edge: "rising", debounce: 50 });

  setTimeout(initialize, 5000);
}

function flashLed(led, interval, times, callback) {
  if (times < 1) {
    if (callback) {
      return callback();
    } else {
      return;
    }
  }

  led.write(1);

  setTimeout(function(){
    led.write(0);

    setTimeout(function(){
      flashLed(led, interval, times - 1, callback);
    }, interval);
  }, interval);
}

function setInitWatch() {
  setWatch(function() {
    flashLed(LED2, 150, 2, function() {
      NRF.wake();
      setUartWatch();
    });
  }, BTN, { repeat: false, edge: "rising", debounce: 5000 });
}

// Default values are 0 to allow for quick LED blanking
function writeLEDs(led1, led2, led3) {
  led1 = led1 ? led1 : 0;
  led2 = led2 ? led2 : 0;
  led3 = led3 ? led3 : 0;
  LED1.write(led1);
  LED2.write(led2);
  LED3.write(led3);
}

// Flashes current slot value on LEDs in binary.
function flashSlotOnLEDs(slot) {
  if (slot < 7) {
    let ledSlot = slot + 1;
    writeLEDs(ledSlot & 1, ledSlot & 2, ledSlot & 4);
  }
}

function initialize() {
  writeLEDs();
  clearWatch();

  initializeTags(NUM_TAGS);

  let changeTagTimeout = null;

  changeTag = function changeTag(slot) {
    // If a previous tag change is happening, cancel it and continue with this one
    if (changeTagTimeout){
      clearTimeout(changeTagTimeout);
      changeTagTimeout = null;
    }

    NRF.nfcStop();

    flashSlotOnLEDs(slot);

    // Flash the new slot idx on LEDs for 200ms before switching tags 
    changeTagTimeout = setTimeout(function(slot) {
      writeLEDs();
      
      let newTag = getTagFromFlash(slot);
      // Setting tag data automatically restarts NFC
      currentTag.setData(newTag);
      currentTag.slot = slot;
      changeTagTimeout = null;
    }, 200, slot);
  };

  setWatch(function() {
    clearWatch();
    setInitWatch();
    NRF.sleep();
    NRF.nfcStop();
    flashLed(LED1, 150, 2);
  }, BTN, { repeat: false, edge: "rising", debounce: 5000 });

  setWatch(function() {
    changeTag(++currentTag.slot >= 7 ? 0 : currentTag.slot);
  }, BTN, { repeat: true, edge: "falling", debounce: 50 });

  /**
  let tagLayout = [
    [0, 9],    // UID
    [9, 1],    // Internal
    [10, 2],   // Lock Bytes
    [12, 4],   // Capability Container
    [16, 504], // User Memory
    [520, 3],  // Dynamic Lock Bytes
    [523, 1],  // RFUI
    [524, 4],  // CFG0
    [528, 4],  // CFG1
    [532, 4],  // Password
    [536, 2],  // Pack
    [538, 2],  // RFUI2
    [540, 32]  // Signature
  ];
  */

  NRF.setAdvertising({}, { name: getBufferClone(storage.readArrayBuffer("puck-name")) });
  if (!enableUart) {

    let services = { };
    services[SERVICE_ID] = {};

    services[SERVICE_ID][RETURN_CHARACTERISTIC] = {
      maxLen: 260,
      value: [],
      readable: true,
      writable: false,
      indicate: false
    };

    services[SERVICE_ID][COMMAND_CHARACTERISTIC] = {
      maxLen: 20,
      value: [],
      readable : true,
      writable : true,
      indicate: false,
      onWrite : function(evt) {
        if (evt.data.length > 0) {
          let response = {};
          response[SERVICE_ID] = {};
          response[SERVICE_ID][COMMAND_CHARACTERISTIC] = {
            value: evt.data,
            indicate: false
          };
          response[SERVICE_ID][RETURN_CHARACTERISTIC] = {
            value: [],
            indicate: false
          };
          switch (evt.data[0]) {
            case 0x01: (function() {//Slot Information <Slot>
              if (evt.data.length > 1) {
                //Returns a subset of data for identifying
                let slot = evt.data[1] < NUM_TAGS ? evt.data[1] : currentTag.slot;
                let data = tagInfos[slot]
                response[SERVICE_ID][RETURN_CHARACTERISTIC].value = new Uint8Array(data.length + 2);

                response[SERVICE_ID][RETURN_CHARACTERISTIC].value.set(new Uint8Array(evt.data, 0, 2), 0);
                response[SERVICE_ID][RETURN_CHARACTERISTIC].value[1] = slot;
                response[SERVICE_ID][RETURN_CHARACTERISTIC].value.set(data, 2);
              } else {
                //Returns 0x01 <Current Slot> <Slot Count>
                response[SERVICE_ID][RETURN_CHARACTERISTIC].value = [0x01, currentTag.slot, NUM_TAGS];
              }
              NRF.updateServices(response);
            })(); break;

            case 0x02: (function() {//Read <Slot> <StartPage> <PageCount>
              //Max pages: 63
              //Returns 0x02 <Slot> <StartPage> <PageCount> <Data>
              let startIdx = evt.data[2] * 4;
              let dataSize = evt.data[3] * 4;
              let slot = evt.data[1] < NUM_TAGS ? evt.data[1] : currentTag.slot;
              let tempTag = getTagFromFlash(slot);
              let sourceData = tempTag.slice(startIdx, startIdx + dataSize);
              //console.log("Reading from slot: " + slot);
              //console.log("Read from " + startIdx + " - " + (startIdx + dataSize));
              response[SERVICE_ID][RETURN_CHARACTERISTIC].value = new Uint8Array(dataSize + 4);
              response[SERVICE_ID][RETURN_CHARACTERISTIC].value.set(new Uint8Array(evt.data, 0, 4), 0);
              response[SERVICE_ID][RETURN_CHARACTERISTIC].value[1] = slot;
              response[SERVICE_ID][RETURN_CHARACTERISTIC].value.set(sourceData, 4);
              NRF.updateServices(response);
            })(); break;

            case 0x03: (function() {//Write <Slot> <StartPage> <Data>
              let startIdx = evt.data[2] * 4;
              let dataSize = evt.data.length - 3;
              let slot = evt.data[1] < NUM_TAGS ? evt.data[1] : currentTag.slot;
              // If this is the first page, start loading the tag into cache
              if (evt.data[2] == 0) {
                cacheTag = getTagFromFlash(slot);
              }

              //store data if it fits into memory
              if ((startIdx + dataSize) <= 572) {
                cacheTag.set(new Uint8Array(evt.data, 3, dataSize), startIdx);
              }
              
              // If this is page 140, this is the last page, so we can save the tag now
              if (evt.data[2] == 140) {
                saveTagToFlash(slot, cacheTag);
              }
            })(); break;

            case 0xFD: (function() {//Move slot <From> <To>
              let oldSlot = evt.data[1];
              let newSlot = evt.data[2];
              if (oldSlot < NUM_TAGS && newSlot < NUM_TAGS) {
                let tempTag = getTagFromFlash(oldSlot);
                saveTagToFlash(newSlot, tempTag);
                changeTag(currentTag.slot);
              }
            })(); break;

            case 0xFE: (function() {//Enable BLE UART
              NRF.setServices({ }, { uart : true });
            })(); break;

            case 0xFF: (function() {//Restart NFC <Slot?>
              if (evt.data.length > 1) {
                changeTag(evt.data[1] >= NUM_TAGS ? 0 : evt.data[1]);
              } else {
                changeTag(currentTag.slot);
              }
            })(); break;
          }
        }
      }
    };

    services[SERVICE_ID][NAME_CHARACTERISTIC] = {
      maxLen: 20,
      value: getBufferClone(storage.readArrayBuffer("puck-name")),
      readable : true,
      writable : true,
      indicate: false,
      onWrite : function(evt) {
        if (evt.data.length > 0) {
          storage.write("puck-name", evt.data);
        } else {
          storage.erase("puck-name");
        }
        NRF.setAdvertising({}, { name: getBufferClone(storage.readArrayBuffer("puck-name")) });
      }
    };

    NRF.setServices(services, { uart : false, advertise: [SERVICE_ID] });
  }
}

setUartWatch();
