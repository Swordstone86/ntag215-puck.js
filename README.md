# Omniibo

This repository contains code for the amiibo emulator used by **omniibo**.

It was forked from the original NTAG215 emulator created by DanTheMan827. <a href='https://ko-fi.com/dantheman827' target='_blank'><img height='36' style='border:0px;height:36px;'/>Buy them a coffee at ko-fi.com!</a>

You can put your **omniibo** to sleep by holding the button for 5 seconds. To wake it, just hold for another 5 seconds.

Some notes about the script:
- The code currently allows for 50 different tags with the first 7 able to be cycled through by pressing the button.
- The script does not fully implement page locking or password protection.
- You can activate a backdoor for fully writing the tag by using the FAST_READ command on pages 133-134
  - Once activated, you can write pages 0-134 in their entirety with the standard WRITE command and without any restrictions, pages 135-141 contain the 32-byte tag signature.

Things to be implemented:
- Full implementation of page locking
- Password protection

You can find a web app for managing the tags at https://app.omniibo.com/

## Bluetooth Protocol

The Bluetooth protocol involves sending commands to one characteristic, while reading the data from another. The command and return characteristics.

A full WebBluetooth implementation of everything in TypeScript can be found in [puck.ts](https://github.com/DanTheMan827/ntag215-puck.js/blob/master/puck-ntag215-manager/src/puck.ts)

**BLE Service:** `78290001-d52e-473f-a9f4-f03da7c67dd1`  
**Command Characteristic:** `78290002-d52e-473f-a9f4-f03da7c67dd1`  
**Return Characteristic:** `78290003-d52e-473f-a9f4-f03da7c67dd1`  
**Name Characteristic:** `78290004-d52e-473f-a9f4-f03da7c67dd1`

Writing to the name characteristic will change the bluetooth name the puck.js identifies as.

### Commands

#### 0x01 - Slot Information \<Slot>

If a slot is specified, a subset of the tag will be returned that can be reconstructed and decrypted to get the amiibo information (like nickname and character).

These 80 bytes are sliced from the full tag with the following code.
```javascript
var output = Uint8Array(80);
output.set(tags[slot].buffer.slice(0, 8), 0);
output.set(tags[slot].buffer.slice(16, 24), 8);
output.set(tags[slot].buffer.slice(32, 52), 20);
output.set(tags[slot].buffer.slice(84, 92), 40);
output.set(tags[slot].buffer.slice(96, 128), 48);
```

Example: `0x01, Slot, <80 bytes>`

If a slot is not specified, it will return `0x01, Current Slot, Slot Count`

#### 0x02 - Read \<Slot> \<StartPage> \<PageCount> \<Data...>
This is used to read the raw tag data from the puck memory, one page is 4 bytes, and the most you can request at a time is 63 pages.

Data returned is `0x02, Slot, Start Page, Page Count, Data...`

#### 0x03 - Write \<Slot> \<StartPage>, \<Data...>
The start page can be anything between 0-142, the maximum amount of data that can be sent at once is 16 bytes, this does not need to be divisible by 4.

Data returned is `0x03, Slot, Start Page, Data...`

#### 0x04 - Save \<Slot>
If SAVE_TO_FLASH is enabled in the script, this function will write the data in that slot to flash storage.  You probably want to run this after writing a tag.

Data returned is `0x04, Slot`

#### 0xFD - Move \<Source Slot> \<Destination Slot>
This moves the slot from the source to the desination index.

Data returned is `0xFD, Source Slot, Destination Slot`

#### 0xFE - Enable UART
This method enables UART so that the Espruino IDE can connect again, you need to disconnect after calling this.

#### 0xFF - Restart NFC \<Slot>
This restarts the NFC with the slot specified, or the current slot if none was provided.

This is required if the current slot has been overwritten.

Data returned is `0xFF, Slot`
