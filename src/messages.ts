// Messages for payment error codes:
export const CANCELED_BY_THE_SENDER = "The payment has been canceled by the sender."
export const SENDER_IS_UNREACHABLE = "The sender's account does not exist or can not make outgoing transfers."
export const RECIPIENT_IS_UNREACHABLE = "The recipient's account does not exist or does not accept incoming payments."
export const RECIPIENT_SAME_AS_SENDER = "The recipient's account is the same as the sender's account."
export const NO_RECIPIENT_CONFIRMATION = "A confirmation from the recipient is required, but has not been obtained."
export const TRANSFER_NOTE_IS_TOO_LONG = "The byte-length of the payment note is too big."
export const INSUFFICIENT_AVAILABLE_AMOUNT = "The requested amount is not available on the sender's account."
export const TIMEOUT = "The payment has been terminated due to expired deadline."
export const NEWER_INTEREST_RATE = (
  "The payment has been terminated because the current interest rate on the" +
  " account is more recent than the specified final interest rate timestamp."
)

// Operational alerts:
export const OPERATION_REQUIRES_AUTHENTICATION = "This operation requires authentication. You will be redirected to the login page."
export const PROBLEM_ON_THE_SERVER = "There seems to be a problem on the server. Please try again later."
export const NETWORK_PROBLEM = "A network problem has occured. Please check your Internet connection."
export const UNEXPECTED_ERROR = "Oops, something went wrong."
export const INVALID_PAYMENT_REQUEST = (
  "Invalid payment request. Make sure that you are scanning the correct" +
  " QR code, for the correct payment request."
)

// This message will be shown when the user wants to view the details of a
// payment (a transfer) that the user has made, but for some reason
// the payment do not exist.
export const PAYMENT_DOES_NOT_EXIST = "The requested payment record does not exist."

// Problems with handling "Actions":
export const CAN_NOT_PERFORM_ACTOIN = "The requested action can not be performed."
export const CAN_NOT_DISMISS_ACTION = "The action can not be dismissed."
export const ACTION_DOES_NOT_EXIST = "The requested action record does not exist."
