import equal from 'fast-deep-equal'
import { Observable, liveQuery } from 'dexie'
import { Writable, writable } from 'svelte/store'
import { amountToString, stringToAmount } from './utils'
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
  AuthenticationError,
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

export type ActionManager = {
  markDirty: () => void
  save: () => Promise<void>,
  remove: () => Promise<void>,
  execute: () => Promise<void>,
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
  | MakePaymentModel

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
}

export type MakePaymentModel = {
  type: 'MakePaymentModel'
}
export class AppState {
  private interactionId: number = 0
  readonly waitingInteractions: Writable<Set<number>>
  readonly alerts: Writable<Alert[]>
  readonly pageModel: Writable<PageModel>
  readonly noteMaxBytes: number
  readonly getDebtorConfigData: () => DebtorConfigData

  constructor(private uc: UserContext, actions: Store<ActionRecordWithId[]>) {
    this.waitingInteractions = writable(new Set())
    this.alerts = writable([])
    this.pageModel = writable({ type: 'ActionsModel', actions })
    this.noteMaxBytes = uc.noteMaxBytes
    this.getDebtorConfigData = uc.getDebtorConfigData.bind(uc)
  }

  get unit(): string {
    return this.getDebtorConfigData().debtorInfo?.unit ?? '\u00A4'
  }

  amountToString(amount: bigint): string {
    const { amountDivisor = 1, decimalPlaces = 0 } = this.getDebtorConfigData().debtorInfo ?? {}
    return amountToString(amount, amountDivisor, decimalPlaces)
  }

  stringToAmount(s: string): bigint {
    const { amountDivisor = 1 } = this.getDebtorConfigData().debtorInfo ?? {}
    return stringToAmount(s, amountDivisor)
  }

  fetchDataFromServer(): Promise<void> {
    return this.attempt(async () => {
      await this.uc.ensureAuthenticated()
      this.uc.scheduleUpdate()
    }, {
      startInteraction: false,
      alerts: [
        [AuthenticationError, null],
        [ServerSessionError, new Alert('Network error')],
      ],
    })
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

  scanQrCode(): Promise<void> {
    this.pageModel.set({ type: 'MakePaymentModel' })
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

  executeCreateTransferAction(action: CreateTransferActionWithId, prepare?: Promise<void>): Promise<void> {
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
      await prepare
      const transferRecord = await this.uc.executeCreateTransferAction(action)
      showTransfer(transferRecord.uri)
    }, {
      alerts: [
        [ServerSessionError, new Alert('Network error', { continue: reloadAction })],
        [ForbiddenOperation, new Alert('Forbidden operation', { continue: reloadAction })],
        [WrongTransferData, new Alert('Wrong transfer data', { continue: reloadAction })],
        [TransferCreationTimeout, new Alert('Transfer creation timeout.', { continue: reloadAction })],
        [RecordDoesNotExist, new Alert('The requested action can not be performed.', { continue: showActions })],
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
      if (this.interactionId === interactionId) {
        this.pageModel.set({ type: 'ConfigDataModel' })
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

  executeUpdateConfigAction(action: UpdateConfigActionWithId, prepare?: Promise<void>): Promise<void> {
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
      await prepare
      await this.uc.executeUpdateConfigAction(action)
      showActions()
    }, {
      alerts: [
        [ServerSessionError, new Alert('Network error')],
        [RecordDoesNotExist, new Alert('The requested action can not be performed.', { continue: reloadAction })],
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

  createActionManager<T extends ActionRecordWithId>(action: T, createValue: () => T): ActionManager {
    let updatePromise = Promise.resolve()
    let latestValue = action
    let isDirty = false

    const ignoreRecordDoesNotExistErrors = (error: unknown) => {
      if (error instanceof RecordDoesNotExist) {
        console.log('A "RecordDoesNotExist" error has occured during saving.')
        return Promise.resolve()
      } else {
        return Promise.reject(error)
      }
    }
    const store = async (value: T): Promise<void> => {
      await updatePromise
      if (!equal(action, value)) {
        assert(action.actionId === value.actionId)
        assert(action.actionType === value.actionType)
        await this.uc.replaceActionRecord(action, action = value)
      }
    }
    const markDirty = (): void => {
      if (!isDirty) {
        isDirty = true
        addEventListener('beforeunload', save, { capture: true })
        setTimeout(save, 5000)
      }
    }
    const save = (): Promise<void> => {
      latestValue = createValue()
      updatePromise = store(latestValue).catch(ignoreRecordDoesNotExistErrors)
      isDirty = false
      removeEventListener('beforeunload', save, { capture: true })
      return updatePromise
    }
    const remove = async (): Promise<void> => {
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
        await store(latestValue)
        await this.uc.replaceActionRecord(latestValue, null)
        showActions()
      }, {
        alerts: [
          [RecordDoesNotExist, new Alert('The action can not be removed.', { continue: reloadAction })],
        ],
      })
    }
    const execute = (): Promise<void> => {
      const prepare = save()
      switch (latestValue.actionType) {
        case 'CreateTransfer':
          return this.executeCreateTransferAction(latestValue as CreateTransferActionWithId, prepare)
        case 'UpdateConfig':
          return this.executeUpdateConfigAction(latestValue as UpdateConfigActionWithId, prepare)
        default:
          const e = new Error('unknown action type')
          console.error(e)
          this.addAlert(new Alert('An unexpected error has occurred.'))
          throw e
      }
    }

    return { markDirty, save, remove, execute }
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
      for (const [errorConstructor, alert] of alerts) {
        if (error instanceof errorConstructor) {
          return alert
        }
      }
      return undefined
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

function getStoreValue<T>(store: Store<T>): T {
  let value: T | undefined
  const unsubscribe = store.subscribe(v => { value = v })
  unsubscribe()
  return value as T
}
