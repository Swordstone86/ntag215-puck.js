# How to use

If you haven't already, you will need to install the custom firmware, developed by DanTheMan827 for the Puck.js that adds NTAG215 (amiibo) emulation

To install the updated firmware, you will first need to enter DFU mode. To enter DFU mode, remove the battery and re-insert it while holding the button until a green light turns on.

Once you're in DFU mode, you can click the "Update Firmware" button above.

Once you have the custom firmware installed, you can upload the script file by clicking the "Upload Script".

If you want to manually upload the script, see the section below.

## Manual Script Upload

First, you'll need to upload [this .js file](https://raw.githubusercontent.com/Swordstone86/omniibo/master/ntag215.js) (also shown in the text box below for convenience) to your Puck.js with the [Espruino IDE](https://www.espruino.com/ide/).

Once your Puck.js is programmed, you'll be able to connect your **omniibo** to this app by clicking **Connect to omniibo**.

This, incidentally, also disables programming mode (UART) on your **omniibo**. If you ever want to put your **omniibo** back into programming mode (and make it accessible by the Espruino IDE again), you can click the **Enable UART** button that appears after connecting.

Like this app? [Buy the original developer, DanTheMan827, a coffee!](https://ko-fi.com/dantheman827)
