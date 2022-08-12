require("./style/main.scss")

import { Puck } from "./puck"
import { showModal, hideModal, setModal } from "./modal"
import { saveData, readFile } from "./fileHelpers"

const anyWindow = (window as any)
const blankTag = new Uint8Array(require('arraybuffer-loader!../empty_slot.bin'))
const puck = anyWindow.puck = new Puck(console.log, console.warn, console.error)

$(() => {
  const mainContainer = $("#mainContainer")
  const slotsContainer = $("#slotsContainer")
  const scriptTextArea = $("#readme textarea")
  const slotTemplate = require("./templates/slot.pug")

  if (__DEVELOPMENT__) {
    anyWindow.debug = {
      ...(anyWindow.debug || {}),
      ...{
        puck,
        showModal,
        hideModal,
        setModal,
        saveData,
        readFile
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

      readFile(async (file, error) => {
        try {
          if (error != null) {
            await showModal("Error", error.message)

            return
          }

          await writeSlot(slot, file.data, element)
        } catch (error) {
          await showModal("Error", error)
        }
      }, 572)
    })

    /*element.find("a.slot-load-link").on("click", async (e) => {
      e.preventDefault()

      try {
        await showModal("Please Wait", `Loading first tag stored in flash`, true)
        var bins = await puck.getBinsOnFlash()
        await puck.loadFromFlash(slot, bins[0]) // REPLACE THIS LATER
        await hideModal()
        await updateSlotElement(slot, element)
      } catch (error) {
        await showModal("Error", error)
      }
    })*/

    element.find("a.slot-clear-link").on("click", async (e) => {
      e.preventDefault()

      await writeSlot(slot, blankTag, element)
      await updateSlotElement(slot, element)
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
      await showModal("Please Wait", "Connecting to puck", true)
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
      await showModal("Please Wait", "Disconnecting from puck", true)

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
      await showModal("Please Wait", "Reading puck name", true)
      const currentName = await puck.getName()
      const newName = prompt("Enter a name", currentName)

      if (newName != null) {
        await showModal("Please Wait", "Setting puck name", true)
        await puck.setName(newName)
      }

      await hideModal()
    } catch (error) {
      await showModal("Error", error)
    }
  }

  $("a#puckConnect").on("click", connectPuck)
  $("a#puckDisconnect").on("click", disconnectPuck)
  $("a#puckUart").on("click", enableUart)
  $("a#puckName").on("click", changeName)
  $("#readme textarea, #readme a[href$='ntag215.js']").on("click", (e) => {
    e.preventDefault()
    scriptTextArea.trigger("focus").trigger("select")
  })
})
