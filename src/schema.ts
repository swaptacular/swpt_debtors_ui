export type DebtorReservationRequest = {
  /** The type of this object. */
  type?: string;
};

export type DebtorReservation = {
  /** A number that will be needed in order to activate the debtor. */
  reservationId: BigInt;

  /** The type of this object. */
  type: string;

  /** The moment at which the reservation will expire. */
  validUntil: string;

  /** The reserved debtor ID. */
  debtorId: string;

  /** The moment at which the reservation was created. */
  createdAt: string;
};

export type Error = {
  /** Error code */
  code?: BigInt;

  /** Error name */
  status?: string;

  /** Error message */
  message?: string;

  /** Errors */
  errors?: { [key: string]: any };
};

export type DebtorsList = {
  /** The URI of this object. Can be a relative URI. */
  uri: string;

  /** The URI of the first page in the paginated list. This can be a
   * relative URI. The object retrieved from this URI will have: 1) An
   * `items` field (an array), which will contain the first items of
   * the paginated list; 2) May have a `next` field (a string), which
   * would contain the URI of the next page in the list. */
  first: string;

  /** The type of this object. */
  type: string;

  /** The type of the items in the paginated list. */
  itemsType: string;
};

export type ObjectReference = {
  /** The URI of the object. Can be a relative URI. */
  uri: string;
};

export type ObjectReferencesPage = {

  /** The URI of this object. Can be a relative URI. */
  uri: string;

  /** An URI of another `ObjectReferencesPage` object which contains
   * more items. When there are no remaining items, this field will
   * not be present. If this field is present, there might be
   * remaining items, even when the `items` array is empty. This can
   * be a relative URI. */
  next?: string;

  /** The type of this object. */
  type: string;

  /** An array of `ObjectReference`s. Can be empty. */
  items: ObjectReference[];
};

export type DebtorActivationRequest = {
  /** The type of this object. */
  type?: string;

  /** When this field is present, the server will try to activate an
   * existing reservation with matching `debtorID` and
   * `reservationID`. When this field is not present, the server will
   * try to reserve the debtor ID specified in the path, and activate
   * it at once. */
  reservationId?: BigInt;
};

export type AccountIdentity = {
  /**
   * The information contained in this field must be enough to: 1)
   * uniquely and reliably identify the debtor, 2) uniquely and
   * reliably identify the creditor's account with the debtor. Note
   * that a network request *should not be needed* to identify the
   * account.
   *
   * For example, if the debtor happens to be a bank, the URI would
   * reveal the type of the debtor (a bank), the ID of the bank, and
   * the bank account number.
   */
  uri: string;

  /** The type of this object. */
  type?: string;
};

export type DebtorIdentity = {
  /** The information contained in this field must be enough to
   * uniquely and reliably identify the debtor. Note that a network
   * request *should not be needed* to identify the debtor. */
  uri: string;

  /** The type of this object. */
  type?: string;
};

export type DebtorConfig = {
  /** The moment of the latest update on this object. */
  latestUpdateAt: string;

  /** The URI of this object. Can be a relative URI. */
  uri: string;

  /**
   * The sequential number of the latest update in the object. This
   * will always be a positive number, which starts from `1` and gets
   * incremented with each change in the object.
   *
   * Note: When the object is changed by the client, the value of this
   * field must be incremented by the client. The server will use the
   * value of the field to detect conflicts which can occur when two
   * clients try to update the object simultaneously.
   */
  latestUpdateId: BigInt;

  /** The type of this object. */
  type?: string;

  /** The debtor's configuration data. Different implementations may
   * use different formats for this field. */
  configData: string;

  /** The URI of the corresponding `Debtor`. */
  debtor: ObjectReference;
};

export type Debtor = {
  /** The URI of this object. Can be a relative URI. */
  uri: string;

  /** The type of this object. */
  type: string;

  /** A URI to which the debtor can POST `TransferCreationRequest`s to
   * create new credit-issuing transfers. */
  createTransfer: ObjectReference;

  /** When this field is present, this means that for some reason, the
   * current `DebtorConfig` settings can not be applied, or are not
   * effectual anymore. Usually this means that there has been a
   * network communication problem, or a system configuration
   * problem. The value alludes to the cause of the problem. */
  configError?: string;

  /** The `AccountIdentity` of the debtor's account. It uniquely and
   * reliably identifies the debtor's account when it participates in
   * transfers as sender or recipient. When this field is not present,
   * this means that the debtor's account does not have an identity
   * yet, and can not participate in transfers. */
  account?: AccountIdentity;

  /** The URI of the debtor's list of pending credit-issuing transfers
   * (`TransfersList`). */
  transfersList: ObjectReference;

  /** The maximal number of bytes that transfer notes are allowed to
   * contain when UTF-8 encoded. This will be a non-negative
   * number. */
  noteMaxBytes: BigInt;

  /** The debtor's `DebtorIdentity`. */
  identity: DebtorIdentity;

  /** The total issued amount with a negative sign. Normally, it will
   * be a negative number or a zero. A positive value, although
   * theoretically possible, should be very rare. */
  balance: BigInt;

  /** The moment at which the debtor was created. */
  createdAt: string;

  /** Debtor's `DebtorConfig` settings. */
  config: DebtorConfig;
};

