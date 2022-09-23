import { minify, MinifyOptions } from "terser"

const options: MinifyOptions = {
  "module": true,
  "compress": {
    "top_retain": [
      "PUCK_NAME_FILE",
      "BLE_SERVICE_ID",
      "BLE_COMMAND_CHARACTERISTIC",
      "BLE_RETURN_CHARACTERISTIC",
      "_Rising"
    ],
    "pure_getters": true,
    "passes": 10
  },
  "mangle": {
    "reserved": []
  },
  "output": {
    "beautify": false
  },
  "parse": { }
}

export function RegisterEspruinoTerser(espruino: any) {
  function init() {
    espruino.addProcessor("transformForEspruino", async (code: string, callback: (code: string) => void) => {
      try {
        const minified = await minify(code, options)
        if (minified.code) {
          callback(minified.code)
        } else {
          throw new Error("Terser failed for some reason")
        }
      } catch (error) {
        console.error(error)
        callback(code)
      }
    })
  }

  espruino.Plugins.Terser = {
    init
  }
}
