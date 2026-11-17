import { configureStore } from '@reduxjs/toolkit'
import { gocardlessApi } from './services/gocardlessApi'

export const store = configureStore({
  reducer: {
    [gocardlessApi.reducerPath]: gocardlessApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(gocardlessApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