export type DebtorDeactivationRequest = {
  /** The type of this object. */
  type?: string;
};

export type TransfersList = {
  /** The URI of this object. Can be a relative URI. */
  uri: string;

  /** This will always be an empty string, representing the relative
   * URI of the first and only page in a paginated list. */
  first: string;

  /** The type of this object. */
  type: string;

  /** The URI of the corresponding `Debtor`. */
  debtor: ObjectReference;

  /** The type of the items in the list. */
  itemsType: string;

  /** Contains links to all `Transfers` in an array of
   * `ObjectReference`s. */
  items: ObjectReference[];
};

export type TransferCreationRequest = {
  /** The recipient's `AccountIdentity` information. */
  recipient: AccountIdentity;

  /** The amount that has to be transferred. Must be a non-negative
   * number. Setting this value to zero can be useful when the debtor
   * wants to verify whether the recipient's account exists and
   * accepts incoming transfers. */
  amount: BigInt;

  /** The type of this object. */
  type?: string;

  /** A client-generated UUID for the transfer. */
  transferUuid: string;

  /** A note from the debtor. Can be any string that the debtor wants
   * the recipient to see. */
  note?: string;

  /** The format used for the `note` field. An empty string signifies
   * unstructured text. */
  noteFormat?: string;
};

export type TransferError = {
  /**
   * The error code.
   *
   * `"CANCELED_BY_THE_SENDER"` signifies that the transfer has been
   * canceled the sender.  `"SENDER_DOES_NOT_EXIST"` signifies that
   * the sender's account does not exist.
   *
   * `"RECIPIENT_IS_UNREACHABLE"` signifies that the recipient's
   * account does not exist, or does not accept incoming transfers.
   *
   * `"NO_RECIPIENT_CONFIRMATION"` signifies that a confirmation from
   * the recipient is required, but has not been obtained.
   *
   * `"TRANSFER_NOTE_IS_TOO_LONG"` signifies that the transfer has
   * been rejected because the byte-length of the transfer note is too
   * big.
   *
   *  `"INSUFFICIENT_AVAILABLE_AMOUNT"` signifies that the transfer
   * has been rejected due to insufficient amount available on the
   * sender's account.
   *
   * `"TERMINATED"` signifies that the transfer has been terminated
   * due to expired deadline, unapproved interest rate change, or some
   * other *temporary or correctable condition*. If the client
   * verifies the transer options and retries the transfer, chances
   * are that it will be committed successfully.
   */
  errorCode: string;

  /** The type of this object. */
  type: string;

  /** This field will be present only when the transfer has been
   * rejected due to insufficient available amount. In this case, it
   * will contain the total sum secured (locked) for transfers on the
   * account, *after* this transfer has been finalized. */
  totalLockedAmount?: BigInt;
};

export type TransferResult = {
  /** An error that has occurred during the execution of the
   * transfer. This field will be present if, and only if, the
   * transfer has been unsuccessful. */
  error?: TransferError;

  /** The moment at which the transfer was finalized. */
  finalizedAt: string;

  /** The type of this object. */
  type: string;

  /** The transferred amount. If the transfer has been successful, the
   * value will be equal to the requested transfer amount (always a
   * positive number). If the transfer has been unsuccessful, the
   * value will be zero. */
  committedAmount: BigInt;
};

export type Transfer = {
  /** The recipient's `AccountIdentity` information. */
  recipient: AccountIdentity;

  /** The amount that has to be transferred. Must be a non-negative
   * number. Setting this value to zero can be useful when the debtor
   * wants to verify whether the recipient's account exists and
   * accepts incoming transfers. */
  amount: BigInt;

  /** The URI of this object. Can be a relative URI. */
  uri: string;

  /** The type of this object. */
  type: string;

  /** The moment at which the debtor is advised to look at the
   * transfer again, to see if it's status has changed. If this field
   * is not present, this means either that the status of the transfer
   * is not expected to change, or that the moment of the expected
   * change can not be predicted. */
  checkupAt?: string;

  /** A client-generated UUID for the transfer. */
  transferUuid: string;

  /** The URI of creditor's `TransfersList`. */
  transfersList: ObjectReference;

  /** Contains information about the outcome of the transfer. This
   * field will be preset if, and only if, the transfer has been
   * finalized. Note that a finalized transfer can be either
   * successful, or unsuccessful. */
  result?: TransferResult;

  /** A note from the debtor. Can be any string that the debtor wants
   * the recipient to see. */
  note: string;

  /** The format used for the `note` field. An empty string signifies
   * unstructured text. */
  noteFormat: string;

  /** The moment at which the transfer was initiated. */
  initiatedAt: string;
};

export type TransferCancelationRequest = {
  /** The type of this object. */
  type?: string;
};
