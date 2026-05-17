import { createContext, useContext, useState, useCallback } from 'react'

const TransactionStoreContext = createContext(null)

// Deep clone utility
const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime())
  if (obj instanceof Array) return obj.map(item => deepClone(item))
  if (obj instanceof Object) {
    const clonedObj = {}
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key])
      }
    }
    return clonedObj
  }
}

// Deep freeze utility
const deepFreeze = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj
  Object.freeze(obj)
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && typeof obj[key] === 'object' && !Object.isFrozen(obj[key])) {
      deepFreeze(obj[key])
    }
  }
  return obj
}

export const TransactionStoreProvider = ({ children }) => {
  const [activeTransaction, setActiveTransaction] = useState(false)
  const [committedTransaction, setCommittedTransaction] = useState(null)

  const startTransaction = useCallback(() => {
    // HARD INVALIDATION RULE: Clear committed transaction on new transaction
    setCommittedTransaction(null)
    setActiveTransaction(true)
  }, [])

  const commitTransaction = useCallback((result) => {
    
    // STRICT: Only accept COMPLETED transactions
    if (result.status !== 'COMPLETED') {
      return false
    }

    // STRICT: Only commit if transaction is active
    if (!activeTransaction) {
      return false
    }

    // Deep freeze entire transaction object
    const frozenResult = deepFreeze(deepClone(result))
    setCommittedTransaction(frozenResult)
    setActiveTransaction(false)
    return true
  }, [activeTransaction])

  const invalidateTransaction = useCallback(() => {
    setCommittedTransaction(null)
    setActiveTransaction(false)
  }, [])

  const value = {
    activeTransaction,
    committedTransaction,
    startTransaction,
    commitTransaction,
    invalidateTransaction
  }

  return (
    <TransactionStoreContext.Provider value={value}>
      {children}
    </TransactionStoreContext.Provider>
  )
}

export const useTransactionStore = () => {
  const context = useContext(TransactionStoreContext)
  if (!context) {
    throw new Error('useTransactionStore must be used within TransactionStoreProvider')
  }
  return context
}
