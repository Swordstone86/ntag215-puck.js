import SecureDfu from "web-bluetooth-dfu"
import { SecureDfuPackage } from "./SecureDfuPackage"

const CRC32 = require("crc-32")

// @ts-ignore:next-line
const firmware: Promise<{ default: ArrayBuffer }> = import("arraybuffer-loader!../espruino_2v15.1_puckjs.zip")

export interface SecureDfuUpdateProgress {
  object: string
  totalBytes: number
  currentBytes: number
}

export interface SecureDfuUpdateMessage {
  message: string
  final?: boolean
}

export class SecureDfuUpdate {
  static EVENT_LOG = "log"
  static EVENT_PROGRESS = "progress"
  static EVENT_STATUS = "status"

  dfu: SecureDfu
  logCallback: (message: SecureDfuUpdateMessage) => Promise<any>
  progressCallback: (message: SecureDfuUpdateProgress) => Promise<any>
  statusCallback: (message: SecureDfuUpdateMessage) => Promise<any>

  constructor(statusCallback: (message: SecureDfuUpdateMessage) => Promise<any>, logCallback: (message: SecureDfuUpdateMessage) => Promise<any>, progressCallback: (message: SecureDfuUpdateProgress) => Promise<any>) {
    this.logCallback = logCallback
    this.statusCallback = statusCallback
    this.progressCallback = progressCallback
    this.dfu = new SecureDfu(CRC32.buf)
    this.dfu.addEventListener(SecureDfu.EVENT_LOG, logCallback)
    this.dfu.addEventListener(SecureDfu.EVENT_PROGRESS, progressCallback)
  }

  private async loadPackage(): Promise<SecureDfuPackage> {
    return new SecureDfuPackage((await firmware).default)
  }

  async update() {
    const updatePackage = await this.loadPackage()
    const baseImage = await updatePackage.getBaseImage()
    const appImage = await updatePackage.getAppImage()

    await this.statusCallback({ message: "Connecting to device" })
    const device = await this.dfu.requestDevice(false, null)

    for (const image of [baseImage, appImage]) {
      if (image) {
        await this.statusCallback({ message: `Updating ${image.type}: ${image.imageFile}...` })
        await this.dfu.update(device, image.initData, image.imageData);
      }
    }

    await this.statusCallback({ message: "Update complete!", final: true })
  }
}

export async function waitForFirmware() {
  await firmware
}
