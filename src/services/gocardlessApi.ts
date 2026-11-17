import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { Link, Tx, Balance, Institution } from '../types'

const BASE_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`

export const gocardlessApi = createApi({
  reducerPath: 'gocardlessApi',
  baseQuery: fetchBaseQuery({ baseUrl: BASE_URL }),
  tagTypes: ['Link', 'Account', 'Institution'],
  endpoints: (build) => ({
    getLinks: build.query<Link[], void>({
      query: () => '/gocardless-links',
      providesTags: ['Link'],
    }),
    getInstitutions: build.query<Institution[], string>({
      query: (country) => `/gocardless-institutions?country=${country}`,
      providesTags: ['Institution'],
    }),
    createRequisition: build.mutation<{ link: string }, { institutionId: string; institutionName: string; country: string }>({
      query: (body) => ({
        url: '/gocardless-requisitions',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Link'],
    }),
    getAccountBalances: build.query<{ balances?: Balance[] }, string>({
      query: (accountId) => `/gocardless-accounts-balances?account_id=${accountId}`,
      providesTags: (_, __, id) => [{ type: 'Account', id }],
    }),
    getAccountTransactions: build.query<{ transactions?: { booked?: Tx[]; pending?: Tx[] } }, string>({
      query: (accountId) => `/gocardless-accounts-transactions?account_id=${accountId}`,
      providesTags: (_, __, id) => [{ type: 'Account', id }],
    }),
  }),
})

export const {
  useGetLinksQuery,
  useGetInstitutionsQuery,
  useCreateRequisitionMutation,
  useGetAccountBalancesQuery,
  useGetAccountTransactionsQuery,
} = gocardlessApi
