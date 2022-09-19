require("./style/main.scss")

import { getBlankNtag } from "./ntag215"
import { Puck } from "./puck"
import { showModal, hideModal, setModal } from "./modal"
import { saveData, readFile } from "./fileHelpers"
import { supportsBluetooth, bluetoothOrError } from "./browserCheck"
import { SecureDfuUpdateMessage, SecureDfuUpdateProgress } from "./SecureDfuUpdate"
import * as EspruinoHelper from "./espruino"

const anyWindow = (window as any)
const blankTag = new Uint8Array(require('arraybuffer-loader!../NTAG215_blank.bin'))
const puck = anyWindow.puck = new Puck(console.log, console.warn, console.error)

$(() => {
  const mainContainer = $("#mainContainer")
  const slotsContainer = $("#slotsContainer")
  const scriptTextArea = $("#readme textarea")
  const slotTemplate = require("./templates/slot.pug")

  if (supportsBluetooth !== true) {
    showModal("Unsupported Browser", supportsBluetooth, true, true, false)
  }

  if (__DEVELOPMENT__) {
    anyWindow.debug = {
      ...(anyWindow.debug || {}),
      ...{
        EspruinoHelper,
        hideModal,
        puck,
        readFile,
        saveData,
        setModal,
        showModal
      }
    }
  }

  async function populateSlots() {
    slotsContainer.empty()

    if (puck.isConnected) {
      const info = await puck.getSlotInformation()

      for (let i = 0; i < info.totalSlots; i++) {
        setModal(null, `Reading Slot ${i + 1}`)
        const slotInfo = await puck.readSlotSummary(i)
        slotsContainer.append(getSlotElement(i, slotInfo))
      }
    }
  }

  function array2hex(data: Uint8Array): string {
    return Array.prototype.map.call(data, (e: number) => ("00" + e.toString(16)).slice(-2)).join("")
  }

  async function updateSlotElement(slot: number, oldElement: JQuery<HTMLElement>) {
    const info = await puck.readSlotSummary(slot)
    getSlotElement(slot, info).insertAfter(oldElement)
    oldElement.remove()
  }

  async function writeSlot(slot: number, data: Uint8Array, element: JQuery<HTMLElement>) {
    await showModal("Please Wait", `Writing slot ${slot + 1}`, true)
    await puck.writeSlot(slot, data)
    await updateSlotElement(slot, element)
    await hideModal()
  }

  function getSlotElement(slot: number, summary: Uint8Array): JQuery<HTMLElement> {
    const element = $(slotTemplate({
      slot,
      uid: array2hex(summary.slice(0, 8))
    }))

    element.find("a.slot-download-link").on("click", async (e) => {
      e.preventDefault()

      try {
        await showModal("Please Wait", `Reading slot ${slot + 1}`, true)
        const data = await puck.readSlot(slot)
        await hideModal()
        saveData(data, `slot${slot}.bin`)
      } catch (error) {
        await showModal("Error", error)
      }
    })

    element.find("a.slot-upload-link").on("click", async (e) => {
      e.preventDefault()

      try {
        const file = await readFile(572)
        await writeSlot(slot, file.data, element)
      } catch (error) {
        await showModal("Error", error.message)
      }
    })

    element.find("a.slot-clear-link").on("click", async (e) => {
      e.preventDefault()

      await writeSlot(slot, getBlankNtag(), element)
    })

    element.find("a.slot-select-link").on("click", async (e) => {
      e.preventDefault()

      try {
        await showModal("Please Wait", `Changing to slot ${slot + 1}`, true)
        await puck.changeSlot(slot)
        await hideModal()
      } catch (error) {
        await showModal("Error", error)
      }
    })

    return element
  }

  async function connectPuck(e: Event | JQuery.Event) {
    e.preventDefault()

    try {
      await bluetoothOrError()
      await showModal("Please Wait", "Connecting to omniibo", true)
      await puck.connect(async (ev) => {
        await disconnectPuck(ev)
      })

      if (puck.isConnected) {
        await populateSlots()

        mainContainer.addClass("connected")
      }

      await hideModal()
    } catch (error) {
      await showModal("Error", error)
    }
  }

  async function disconnectPuck(e: Event | JQuery.Event) {
    e.preventDefault()
    try {
      await showModal("Please Wait", "Disconnecting from omniibo", true)

      if (puck.isConnected) {
        await puck.disconnect()
      }

      mainContainer.removeClass("connected")

      await hideModal()
    } catch (error) {
      await showModal("Error", error)
    }
  }

  async function enableUart(e: Event | JQuery.Event) {
    e.preventDefault()
    try {
      await showModal("Please Wait", "Enabling UART", true)
      await puck.enableUart()
      await disconnectPuck(e)
      await hideModal()
    } catch (error) {
      await showModal("Error", error)
    }
  }

  async function changeName(e: Event | JQuery.Event) {
    e.preventDefault()
    try {
      await showModal("Please Wait", "Reading omniibo name", true)
      const currentName = await puck.getName()
      const newName = prompt("Enter a name", currentName)

      if (newName != null) {
        await showModal("Please Wait", "Setting omniibo name", true)
        await puck.setName(newName)
      }

      await hideModal()
    } catch (error) {
      await showModal("Error", error)
    }
  }

  async function uploadScript(e: Event | JQuery.Event) {
    try {
      await bluetoothOrError()
      await showModal("Please Wait", "Connecting to puck", true)
      await EspruinoHelper.open()

      const ver = await EspruinoHelper.getNtagVersion()

      if (!(ver.major == 1 && ver.minor >= 0)) {
        throw new Error("You must flash the custom firmware prior to uploading the script.")
      }

      await showModal("Uploading", "Uploading script file, please wait.")
      await EspruinoHelper.writeCode()
      EspruinoHelper.close()
      await hideModal()
    } catch (error) {
      EspruinoHelper.close()
      await showModal("Error", error)
    }
  }

  (async () => {
    // load the firmware updater
    const { SecureDfuUpdate, waitForFirmware } = await import("./SecureDfuUpdate")
    await waitForFirmware()

    async function updateFirmware(e: Event | JQuery.Event) {
      let modalShown = false
      let canClose = true;
      try {
        await bluetoothOrError()

        let previousMessage: string

        async function status(event: SecureDfuUpdateMessage) {
          previousMessage = event.message
          canClose = event.final

          if (modalShown === false || event.final) {
            modalShown = true
            await showModal("Updating Firmware", previousMessage, event.final !== true)
          } else {
            setModal("Updating Firmware", previousMessage)
          }
        }

        async function log(event: SecureDfuUpdateMessage) {
          console.log(event)
        }

        async function progress(event: SecureDfuUpdateProgress) {
          setModal("Updating Firmware", `${previousMessage}\n\n${event.currentBytes} / ${event.totalBytes} bytes`)
        }

        const dfu = new SecureDfuUpdate(status, log, progress)

        await dfu.update()
      } catch (error) {
        if (modalShown === false || canClose !== true) {
          await showModal("Error", error)
        } else {
          setModal("Error", error)
        }
      }
    }

    $("#updateFirmware").on("click", updateFirmware).prop("disabled", false)
  })();

  $("#puckConnect").on("click", connectPuck).prop("disabled", false)
  $("#puckDisconnect").on("click", disconnectPuck).prop("disabled", false)
  $("#puckUart").on("click", enableUart).prop("disabled", false)
  $("#puckName").on("click", changeName).prop("disabled", false)
  $("#uploadScript").on("click", uploadScript).prop("disabled", false)
  $("#readme textarea, #readme a[href$='ntag215.js']").on("click", (e) => {
    e.preventDefault()
    scriptTextArea.trigger("focus").trigger("select")
  })
})
