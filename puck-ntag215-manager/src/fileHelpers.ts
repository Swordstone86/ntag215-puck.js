export interface LoadedFile {
  filename: string
  size: number
  data: Uint8Array
}

export function saveURL(url: string, fileName: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.style.display = 'none'
  a.click()
  a.remove()
}

export function saveData(data: Uint8Array, fileName = "file.bin", mimeType = "application/octet-stream") {
  const blob = new Blob([data], {
    type: mimeType
  })

  const url = window.URL.createObjectURL(blob)

  saveURL(url, fileName)

  setTimeout(() => window.URL.revokeObjectURL(url), 1000)
}

export function readFile(maxSize = 572): Promise<LoadedFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input")
    input.type = "file"
    document.body.appendChild(input)
    input.style.display = 'none'

    input.addEventListener("change", () => {
      const files = input.files

      if (files.length > 0) {
        const file = files[0]

        if (file.size <= maxSize) {
          const reader = new FileReader()
          reader.addEventListener('load', (e: any) => {
            resolve({
              filename: file.name,
              size: file.size,
              data: new Uint8Array(e.target.result)
            })
          })

          reader.readAsArrayBuffer(file)
        } else {
          reject(new Error(`File is too large: ${file.size} bytes`))
        }
      }
    })

    input.click()
    input.remove()
  })
}

export function downloadFile(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url);
    xhr.responseType = "arraybuffer";

    xhr.onload = function () {
      if (this.status === 200) {
        resolve(xhr.response)
      } else {
        reject(new Error(`HTTP Error ${this.status}`))
      }
    }
    xhr.send()
  })
}
