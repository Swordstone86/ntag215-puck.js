/*
* Web Bluetooth DFU
* Copyright (c) 2022 Daniel Radtke - Typescript translation
* Copyright (c) 2018 Rob Moran
*
* The MIT License (MIT)
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/

import JSZip from "jszip"

export interface DfuPackageApplication {
  bin_file: string,
  dat_file: string
}

export interface DfuPackageManifest {
  [key: string]: DfuPackageApplication | undefined
}

export interface DfuPackageImageResult {
  type: string
  initFile: string
  imageFile: string
  initData: ArrayBuffer
  imageData: ArrayBuffer
}

export class SecureDfuPackage {
  buffer: ArrayBuffer
  zipFile: JSZip
  manifest: DfuPackageManifest
  private loadPromise: Promise<void>

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer
    this.zipFile = null
    this.manifest = null
    this.loadPromise = this.load()
  }

  private async load() {
    this.zipFile = await JSZip.loadAsync(this.buffer)
    const manifestFile = this.zipFile.file("manifest.json")

    if (manifestFile !== null) {
      this.manifest = JSON.parse(await manifestFile.async("string")).manifest
    } else {
      throw new Error("Unable to find manifest, is this a proper DFU package?")
    }
  }

  private async getImage(...types: string[]): Promise<DfuPackageImageResult | undefined> {
    await this.loadPromise

    for (const type of types) {
      if (this.manifest[type]) {
        const entry = this.manifest[type]
        const result: DfuPackageImageResult = {
          type,
          initFile: entry.dat_file,
          imageFile: entry.bin_file,
          initData: null,
          imageData: null
        }

        result.initData = await this.zipFile.file(result.initFile).async("arraybuffer")
        result.imageData = await this.zipFile.file(result.imageFile).async("arraybuffer")

        return result
      }
    }
  }

  async getBaseImage(): Promise<DfuPackageImageResult | undefined> {
    return this.getImage("softdevice", "bootloader", "softdevice_bootloader")
  }

  async getAppImage(): Promise<DfuPackageImageResult | undefined> {
    return this.getImage("application")
  }
}
