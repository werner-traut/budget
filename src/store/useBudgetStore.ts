import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { getLocalDateString } from "@/lib/utils/date";
import type { BudgetEntry } from '@/types/budget'
import type { PayPeriod } from '@/types/periods'
import type { RecurringItem } from '@/types/recurring'

const sortEntriesByDueDate = (entries: BudgetEntry[]) => {
  return [...entries].sort((a, b) => 
    new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  );
};

interface BudgetState {
  // Data
  entries: BudgetEntry[]
  recurringItems: RecurringItem[]
  payPeriods: PayPeriod[]
  dailyBalance: number | null
  adhocSettings: {
    daily_amount: number
  }
  isLoading: boolean
  isInitializing: boolean
  error: string | null
  initialized: boolean

  // Actions
  setEntries: (entries: BudgetEntry[]) => void
  addEntry: (entry: BudgetEntry) => void
  updateEntry: (id: string, entry: Partial<BudgetEntry>) => void
  deleteEntry: (id: string) => void
  setRecurringItems: (items: RecurringItem[]) => void
  addRecurringItem: (item: RecurringItem) => void
  updateRecurringItem: (id: string, item: Partial<RecurringItem>) => void
  deleteRecurringItem: (id: string) => void
  setPayPeriods: (periods: PayPeriod[]) => void
  setDailyBalance: (balance: number | null) => void
  setAdhocSettings: (settings: { daily_amount: number }) => void
  setError: (error: string | null) => void
  setLoading: (isLoading: boolean) => void
  setInitialized: (value: boolean) => void
  setInitializing: (value: boolean) => void
  // API Actions
  fetchEntries: () => Promise<void>
  fetchRecurringItems: () => Promise<void>
  fetchPayPeriods: () => Promise<void>
  fetchDailyBalance: () => Promise<void>
  fetchAdhocSettings: () => Promise<void>
}

export const useBudgetStore = create<BudgetState>()(
  immer<BudgetState>((set, get) => ({
    // Initial state
    entries: [],
    recurringItems: [],
    payPeriods: [],
    dailyBalance: null,
    adhocSettings: {
      daily_amount: 40,
    },
    isLoading: false,
    isInitializing: true,
    error: null,
    initialized: false,

    // Basic actions
    setEntries: (entries) => set((state) => { 
      state.entries = sortEntriesByDueDate(entries) 
    }),
    addEntry: (entry) => set((state) => { 
      state.entries = sortEntriesByDueDate([...state.entries, entry])
    }),
    updateEntry: (id, updatedEntry) => set((state) => {
      const index = state.entries.findIndex(entry => entry.id === id)
      if (index !== -1) {
        state.entries[index] = { ...state.entries[index], ...updatedEntry }
        state.entries = sortEntriesByDueDate(state.entries)
      }
    }),
    deleteEntry: (id) => set((state) => {
      state.entries = state.entries.filter(entry => entry.id !== id)
    }),
    setRecurringItems: (items) => set((state) => { state.recurringItems = items }),
    addRecurringItem: (item) => set((state) => {
      state.recurringItems = [...state.recurringItems, item]
    }),
    updateRecurringItem: (id, updatedItem) => set((state) => {
      const index = state.recurringItems.findIndex(item => item.id === id)
      if (index !== -1) {
        state.recurringItems[index] = { ...state.recurringItems[index], ...updatedItem }
      }
    }),
    deleteRecurringItem: (id) => set((state) => {
      state.recurringItems = state.recurringItems.filter(item => item.id !== id)
    }),
    setPayPeriods: (periods) => set((state) => { state.payPeriods = periods }),
    setDailyBalance: (balance) => set((state) => { state.dailyBalance = balance }),
    setAdhocSettings: (settings) => set((state) => { state.adhocSettings = settings }),
    setError: (error) => set((state) => { state.error = error }),
    setLoading: (isLoading) => {
      set((state) => { state.isLoading = isLoading })
    },
    setInitialized: (value) => set({ initialized: value }),
    setInitializing: (value) => set((state) => { 
      state.isInitializing = value 
    }),
    // API actions
    fetchEntries: async () => {
      const { setEntries, setError } = get()
      try {
        const response = await fetch('/api/budget-entries')
        if (!response.ok) throw new Error('Failed to fetch entries')
        const data = await response.json()
        const processedData = data.map((item: BudgetEntry) => ({
          ...item,
          amount: Number(item.amount),
          actual_amount: item.actual_amount === null ? null : Number(item.actual_amount),
        }))
        setEntries(processedData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch entries')
        console.error('Error fetching entries:', err)
      }
    },

    fetchRecurringItems: async () => {
      const { setRecurringItems, setError } = get()
      try {
        const response = await fetch('/api/recurring-items')
        if (!response.ok) throw new Error('Failed to fetch recurring items')
        const data = await response.json()
        const processedData = data.map((item: RecurringItem) => ({
          ...item,
          amount: Number(item.amount),
        }))
        setRecurringItems(processedData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch recurring items')
        console.error('Error fetching recurring items:', err)
      }
    },

    fetchPayPeriods: async () => {
      const { setPayPeriods, setError } = get()
      try {
        const response = await fetch('/api/pay-periods')
        if (!response.ok) throw new Error('Failed to fetch pay periods')
        const data = await response.json()
        const processedData = data.map((item: PayPeriod) => ({
          ...item,
          salary_amount: Number(item.salary_amount),
        }))
        const sortedPeriods = processedData.sort(
            (a: PayPeriod, b: PayPeriod) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
          );
        setPayPeriods(sortedPeriods)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch pay periods')
        console.error('Error fetching pay periods:', err)
      }
    },

    fetchDailyBalance: async () => {
      const { setDailyBalance, setError } = get()
      try {
        const today = getLocalDateString();
        const response = await fetch(`/api/daily-balance?date=${today}`)
        if (!response.ok) throw new Error('Failed to fetch daily balance')
        const data = await response.json()
        setDailyBalance(data.balance === null ? null : Number(data.balance))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch daily balance')
        console.error('Error fetching daily balance:', err)
      }
    },

    fetchAdhocSettings: async () => {
      const { setAdhocSettings, setError } = get()
      try {
        const response = await fetch('/api/adhoc-settings')
        if (!response.ok) throw new Error('Failed to fetch adhoc settings')
        const data = await response.json()
        setAdhocSettings(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch adhoc settings')
        console.error('Error fetching adhoc settings:', err)
      }
    },
  }))
) 