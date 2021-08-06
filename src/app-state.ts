import clone from 'just-clone'
import equal from 'fast-deep-equal'
import { Observable, liveQuery } from 'dexie'
import { Writable, writable } from 'svelte/store'
import {
  obtainUserContext,
  UserContext,
  ActionRecordWithId,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
  UpdateConfigActionWithId,
  DebtorConfigData,
  TransferRecord,
  IvalidPaymentRequest,
  ServerSessionError,
  ForbiddenOperation,
  WrongTransferData,
  TransferCreationTimeout,
  RecordDoesNotExist,
} from './operations'

type AttemptOptions = {
  alerts?: [Function, Alert | null][],
  startInteraction?: boolean
}

export type AlertOptions = {
  continue?: () => void,
}

let nextAlertId = 1

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
  | TransfersModel
  | TransferModel
  | ConfigDataModel

export type ActionsModel = {
  type: 'ActionsModel',
  actions: Store<ActionRecordWithId[]>,
}

export type ActionModel = {
  type: 'ActionModel',
  action: ActionRecordWithId,
}

export type TransfersModel = {
  type: 'TransfersModel',
  transfers: Store<TransferRecord[]>,
}

export type TransferModel = {
  type: 'TransferModel',
  transfer: Store<TransferRecord>,
  goBack: () => void,
}

