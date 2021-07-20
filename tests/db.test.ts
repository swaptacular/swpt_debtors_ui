import {
  db,
  DebtorRecord,
  UserDoesNotExist,
  RecordDoesNotExist,
  ActionRecordWithId,
  CreateTransferActionWithId,
  AbortTransferActionWithId,
} from '../src/operations/db'

test("Install and uninstall user", async () => {
  const debtor = {
    type: 'Debtor',
    uri: 'https://example.com/debtors/1/',
    createTransfer: { uri: 'https://example.com/1/transfers/' },
    saveDocument: { uri: 'https://example.com/1/documents/' },
    publicInfoDocument: { uri: 'https:/example.com/1/public' },
    transfersList: { uri: 'https://example.com/1/transfers/' },
    noteMaxBytes: 200n,
    identity: { type: 'DebtorIdentity', uri: 'swpt:1234' },
    balance: 20000n,
    createdAt: '2020-01-01T00:00:00Z',
    config: {
      uri: 'config',
      latestUpdateAt: '2020-01-01T00:00:00Z',
      latestUpdateId: 1n,
      configData: '',
      debtor: { uri: 'https://example.com/1/' }
    },
  }
  const now = Date.now()
  const isoNow = new Date(now).toISOString()
  const isoNow2 = new Date(now + 100).toISOString()
  const transfers = [{
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/xxxxxxxxx',
    recipient: { uri: 'swpt:1/2' },
    amount: 1000n,
    transferUuid: 'xxxxxxxxx',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '',
    noteFormat: '',
    initiatedAt: isoNow,
    result: {
      type: 'TransferResult',
      finalizedAt: isoNow,
      committedAmount: 1000n,
    },
  }, {
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/yyyyyyyyy',
    recipient: { uri: 'swpt:1/2' },
    amount: 666n,
    transferUuid: 'yyyyyyyyy',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '',
    noteFormat: '',
    initiatedAt: isoNow2,
    result: {
      type: 'TransferResult',
      finalizedAt: isoNow,
      committedAmount: 0n,
      error: {
        type: 'TransferError',
        errorCode: 'TEST_ERROR',
      },
    },
  }]
  const transferUris = ['https://example.com/1/transfers/xxxxxxxxx', 'https://example.com/1/transfers/yyyyyyyyy']
  const document = {
    uri: 'https://example.com/1/documents/123',
    contentType: 'text/plain',
    content: new ArrayBuffer(0),
    sha256: '',
  }
  const collectedAfter = new Date()
  await db.storeUserData({ collectedAfter, debtor, transferUris, transfers, document })
  const userId = await db.storeUserData({ collectedAfter, debtor, transferUris, transfers, document })
  const debtorRecord = await db.getDebtorRecord(userId) as DebtorRecord
  expect(debtorRecord.userId).toEqual(userId)
  expect(debtorRecord.config.uri).toBe('config')
  expect(debtorRecord.config).toEqual({ uri: 'config' })
  await expect(db.getUserId(debtor.uri)).resolves.toBeDefined()
  await expect(db.getConfigRecord(userId)).resolves.toEqual({
    ...debtor.config,
    uri: 'https://example.com/debtors/1/config',
    userId,
  })
  await expect(db.getTransferRecords(userId)).resolves.toEqual(
    [{
      ...transfers[1], userId, time: new Date(isoNow2).getTime(),
      paymentInfo: { payeeName: '', payeeReference: '', description: { content: '', contentFormat: '' } }
    },
    {
      ...transfers[0], userId, time: new Date(isoNow).getTime(),
      paymentInfo: { payeeName: '', payeeReference: '', description: { content: '', contentFormat: '' } }
    }]
  )
  await expect(db.getDocumentRecord('https://example.com/1/documents/123')).resolves.toEqual({ ...document, userId })
  const actions = await db.getActionRecords(userId)
  expect(actions.length).toBe(1)
  expect(actions[0].actionType).toBe('AbortTransfer')
  await db.replaceActionRecord(actions[0], null)
  await expect(db.getActionRecords(userId)).resolves.toEqual([])

  const actionRecord = {
    actionId: undefined,
    userId,
    actionType: 'AbortTransfer',
    createdAt: new Date(),
    transferUri: 'https://example.com/1/transfers/xxxxxxxx',
  } as const
  await expect(db.getActionRecord(456)).resolves.toBeUndefined()
  await expect(db.createActionRecord({ ...actionRecord, userId: -1 })).rejects.toBeInstanceOf(UserDoesNotExist)

  let actionId = await db.createActionRecord(actionRecord)
  expect(actionId).toBeDefined()
  expect(actionRecord.actionId).toEqual(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeDefined()
  const ar2 = { ...actionRecord, actionId: undefined }
  await expect(db.replaceActionRecord({ ...actionRecord, actionId }, ar2)).resolves.toBeUndefined()
  expect(ar2.actionId).toBeDefined()
  expect(ar2.actionId).toBeGreaterThan(actionId)
  await expect(db.getActionRecord(actionId)).resolves.toBeUndefined()
  const ar3 = { ...actionRecord, actionId: undefined }
  await expect(db.replaceActionRecord({ ...actionRecord, actionId }, ar3)).rejects.toBeInstanceOf(RecordDoesNotExist)
  await expect(db.getActionRecords(userId)).resolves.toEqual([ar2])
  await expect(db.replaceActionRecord(ar2 as any as ActionRecordWithId, null)).resolves.toBeUndefined()
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  const x = await db.createActionRecord({ ...actionRecord, actionId: undefined })
  await expect(db.getActionRecords(userId)).resolves.toEqual([{ ...actionRecord, actionId: x }])
  await expect(db.replaceActionRecord(
    { ...actionRecord, actionId: x },
    { ...actionRecord, actionId: x, transferUri: 'https://example.com/1/transfers/updated' },
  )).resolves.toBeUndefined()
  await expect(db.getActionRecords(userId)).resolves.toEqual([
    { ...actionRecord, actionId: x, transferUri: 'https://example.com/1/transfers/updated' }
  ])
  await expect(db.replaceActionRecord(
    { ...actionRecord, actionId: -1, transferUri: 'https://example.com/1/transfers/updated' },
    { ...actionRecord, actionId: -1, transferUri: 'https://example.com/1/transfers/updated-again' },
  )).rejects.toBeInstanceOf(RecordDoesNotExist)

  const theCreatedTransfer = {
    type: 'Transfer',
    uri: 'https://example.com/1/transfers/123e4567-e89b-12d3-a456-426655440000',
    recipient: { uri: 'swpt:1/2' },
    amount: 777n,
    transferUuid: '123e4567-e89b-12d3-a456-426655440000',
    transfersList: { uri: 'https://example.com/1/transfers/' },
    note: '',
    noteFormat: '',
    initiatedAt: isoNow,
  }
  let createTransferAction = {
    userId,
    actionType: 'CreateTransfer' as const,
    createdAt: new Date(),
    creationRequest: {
      recipient: { uri: 'swpt:1/2' },
      amount: 777n,
      transferUuid: '123e4567-e89b-12d3-a456-426655440000',
    },
    paymentInfo: {
      payeeName: 'XYZ',
      payeeReference: '',
      description: {
        contentFormat: '',
        content: '',
      }
    },
    requestedAmount: 0n,
  }
  await expect(db.createTransferRecord({ ...createTransferAction, actionId: -1 }, theCreatedTransfer))
    .rejects.toBeInstanceOf(RecordDoesNotExist)
  const createTransferActionId = await db.createActionRecord(createTransferAction)
  expect(createTransferActionId).toBeDefined()
  const transferRecord = await db.createTransferRecord(
    createTransferAction as any as CreateTransferActionWithId, theCreatedTransfer)
  expect(transferRecord.time).toBeDefined()
  await expect(db.getActionRecord(createTransferActionId)).resolves.toBe(undefined)

  const theDebtorConfig = {
    type: 'DebtorConfig',
    uri: 'https://example.com/debtors/1/config',
    latestUpdateId: 2n,
    latestUpdateAt: isoNow,
    debtor: { uri: '/debtors/1/' },
    configData: '',
  }
  await expect(db.updateConfig(-1, theDebtorConfig)).rejects.toBeInstanceOf(RecordDoesNotExist)
  const updateConifgActionId = await db.createActionRecord({
    userId,
    actionType: 'UpdateConfig',
    createdAt: new Date(),
    interestRate: 5.0,
    debtorInfo: {
      debtorName: 'USA',
      amountDivisor: 100,
      decimalPlaces: 2,
      unit: 'USD',
    },
  })
  expect(createTransferActionId).toBeDefined()
  const configRecord = await db.updateConfig(updateConifgActionId, theDebtorConfig)
  expect(configRecord.configData).toBeDefined()
  await expect(db.getActionRecord(updateConifgActionId)).resolves.toBe(undefined)

  await expect(db.replaceActionRecord(
    { userId, createdAt: new Date(), actionId: -1, actionType: 'AbortTransfer', transferUri: 'xxx' }, null
  )).rejects.toBeInstanceOf(RecordDoesNotExist)
  const abortTransferAction = {
    userId,
    actionType: 'AbortTransfer' as const,
    createdAt: new Date(),
    transferUri: transfers[1].uri,
  }
  const abortTransferActionId = await db.createActionRecord(abortTransferAction)
  expect(abortTransferActionId).toBeDefined()
  await db.replaceActionRecord(abortTransferAction as AbortTransferActionWithId, null)
  await expect(db.getActionRecord(abortTransferActionId)).resolves.toBe(undefined)
  await expect(db.getTransferRecord(transfers[1].uri)).resolves.toHaveProperty('aborted')

  const paymentInfo = {
    payeeName: '',
    payeeReference: '',
    description: {
      content: '',
      contentFormat: '',
    }
  }
  const t = transfers[0]
  const time = new Date(t.initiatedAt).getTime()
  await expect((db as any).storeTransfer(userId, t)).resolves.toEqual({
    ...t,
    userId,
    time: time,
    paymentInfo,
  })
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({ ...t, userId, time, paymentInfo })
  await expect((db as any).storeTransfer(userId, t)).resolves.toEqual({
    ...t,
    userId,
    time: time,
    paymentInfo,
  })
  await expect(db.getTransferRecord(t.uri)).resolves.toEqual({ ...t, userId, time, paymentInfo })
  await expect((db as any).storeTransfer(userId + 1, t)).rejects.toBeInstanceOf(UserDoesNotExist)
  const alteredUri = t.uri + '/something'
  await expect((db as any).storeTransfer(userId, { ...t, uri: alteredUri })).resolves.toEqual({
    ...t,
    userId,
    uri: alteredUri,
    time: time * (1 + Number.EPSILON) * (1 + Number.EPSILON),
    paymentInfo,
  })
  await expect(db.getTransferRecord(t.uri + '/something')).resolves.toEqual({
    ...t,
    userId,
    uri: alteredUri,
    time: time * (1 + Number.EPSILON) * (1 + Number.EPSILON),
    paymentInfo,
  })

  await db.uninstallUser(userId)
  await expect(db.getUserId(debtor.uri)).resolves.toBeUndefined()
  await expect(db.getDebtorRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getConfigRecord(userId)).rejects.toBeInstanceOf(UserDoesNotExist)
  await expect(db.getTransferRecords(userId)).resolves.toEqual([])
  await expect(db.getActionRecords(userId)).resolves.toEqual([])
  await expect(db.getDocumentRecord('https://example.com/1/documents/123')).resolves.toEqual(undefined)
})
