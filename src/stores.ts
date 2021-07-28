import type { Observable } from 'dexie'

/* Returns a promise for an object that satisfies Svelte's store
 * contract. Svelte stores are required to call the `onNext` method
 * synchronously, but observables are not required to do so. This
 * function awaits for the first value on the observable to appear, so
 * that the created store can return it on subscription. */
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
