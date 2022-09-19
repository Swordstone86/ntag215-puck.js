const template: (options?: ModalTemplateOptions) => string = require("./templates/modal.pug")

let body: JQuery<HTMLElement>
let alertModal: JQuery<HTMLElement>
let modalHeader: JQuery<HTMLElement>
let modalFooter: JQuery<HTMLElement>
let modalTitle: JQuery<HTMLElement>
let modalBody: JQuery<HTMLElement>
let modalClose: JQuery<HTMLElement>
let modalResolve: (value: ModalResult | PromiseLike<ModalResult>) => void | undefined
let modalReject: (reason?: any) => void | undefined

let modalShowing = false
let modalCanClose = true

import { sleep } from "./sleep"

require("bootstrap")

export interface ModalTemplateButton {
  value: ModalResult,
  label: string
}

export interface ModalTemplateOptions {
  buttons?: ModalTemplateButton[]
}

export interface ModalTitleOptions {
  title?: string
  htmlEscapeTitle?: boolean
}

export interface ModalMessageOptions {
  message?: string
  htmlEscapeBody?: boolean
}

export interface ModalSetOptions extends ModalTitleOptions, ModalMessageOptions {}

export interface ModalShowOptions extends ModalTitleOptions, ModalMessageOptions {
  title: string
  message: string
  preventClose?: boolean

  /**
   * Whether to wait for a dismissal before resolving the promise.
   */
  dialog?: boolean

  /** The button or buttons to present to the user */
  buttons?: ModalButtonTypes
}

/**
 * Does nothing... yet...
 */
export enum ModalButtonTypes {
  None,
  Close,
  YesNo,
  YesNoCancel,
  Next
}

export enum ModalResult {
  /**
   * Returned if dialog is false and the modal is shown.
   */
  ModalShown,

  /**
   * Returned when the modal is dismissed with a call to HideModal.
   */
  ScriptDismiss,

  /**
   * Returned when the user dismisses the dialog by clicking the X, clicking on the background, or using escape.
   */
  BackgroundClick,

  /**
   * User pressed the "Close" button.
   */
  ButtonClose,

  /**
   * User pressed the "Yes" button.
   */
  ButtonYes,

  /**
   * User pressed the "No" button.
   */
  ButtonNo,

  /**
   * User pressed the "Cancel" button.
   */
  ButtonCancel,

  /**
   * User pressed the "Next" button.
   */
  ButtonNext,

  /**
   * User pressed the "X" button in the corner of the window.
   */
  ButtonCloseX = 255
}

$(() => {
  body = $(document.body)
})

async function modalBackgroundClick(e: any) {
  if (!modalCanClose) {
    return
  }

  if (e.target.class === "modal-dialog") {
    return
  }

  if ($(e.target).closest('.modal-dialog').length) {
    return
  }

  const resolve = modalResolve

  modalResolve = undefined
  modalReject = undefined

  await hideModal()

  if (resolve) {
    resolve(ModalResult.BackgroundClick)
  }
}

async function modalButtonClick(this: HTMLElement | JQuery<HTMLElement>, e: any) {
  const $this = $(this)

  const resolve = modalResolve
  const reject = modalReject

  modalResolve = undefined
  modalReject = undefined

  await hideModal()

  if (resolve) {
    const dataValue: string = $this.data("close-value").toString()
    if (dataValue.match(/^\d+$/)) {
      const intValue = parseInt(dataValue, 10)

      if ([ModalResult.ButtonYes, ModalResult.ButtonNo, ModalResult.ButtonCancel, ModalResult.ButtonClose, ModalResult.ButtonCloseX, ModalResult.ButtonNext].includes(intValue)) {
        resolve(intValue as ModalResult)
      }
    } else {
      reject(new Error(`Unknown button value: ${dataValue}`))
    }
  }
}

