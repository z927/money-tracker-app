export type Link = {
  requisitionId: string
  institutionId: string
  institutionName: string
  status?: string
  accounts?: string[]
  error?: string
}

export type Tx = {
  transactionId?: string
  internalTransactionId?: string
  bookingDate?: string
  valueDate?: string
  remittanceInformationUnstructured?: string
  creditorName?: string
  debtorName?: string
  transactionAmount?: { amount?: string; currency?: string }
}

export type Balance = {
  balanceAmount?: { amount?: string; currency?: string }
  balanceType?: string
  referenceDate?: string
}

export type Institution = {
  id: string
  name: string
  bic?: string
  countries?: string[]
  logo?: string
}
