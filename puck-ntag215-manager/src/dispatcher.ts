import { EventEmitter } from "events"

/**
 * @hidden
 */
export class EventDispatcher extends EventEmitter {

    // tslint:disable-next-line:array-type
    addEventListener(event: string | symbol, listener: (...args: any[]) => void) {
        return super.addListener(event, listener)
    }

    // tslint:disable-next-line:array-type
    removeEventListener(event: string | symbol, listener: (...args: any[]) => void) {
        return super.removeListener(event, listener)
    }

    dispatchEvent(eventType: string | symbol, event?: any) {
        return super.emit(eventType, event)
    }
}
