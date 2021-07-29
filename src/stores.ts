import { Observable, liveQuery } from 'dexie'
import { Writable, writable } from 'svelte/store'
import { UserContext, IvalidPaymentRequest, obtainUserContext } from './operations'
import type { ActionRecordWithId } from './operations/db'

const UNEXPECTED_ERROR = 'Unexpected error occurred.'

export type Store<T> = {
  subscribe(next: (value: T) => void): (() => void)
}

export type RootState = {
  alerts: Alert[],
  model: Store<ViewModel>,
}

export type Alert = string

export type ViewModel =
  | ActionsModel
  | ActionModel

export type ActionsModel = {
  type: 'Actions',
  actions: Store<ActionRecordWithId[]>,
}

export type ActionModel = {
  type: 'Action',
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

class AppState {
  route = '/actions'
  readonly alerts: Writable<Alert[]>
  readonly page: Writable<ViewModel>

  constructor(private uc: UserContext, actions: Store<ActionRecordWithId[]>) {
    this.alerts = writable([])
    this.page = writable({ type: 'Actions', actions })
  }

  addAlert(alert: Alert): void {
    this.alerts.update(arr => [...arr, alert])
  }

  dismissAlert(alert: Alert): void {
    this.alerts.update(arr => arr.filter(a => a !== alert))
  }

  async initiatePayment(paymentRequestFile: Promise<Blob>) {
    const route = this.route
    const action = await this.attempt(
      async () => {
        const blob = await paymentRequestFile
        return await this.uc.processPaymentRequest(blob)
      },
      [
        [IvalidPaymentRequest, 'Invalid payment request.'],
      ]
    )
    if (this.route === route) {
      this.showAction(action.actionId)
    }
  }

  async showAction(actionId: number) {
    const route = this.route = `/actions/${actionId}`
    const action = await createLiveQuery(() => this.uc.getActionRecord(actionId))
    if (this.route === route) {
      this.page.set({ type: 'Action', action })
    }
  }

  private async attempt<T>(func: () => Promise<T>, alerts: [Function, Alert][] = []): Promise<T> {
    const alertFromError = (error: unknown): Alert | undefined => {
      let alert
      if (error && typeof error === 'object') {
        const errorConstructor = error.constructor
        alert = alerts.find(element => element[0] === errorConstructor)?.[1]
      }
      return alert
    }
    try {
      return await func()
    } catch (e: unknown) {
      const alert = alertFromError(e)
      if (alert) {
        this.addAlert(alert)
      } else {
        this.addAlert(UNEXPECTED_ERROR)
        console.error(e)
      }
      throw e
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