export async function showModal(options: ModalShowOptions): Promise<ModalResult> {

  const {
    title,
    message,
    preventClose = false,
    htmlEscapeTitle = true,
    htmlEscapeBody = true,
    dialog = false,
  } = options

  const buttons = options.buttons || (preventClose ? ModalButtonTypes.None : ModalButtonTypes.Close)

  if (modalShowing) {
    await hideModal()
  }

  const buttonList: ModalTemplateButton[] = []

  /*
    None = 1,
    Close,
    YesNo,
    YesNoCancel
  */
  switch (buttons) {
    case ModalButtonTypes.Close:
      buttonList.push({
        label: "Close",
        value: ModalResult.ButtonClose
      })
      break

    case ModalButtonTypes.YesNo:
      buttonList.push({
        label: "Yes",
        value: ModalResult.ButtonYes
      }, {
        label: "No",
        value: ModalResult.ButtonNo
      })
      break

    case ModalButtonTypes.YesNoCancel:
      buttonList.push({
        label: "Yes",
        value: ModalResult.ButtonYes
      }, {
        label: "No",
        value: ModalResult.ButtonNo
      }, {
        label: "Cancel",
        value: ModalResult.ButtonCancel
      })
      break

    case ModalButtonTypes.Next:
      buttonList.push({
        label: "Next",
        value: ModalResult.ButtonNext
      })

    case ModalButtonTypes.None:
    default:
      break
  }

  const newModal = $(template({
    buttons: buttonList
  }))

  if (alertModal) {
    alertModal.remove()
  }

  alertModal = newModal
  modalHeader = newModal.find(".modal-header")
  modalFooter = newModal.find(".modal-footer")
  modalTitle = newModal.find(".modal-title")
  modalBody = newModal.find(".modal-body > p")
  modalClose = newModal.find(".close.close-modal")
  newModal.find(".close-modal[data-close-value]").on("click", modalButtonClick)
  newModal.on("click", modalBackgroundClick)

  $(document.body).append(newModal)

  modalShowing = true
  if (title != null) {
    modalHeader.show()
    if (htmlEscapeTitle) {
      modalTitle.text(title)
    } else {
      modalTitle.html(title)
    }
  } else {
    modalHeader.hide()
  }

  if (htmlEscapeBody) {
    modalBody.text(message)
  } else {
    modalBody.html(message)
  }

  if (preventClose) {
    modalFooter.hide()
    modalClose.hide()
  } else {
    modalFooter.show()
    modalClose.show()
  }

  if (dialog && buttonList.length > 0) {
    modalFooter.show()
  }

  alertModal.modal({ backdrop: 'static', keyboard: false, show: true })

  modalCanClose = preventClose !== true

  if (dialog) {
    return new Promise((resolve, reject) => {
      modalResolve = resolve
      modalReject = reject
    })
  }

  await sleep(200)

  return ModalResult.ModalShown
}

export function setTitle(title: string, htmlEscape = true) {
  if (!modalHeader || !modalTitle) {
    throw new Error("Modal is not presenting.")
  }

  if (title != null) {
    modalHeader.show()
    if (htmlEscape) {
      modalTitle.text(title)
    } else {
      modalTitle.html(title)
    }
  } else {
    modalHeader.hide()
  }
}

export function setBody(title: string, htmlEscape = true) {
  if (!modalBody) {
    throw new Error("Modal is not presenting.")
  }

  if (htmlEscape) {
    modalBody.text(title)
  } else {
    modalBody.html(title)
  }
}

export function setModal(options: ModalSetOptions) {
  const {
    title,
    htmlEscapeTitle = true,
    message,
    htmlEscapeBody = true
  } = options

  if (title != null) {
    setTitle(title, htmlEscapeTitle)
  }

  if (message != null) {
    setBody(message, htmlEscapeBody)
  }
}

export async function hideModal() {
  if (!alertModal) {
    return
  }

  const backdrop = $("body > .modal-backdrop")
  alertModal.modal("hide")
  await sleep(200)
  backdrop.remove()
  body.removeClass("modal-open").css("padding-right", "")
  modalShowing = false

  if (alertModal) {
    alertModal.remove()
  }

  alertModal =
  modalHeader =
  modalFooter =
  modalTitle =
  modalBody =
  modalClose = undefined

  if (modalResolve) {
    modalResolve(ModalResult.ScriptDismiss)
    modalResolve = undefined
    modalReject = undefined
  }
}
