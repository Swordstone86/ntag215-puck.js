// Constants
const SAVE_TO_FLASH = false; // Set this to true if you want to save the tags to flash memory.
const FIRMWARE_NAME = "dtm-1.0.1";
const PUCK_NAME_FILE = "puck-name";
const BOARD = process.env.BOARD;
const UART_WINDOW = 5000; // How long in miliseconds during power on in which you can press the button to enable UART.
const POWER_ON_TIME = 5000; // How many miliseconds you have to hold the button to power on the puck
const POWER_OFF_TIME = 5000 ;// How many miliseconds you have to hold the button to power off the puck

// Bluetooth GUIDs
const BLE_SERVICE_ID = "78290001-d52e-473f-a9f4-f03da7c67dd1";
const BLE_COMMAND_CHARACTERISTIC = "78290002-d52e-473f-a9f4-f03da7c67dd1";
const BLE_RETURN_CHARACTERISTIC = "78290003-d52e-473f-a9f4-f03da7c67dd1";
const BLE_NAME_CHARACTERISTIC = "78290004-d52e-473f-a9f4-f03da7c67dd1";
const BLE_FIRMWARE_CHARACTERISTIC = "78290005-d52e-473f-a9f4-f03da7c67dd1";

// Modules
const storage = require("Storage");

// Mangle Helper
const _BTN = this.BTN;
const _LED1 = this.LED1;
const _LED2 = this.LED2;
const _LED3 = this.LED3;
const _NTAG215 = this.NTAG215;
const _clearTimeout = clearTimeout;
const _setTimeout = setTimeout;
const _setWatch = setWatch;
const _clearWatch = clearWatch;
const _consoleLog = console.log;
const _Math = Math;
const _MathRound = _Math.round;
const _MathRandom = _Math.random;
const _Rising = "rising";
const _Falling = "falling";

// Features
const ENABLE_LEDS = BOARD == "PUCKJS";

// Variables
var currentTag = 0;
var changeTagTimeout = null;
var enableUart = false;
var txBuffer = new Uint8Array(32);
var tags = [];

while (tags.length < 50 && process.memory().free > 1024) {
  tags.push(new Uint8Array(572));
}

_consoleLog("Tag count: " + tags.length);

function fixUid() {
  if (tags[currentTag][0] == 0x04 && tags[currentTag][9] == 0x48 && _NTAG215.fixUid()) {
    _consoleLog("Fixed UID");
    return true;
  }

  return false;
}

function getTagInfo(slot) {
  var output = Uint8Array(80);
  output.set(tags[slot].slice(0, 8), 0);
  output.set(tags[slot].slice(16, 24), 8);
  output.set(tags[slot].slice(32, 52), 20);
  output.set(tags[slot].slice(84, 92), 40);
  output.set(tags[slot].slice(96, 128), 48);

  return output;
}

function changeTag(slot, noDelay) {
  if (changeTagTimeout) {
    _clearTimeout(changeTagTimeout);
    changeTagTimeout = null;
  }

  _NTAG215.nfcStop();

  currentTag = slot;

  if (ENABLE_LEDS && currentTag < 7) {
    _LED1.write(currentTag + 1 & 1);
    _LED2.write(currentTag + 1 & 2);
    _LED3.write(currentTag + 1 & 4);
  }

  function innerChangeTag() {
    if (ENABLE_LEDS) {
      _LED1.write(0);
      _LED2.write(0);
      _LED3.write(0);
    }

    _NTAG215.setTagData(tags[slot].buffer);
    fixUid();
    _NTAG215.nfcStart();
  }

  if (noDelay) {
    innerChangeTag();
  } else {
    changeTagTimeout = _setTimeout(innerChangeTag, 200);
  }
}

function cycleTags() {
  changeTag(++currentTag >= 7 ? 0 : currentTag);
}

function getBufferClone(buffer) {
  if (buffer) {
    var output = new Uint8Array(buffer.length);
    output.set(buffer);

    return output;
  }
}

function saveTag(slot) {
  if (slot == undefined) {
    slot = currentTag;
  }

  if (slot < 0 || slot >= tags.length) {
    return;
  }

  _consoleLog("Saving tag " + slot);
  storage.write("tag" + slot + ".bin", tags[slot]);
}

function saveAllTags() {
  for (var i = 0; i < tags.length; i++) {
    saveTag(i);
  }
}

function setUartWatch() {
  NRF.setServices({}, {
    uart: true
  });

  enableUart = false;

  if (ENABLE_LEDS) {
    _LED1.write(1);
    _LED2.write(1);
    _LED3.write(1);
  }

  _setWatch(() => {
    enableUart = true;

    if (ENABLE_LEDS) {
      _LED1.write(0);
      _LED2.write(0);
    }
  }, _BTN, {
    repeat: false,
    edge: _Rising,
    debounce: 50
  });

  _setTimeout(initialize, UART_WINDOW);
}

