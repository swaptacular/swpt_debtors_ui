import type { Observable } from 'dexie'

export async function createStore<T>(observable: Observable<T>) {
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
    subscribe(next: (value: T) => void): (() => void) {
      let called = false
      const subscription = observable.subscribe(
        value => { next(currentValue = value); called = true },
        error => { console.error(error) },
      )
      if (!called) {
        next(currentValue)
      }
      return subscription.unsubscribe
    }
  }
}
