import equal from 'fast-deep-equal'
import { Observable, liveQuery } from 'dexie'
import { Writable, writable } from 'svelte/store'
import { UserContext, IvalidPaymentRequest, obtainUserContext } from './operations'
import type { ActionRecordWithId } from './operations/db'

let nextAlertId = 1

export class Alert {
  readonly id: number

  constructor(public message: string) {
    this.id = nextAlertId++
  }
}

export type Store<T> = {
  subscribe(next: (value: T) => void): (() => void)
}

export type RootState = {
  alerts: Alert[],
  model: Store<ViewModel>,
}

export type ViewModel =
  | ActionsModel
  | ActionModel

export type ActionsModel = {
  type: 'ActionsPage',
  actions: Store<ActionRecordWithId[]>,
}

export type ActionModel = {
  type: 'ActionPage',
  action: Store<ActionRecordWithId | undefined>,
}

export async function createAppState(): Promise<AppState | undefined> {
  let appState
  const userContext = await obtainUserContext()
  if (userContext) {
    const actions = await createLiveQuery(() => userContext.getActionRecords())
    appState = new AppState(userContext, actions)
  }
  return appState
}

export class AppState {
  private route: number = 0
  readonly alerts: Writable<Alert[]>
  readonly page: Writable<ViewModel>

  constructor(private uc: UserContext, actions: Store<ActionRecordWithId[]>) {
    this.alerts = writable([])
    this.page = writable({ type: 'ActionsPage', actions })
  }

  private changeRoute(): number {
    return ++this.route
  }

  addAlert(alert: Alert): void {
    this.attempt(async () => {
      this.alerts.update(arr => [...arr, alert])
    })
  }

  dismissAlert(alert: Alert): void {
    this.attempt(async () => {
      this.alerts.update(arr => arr.filter(a => !equal(a, alert)))
    })
  }

  initiatePayment(paymentRequestFile: Promise<Blob>): void {
    this.attempt(async () => {
      const route = this.route
      const blob = await paymentRequestFile
      const action = await this.uc.processPaymentRequest(blob)
      if (this.route === route) {
        this.showAction(action.actionId)
      }
    }, [
      [IvalidPaymentRequest, new Alert('Invalid payment request.')],
    ])
  }

  showActions(): void {
    this.attempt(async () => {
      const route = this.changeRoute()
      const actions = await createLiveQuery(() => this.uc.getActionRecords())
      if (this.route === route) {
        this.page.set({ type: 'ActionsPage', actions })
      }
    })
  }

  showAction(actionId: number): void {
    this.attempt(async () => {
      const route = this.changeRoute()
      const action = await createLiveQuery(() => this.uc.getActionRecord(actionId))
      if (this.route === route) {
        this.page.set({ type: 'ActionPage', action })
      }
    })
  }

  private async attempt(func: () => unknown, alerts: [Function, Alert | null][] = []): Promise<void> {
    const alertFromError = (error: unknown): Alert | null | undefined => {
      let alert
      if (error && typeof error === 'object') {
        const errorConstructor = error.constructor
        alert = alerts.find(element => element[0] === errorConstructor)?.[1]
      }
      return alert
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
          return
        default:
          this.addAlert(alert)
          return
      }
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