function flashLed(led, interval, times, callback) {
  if (ENABLE_LEDS) {
    if (times < 1) {
      if (callback) {
        return callback();
      } else {
        return;
      }
    }

    led.write(1);

    _setTimeout(() => {
      led.write(0);

      _setTimeout(() => {
        flashLed(led, interval, times - 1, callback);
      }, interval);
    }, interval);
  } else {
    // No LEDs, run the callback immediately.
    if (callback) {
      return callback();
    } else {
      return;
    }
  }
}

function powerOn() {
  if (ENABLE_LEDS) {
    flashLed(_LED2, 150, 2, () => {
      NRF.wake();
      setUartWatch();
    });
  } else {
    NRF.wake();
    setUartWatch()
  }
}

function setInitWatch() {
  _setWatch(powerOn, _BTN, {
    repeat: false,
    edge: _Rising,
    debounce: POWER_ON_TIME
  });
}

function powerOff() {
  _clearWatch();
  setInitWatch();
  NRF.sleep();
  _NTAG215.nfcStop();
  if (ENABLE_LEDS) {
    flashLed(_LED1, 150, 2);
  }
}

function initialize() {
  if (ENABLE_LEDS) {
    _LED1.write(0);
    _LED2.write(0);
    _LED3.write(0);
  }

  _clearWatch();

  changeTag(currentTag, true);

  _setWatch(powerOff, _BTN, {
    repeat: false,
    edge: _Rising,
    debounce: POWER_OFF_TIME
  });

  _setWatch(cycleTags, _BTN, {
    repeat: true,
    edge: _Falling,
    debounce: 50
  });

  NRF.setAdvertising({}, {
    name: getBufferClone(storage.readArrayBuffer(PUCK_NAME_FILE))
  });
  if (!enableUart) {
    var services = {};
    var response = {};
    response[BLE_SERVICE_ID] = {};
    response[BLE_SERVICE_ID][BLE_COMMAND_CHARACTERISTIC] = {
      value: [],
      indicate: false
    };
    response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC] = {
      value: [],
      indicate: false
    };

    services[BLE_SERVICE_ID] = {};

    services[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC] = {
      maxLen: 260,
      value: [],
      readable: true,
      writable: false,
      indicate: false
    };

    services[BLE_SERVICE_ID][BLE_COMMAND_CHARACTERISTIC] = {
      maxLen: 20,
      value: [],
      readable: true,
      writable: true,
      indicate: false,
      onWrite: (evt) => {
        var slot,
          startIdx,
          dataSize,
          sourceData,
          oldSlot,
          newSlot;

        if (evt.data.length > 0) {
          response[BLE_SERVICE_ID][BLE_COMMAND_CHARACTERISTIC].value = evt.data;
          switch (evt.data[0]) {
            case 0x01: //Slot Information <Slot>
              if (evt.data.length > 1) {
                //Returns a subset of data for identifying
                slot = evt.data[1] < tags.length ? evt.data[1] : currentTag;
                var data = getTagInfo(slot);
                response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value = Uint8Array(data.length + 2);

                response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value.set(Uint8Array(evt.data, 0, 2), 0);
                response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value[1] = slot;
                response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value.set(data, 2);
              } else {
                //Returns 0x01 <Current Slot> <Slot Count>
                response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value = [0x01, currentTag, tags.length];
              }
              NRF.updateServices(response);
              break;

            case 0x02: //Read <Slot> <StartPage> <PageCount>
              //Max pages: 63
              //Returns 0x02 <Slot> <StartPage> <PageCount> <Data>
              startIdx = evt.data[2] * 4;
              dataSize = evt.data[3] * 4;
              slot = evt.data[1] < tags.length ? evt.data[1] : currentTag;
              sourceData = tags[slot].slice(startIdx, startIdx + dataSize);
              //_consoleLog("Reading from slot: " + slot);
              //_consoleLog("Read from " + startIdx + " - " + (startIdx + dataSize));
              response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value = Uint8Array(dataSize + 4);
              response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value.set(Uint8Array(evt.data, 0, 4), 0);
              response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value[1] = slot;
              response[BLE_SERVICE_ID][BLE_RETURN_CHARACTERISTIC].value.set(sourceData, 4);
              NRF.updateServices(response);
              break;

            case 0x03: //Write <Slot> <StartPage> <Data>
              startIdx = evt.data[2] * 4;
              dataSize = evt.data.length - 3;
              slot = evt.data[1] < tags.length ? evt.data[1] : currentTag;

              //store data if it fits into memory
              if ((startIdx + dataSize) <= 572) {
                //_consoleLog("Write to slot: " + slot);
                //_consoleLog("Write to start: " + startIdx);
                //_consoleLog("Write size: " + dataSize);

                tags[slot].set(new Uint8Array(evt.data, 3, dataSize), startIdx);
              }
              break;

            case 0x04: //Save <Slot>
              if (SAVE_TO_FLASH) {
                slot = evt.data[1] < tags.length ? evt.data[1] : currentTag;

                saveTag(slot);
              }
              break;

            case 0xFD: //Move slot <From> <To>
              oldSlot = evt.data[1];
              newSlot = evt.data[2];
              if (oldSlot < tags.length && newSlot < tags.length) {
                tags.splice(newSlot, 0, tags.splice(oldSlot, 1)[0]);
                changeTag(currentTag);
              }
              break;

            case 0xFE: //Enable BLE UART
              NRF.setServices({}, {
                uart: true
              });
              break;

            case 0xFF: //Restart NFC <Slot?>
              if (evt.data.length > 1) {
                changeTag(evt.data[1] >= tags.length ? 0 : evt.data[1]);
              } else {
                changeTag(currentTag);
              }
              break;
          }
        }
      }
    };

    services[BLE_SERVICE_ID][BLE_NAME_CHARACTERISTIC] = {
      maxLen: 20,
      value: new Uint8Array(storage.readArrayBuffer(PUCK_NAME_FILE)),
      readable: true,
      writable: true,
      indicate: false,
      onWrite: (evt) => {
        if (evt.data.length > 0) {
          storage.write(PUCK_NAME_FILE, evt.data);
        } else {
          storage.erase(PUCK_NAME_FILE);
        }
        NRF.setAdvertising({}, {
          name: getBufferClone(storage.readArrayBuffer(PUCK_NAME_FILE))
        });
      }
    };

    services[BLE_SERVICE_ID][BLE_FIRMWARE_CHARACTERISTIC] = {
      value: FIRMWARE_NAME,
      readable: true
    };

    NRF.setServices(services, {
      uart: false,
      advertise: [BLE_SERVICE_ID]
    });
  }
}

