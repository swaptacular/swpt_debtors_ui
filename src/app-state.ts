import equal from 'fast-deep-equal'
import { Observable, liveQuery } from 'dexie'
import { Writable, writable } from 'svelte/store'
import {
  obtainUserContext,
  UserContext,
  ActionRecordWithId,
  IvalidPaymentRequest,
} from './operations'

let nextAlertId = 1

type AttemptOptions = {
  alerts?: [Function, Alert | null][],
  startInteraction?: boolean
}

export type AlertOptions = {
  continue?: () => void,
}

export class Alert {
  readonly id: number

  constructor(public message: string, public options: AlertOptions = {}) {
    this.id = nextAlertId++
  }
}

export type Store<T> = {
  subscribe(next: (value: T) => void): (() => void)
}

export type PageModel =
  | ActionsModel
  | ActionModel

export type ActionsModel = {
  type: 'ActionsModel',
  actions: Store<ActionRecordWithId[]>,
}

export type ActionModel = {
  type: 'ActionModel',
  action: ActionRecordWithId,
}

export class AppState {
  private interactionId: number = 0
  readonly waitingInteractions: Writable<Set<number>>
  readonly alerts: Writable<Alert[]>
  readonly pageModel: Writable<PageModel>

  constructor(private uc: UserContext, actions: Store<ActionRecordWithId[]>) {
    this.waitingInteractions = writable(new Set())
    this.alerts = writable([])
    this.pageModel = writable({ type: 'ActionsModel', actions })
  }

  addAlert(alert: Alert): Promise<void> {
    return this.attempt(async () => {
      this.alerts.update(arr => [...arr, alert])
    }, {
      startInteraction: false,
    })
  }

  dismissAlert(alert: Alert): Promise<void> {
    return this.attempt(async () => {
      this.alerts.update(arr => arr.filter(a => !equal(a, alert)))
    }, {
      startInteraction: false,
    })
  }

  initiatePayment(paymentRequestFile: Blob | Promise<Blob>): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const blob = await paymentRequestFile
      const action = await this.uc.processPaymentRequest(blob)
      if (this.interactionId === interactionId) {
        this.showAction(action.actionId)
      }
    }, {
      alerts: [
        [IvalidPaymentRequest, new Alert('Invalid payment request.')],
      ],
    })
  }

  showActions(): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const actions = await createLiveQuery(() => this.uc.getActionRecords())
      if (this.interactionId === interactionId) {
        this.pageModel.set({ type: 'ActionsModel', actions })
      }
    })
  }

  showAction(actionId: number): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const action = await this.uc.getActionRecord(actionId)
      if (this.interactionId === interactionId && action !== undefined) {
        this.pageModel.set({ type: 'ActionModel', action })
      }
    })
  }

  /* Awaits `func()`, catching and logging thrown
   * errors. `options.alerts` determines what alert should be shown on
   * what error. `option.startInteraction` determines whether a
   * hourglass should be shown when the operation had not been
   * completed after some time. */
  private async attempt(func: () => unknown, options: AttemptOptions = {}): Promise<void> {
    const { alerts = [], startInteraction = true } = options

    const addWaitingInteraction = () => {
      this.waitingInteractions.update(originalSet => {
        const updatedSet = new Set(originalSet)
        updatedSet.add(interactionId)
        return updatedSet
      })
      addedWaitingInteraction = true
    }
    const clearWaitingInteraction = () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }
      if (addedWaitingInteraction) {
        this.waitingInteractions.update(originalSet => {
          const updatedSet = new Set(originalSet)
          updatedSet.delete(interactionId)
          return updatedSet
        })
      }
    }
    const alertFromError = (error: unknown): Alert | null | undefined => {
      let alert
      if (error && typeof error === 'object') {
        const errorConstructor = error.constructor
        alert = alerts.find(element => element[0] === errorConstructor)?.[1]
      }
      return alert
    }

    let addedWaitingInteraction = false
    let timeoutId: number | undefined
    let interactionId: number
    if (startInteraction) {
      interactionId = ++this.interactionId
      timeoutId = setTimeout(addWaitingInteraction, 250)
    } else {
      interactionId = this.interactionId
    }

    try {
      await func()
    } catch (e: unknown) {
      const alert = alertFromError(e)
      switch (alert) {
        case undefined:
          console.error(e)
          this.addAlert(new Alert('An unexpected error has occurred.'))
          throw e
        case null:
          // ignore the error
          break
        default:
          this.addAlert(alert)
      }
    } finally {
      clearWaitingInteraction()
    }
  }

}

/* Returns a promise for an object that satisfies Svelte's store
 * contract. Svelte stores are required to call the `onNext` method
 * synchronously, but observables are not required to do so. This
 * function awaits for the first value on the observable to appear, so
 * that the created store can return it on subscription. */
export async function createStore<T>(observable: Observable<T>): Promise<Store<T>> {
  let onNext: any
  let onError: any
  const valuePromise = new Promise<T>((resolve, reject) => {
    onNext = resolve
    onError = reject
  })
  const subscription = observable.subscribe(onNext, onError, () => onError(new Error('no value')))
  let currentValue = await valuePromise
  subscription.unsubscribe()

  return {
    subscribe(next) {
      let called = false
      const callNext = (value: T) => {
        if (!(called && currentValue === value)) {
          next(currentValue = value)
          called = true
        }
      }
      const subscription = observable.subscribe(callNext, error => { console.error(error) })
      callNext(currentValue)
      return subscription.unsubscribe
    }
  }
}

export function createLiveQuery<T>(querier: () => T | Promise<T>): Promise<Store<T>> {
  return createStore(liveQuery(querier))
}

export async function createAppState(): Promise<AppState | undefined> {
  const uc = await obtainUserContext()
  if (uc) {
    const actions = await createLiveQuery(() => uc.getActionRecords())
    return new AppState(uc, actions)
  }
  return undefined
}