export type ConfigDataModel = {
  type: 'ConfigDataModel',
  data: Store<DebtorConfigData>,
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
      alert.options.continue?.()
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
        [IvalidPaymentRequest, new Alert('Invalid payment request')],
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
      if (this.interactionId === interactionId) {
        if (action !== undefined) {
          this.pageModel.set({ type: 'ActionModel', action })
        } else {
          this.addAlert(new Alert('The requested action does not exist.', { continue: () => this.showActions() }))
        }
      }
    })
  }

  showTransfers(): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const transfers = await createLiveQuery(() => this.uc.getTransferRecords())
      if (this.interactionId === interactionId) {
        this.pageModel.set({ type: 'TransfersModel', transfers })
      }
    })
  }

  showTransfer(transferUri: string, back?: () => void): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const transfer = await createLiveQuery(() => this.uc.getTransferRecord(transferUri))
      if (this.interactionId === interactionId) {
        const goBack = back ?? (() => { this.showTransfers() })
        if (getStoreValue(transfer) !== undefined) {
          this.pageModel.set({
            type: 'TransferModel',
            transfer: transfer as Store<TransferRecord>,
            goBack,
          })
        } else {
          this.addAlert(new Alert('The requested transfer does not exist.', { continue: goBack }))
        }
      }
    })
  }

  dismissTransfer(action: AbortTransferActionWithId): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      await this.uc.dismissTransfer(action)
      if (this.interactionId === interactionId) {
        this.showActions()
      }
    })
  }

  cancelTransfer(action: AbortTransferActionWithId, onFailure: () => void): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const canceled = await this.uc.cancelTransfer(action)
      if (canceled) {
        await this.uc.dismissTransfer(action)
      }
      if (this.interactionId === interactionId) {
        if (canceled) {
          this.showActions()
        } else {
          onFailure()
        }
      }
    }, {
      alerts: [
        [ServerSessionError, new Alert('Network error')],
      ],
    })
  }

  async retryTransfer(transferRecord: TransferRecord): Promise<void>
  async retryTransfer(abortTransferAction: AbortTransferActionWithId): Promise<void>
  async retryTransfer(param: TransferRecord | AbortTransferActionWithId): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const createTransferAction = await this.uc.retryTransfer(param as any)
      if (this.interactionId === interactionId) {
        this.showAction(createTransferAction.actionId)
      }
    })
  }

  executeCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    let interactionId: number
    const showActions = () => {
      if (this.interactionId === interactionId) {
        this.showActions()
      }
    }
    const reloadAction = () => {
      if (this.interactionId === interactionId) {
        this.showAction(action.actionId)
      }
    }
    const showTransfer = (transferUri: string) => {
      if (this.interactionId === interactionId) {
        this.showTransfer(transferUri, () => { this.showActions() })
      }
    }

    return this.attempt(async () => {
      interactionId = this.interactionId
      const transferRecord = await this.uc.executeCreateTransferAction(action)
      showTransfer(transferRecord.uri)
    }, {
      alerts: [
        [ServerSessionError, new Alert('Network error', { continue: reloadAction })],
        [ForbiddenOperation, new Alert('Forbidden operation', { continue: reloadAction })],
        [WrongTransferData, new Alert('Wrong transfer data', { continue: reloadAction })],
        [TransferCreationTimeout, new Alert('Transfer creation timeout.', { continue: reloadAction })],
        [RecordDoesNotExist, new Alert('Deleted action', { continue: showActions })],
      ],
    })
  }

  dismissCreateTransferAction(action: CreateTransferActionWithId): Promise<void> {
    let interactionId: number
    const showActions = () => {
      if (this.interactionId === interactionId) this.showActions()
    }

    return this.attempt(async () => {
      interactionId = this.interactionId
      await this.uc.deleteCreateTransferAction(action)
      showActions()
    }, {
      alerts: [
        [RecordDoesNotExist, new Alert('Deleted action', { continue: showActions })],
      ],
    })
  }

  showConfig(): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const data = await createLiveQuery(() => this.uc.getDebtorConfigData())
      if (this.interactionId === interactionId) {
        this.pageModel.set({ type: 'ConfigDataModel', data })
      }
    })
  }

  editConfig(debtorConfigData: DebtorConfigData): Promise<void> {
    return this.attempt(async () => {
      const interactionId = this.interactionId
      const updateConfigAction = await this.uc.editDebtorConfigData(debtorConfigData)
      if (this.interactionId === interactionId) {
        this.showAction(updateConfigAction.actionId)
      }
    })
  }

  updateActionRecord(original: ActionRecordWithId, updated: ActionRecordWithId): Promise<void> {
    assert(original.actionId === updated.actionId)
    if (equal(original, updated)) {
      return Promise.resolve()
    }

    return this.attempt(async () => {
      await this.uc.replaceActionRecord(original, updated)
    }, {
      alerts: [
        [RecordDoesNotExist, null],
      ],
    })
  }

  executeUpdateConfigAction(action: UpdateConfigActionWithId): Promise<void> {
    let interactionId: number
    const showActions = () => {
      if (this.interactionId === interactionId) {
        this.showActions()
      }
    }
    const reloadAction = () => {
      if (this.interactionId === interactionId) {
        this.showAction(action.actionId)
      }
    }

    return this.attempt(async () => {
      interactionId = this.interactionId
      await this.uc.executeUpdateConfigAction(action)
      showActions()
    }, {
      alerts: [
        [ServerSessionError, new Alert('Network error')],
        [RecordDoesNotExist, new Alert('The requested configuration changes can not be saved.', { continue: reloadAction })],
      ],
    })
  }

  dismissUpdateConfigAction(action: UpdateConfigActionWithId): Promise<void> {
    let interactionId: number
    const showActions = () => {
      if (this.interactionId === interactionId) this.showActions()
    }

    return this.attempt(async () => {
      interactionId = this.interactionId
      await this.uc.deleteUpdateConfigAction(action)
      showActions()
    }, {
      alerts: [
        [RecordDoesNotExist, new Alert('The action can not be dismissed.', { continue: showActions })],
      ],
    })
  }

  createActionUpdater<T extends ActionRecordWithId>(action: T, onFailure?: () => void) {
    let updatePromise = Promise.resolve()

    const replace = async (next: T): Promise<void> => {
      await updatePromise
      if (!equal(action, next)) {
        assert(action.actionId === next.actionId)
        try {
          await this.uc.replaceActionRecord(action, action = next)
        } catch (e: unknown) {
          if (e instanceof RecordDoesNotExist) onFailure?.()
          throw e
        }
      }
    }
    // TODO: show hourglass?
    const update = async (updatedAction: T): Promise<void> => {
      updatePromise = replace(clone(updatedAction))
      await updatePromise
    }

    return update
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
          break
        case null:
          // ignore the error
          break
        default:
          this.addAlert(alert)
      }
      throw e
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

function getStoreValue<T>(store: Store<T>): T {
  let value: T | undefined
  const unsubscribe = store.subscribe(v => { value = v })
  unsubscribe()
  return value as T
}