if (typeof _NTAG215 !== "undefined") {
  if (storage.readArrayBuffer(PUCK_NAME_FILE) == undefined) {
    storage.write(PUCK_NAME_FILE, "Puck.js " + NRF.getAddress().substr(12, 5).split(":").join(""));
  }

  _NTAG215.setTagBuffer(txBuffer.buffer);
  E.on("kill", _NTAG215.nfcStop);

  NRF.on('NFCon', function nfcOn() {
    if (ENABLE_LEDS && currentTag < 7) {
      _LED1.write(currentTag + 1 & 1);
      _LED2.write(currentTag + 1 & 2);
      _LED3.write(currentTag + 1 & 4);
    }
  });

  NRF.on('NFCoff', function nfcOff() {
    if (ENABLE_LEDS) {
      _LED1.write(0);
      _LED2.write(0);
      _LED3.write(0);
    }

    if (fixUid()) {
      _NTAG215.nfcRestart();
    }

    if (_NTAG215.getTagWritten()) {
      if (SAVE_TO_FLASH) {
        _consoleLog("Saving tag to flash");
        saveTag();
      }
      _NTAG215.setTagWritten(false);
    }
  });

  for (var i = 0; i < tags.length; i++) {
    var filename = "tag" + i + ".bin";
    var buffer = storage.readArrayBuffer(filename);

    if (buffer) {
      _consoleLog("Loaded " + filename);
      tags[i].set(buffer);
    } else {
      tags[i][0] = 0x04;
      tags[i][1] = _MathRound(_MathRandom() * 255);
      tags[i][2] = _MathRound(_MathRandom() * 255);
      tags[i][3] = tags[i][0] ^ tags[i][1] ^ tags[i][2] ^ 0x88;
      tags[i][4] = _MathRound(_MathRandom() * 255);
      tags[i][5] = _MathRound(_MathRandom() * 255);
      tags[i][6] = _MathRound(_MathRandom() * 255);
      tags[i][7] = _MathRound(_MathRandom() * 255);
      tags[i][8] = tags[i][4] ^ tags[i][5] ^ tags[i][6] ^ tags[i][7];

      tags[i].set([0x48, 0x00, 0x00, 0xE1, 0x10, 0x3E, 0x00, 0x03, 0x00, 0xFE], 0x09);
      tags[i].set([0xBD, 0x04, 0x00, 0x00, 0xFF, 0x00, 0x05], 0x20B);
    }
  }

  setUartWatch();
} else {
  // We don't have the custom firmware needed.
  if (ENABLE_LEDS) {
    _LED1.write(1);
  }
}
