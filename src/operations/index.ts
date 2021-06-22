import { db, DebtorRecord, CreateTransferAction, ActionRecordWithId } from './db'
import { getUserInstallationData } from './utils'
import { server, ServerSessionError } from './server'
import { v4 as uuidv4 } from 'uuid';
import { parsePaymentRequest, IvalidPaymentRequest } from './payment-requests'

export { IvalidPaymentRequest }

let userIdPromise: Promise<number> | undefined

async function getUserId(): Promise<number> {
  if (!userIdPromise) {
    userIdPromise = (async () => {
      const entrypoint = await server.entrypointPromise
      if (entrypoint === undefined) {
        throw new Error('user not logged in')
      }
      const userId = await db.getUserId(entrypoint)
      if (userId === undefined) {
        throw new Error('user not installed')
      }
      return userId
    })()
  }
  return userIdPromise
}

/* This must be awaited before calling any other function exported by
 * this module. If it returns `false` the caller must not call any
 * other functions in this module, except `login`. */
export async function seeIfLoggedIn(): Promise<boolean> {
  const entrypoint = await server.entrypointPromise
  if (entrypoint === undefined) {
    return false
  }
  let alreadyTriedToUpdate = false
  while (await db.getUserId(entrypoint) === undefined) {
    if (alreadyTriedToUpdate) {
      await logout()
    }
    await update()
    alreadyTriedToUpdate = true
  }
  return true
}

/* Tries to update the local database, reading the latest data from
 * the server. Any network failures will be swallowed. This function
 * should be called at the beginning of the session, right after
 * `seeIfLoggedIn`, and may be called periodically afterwards. */
export async function update(): Promise<void> {
  let data
  try {
    data = await getUserInstallationData()
  } catch (e: unknown) {
    if (e instanceof ServerSessionError) {
      return
    } else throw e
  }
  await db.storeUserData(data)
}

/* If the user is logged in -- does nothing. Otherwise, redirects to
 * the login page, and never resolves. */
export async function login(): Promise<void> {
  await server.login(async (login) => await login())
}

/* Logs out the user and redirects to home, never resolves. */
export async function logout(): Promise<never> {
  return await server.logout()
}

export async function getDebtorRecord(): Promise<DebtorRecord> {
  return await db.getDebtorRecord(await getUserId())
}

export async function processPaymentRequest(blob: Blob): Promise<ActionRecordWithId & CreateTransferAction> {
  const request = await parsePaymentRequest(blob)  // may throw `IvalidPaymentRequest`
  const actionRecord = {
    userId: await getUserId(),
    actionType: 'CreateTransfer' as const,
    createdAt: new Date(),
    creationRequest: {
      type: 'TransferCreationRequest',
      recipient: { uri: request.accountUri },
      amount: request.amount,
      transferUuid: uuidv4(),
      noteFormat: 'payeeref',
      note: request.payeeReference,
    },
    paymentInfo: {
      payeeName: request.payeeName,
      paymentRequest: new Blob([blob], { type: request.contentType }),
    }
  }
  await db.createActionRecord(actionRecord)  // This adds actionId to `actionRecord`.
  return actionRecord as ActionRecordWithId & CreateTransferAction
}
