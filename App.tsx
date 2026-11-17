import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import React from 'react'
import {
  View, Text, StatusBar, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Linking,
} from 'react-native'
import fmtAmount from './src/lib/format'
import type { Link, Tx, Balance } from './src/types'

const Stack = createStackNavigator()
const Tab = createBottomTabNavigator()

function labelFor(s: string) {
  const m: Record<string, string> = {
    LN: 'Collegato', CR: 'Creato', GC: 'Consenso', UA: 'Autenticazione', SA: 'Selezione', GA: 'Accesso', EX: 'Scaduto', RJ: 'Rifiutato', SU: 'Sospeso',
  }
  return m[s]
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  )
}

function Pill({ status }: { status?: string }) {
  const s = (status || '').toUpperCase()
  let color = '#94a3b8'; let border = 'rgba(255,255,255,0.2)'
  if (s === 'LN') { color = '#4ade80'; border = 'rgba(34,211,238,0.35)' }
  else if (['CR', 'GC', 'UA', 'SA', 'GA'].includes(s)) { color = '#fcd34d'; border = 'rgba(251,191,36,0.35)' }
  else if (s === 'EX' || s === 'RJ' || s === 'SU') { color = '#fb7185'; border = 'rgba(244,114,182,0.35)' }
  return <Text style={[styles.pill, { color, borderColor: border }]}>{labelFor(s) || status || '?'}</Text>
}

function HomeScreen() {
  const [links, setLinks] = React.useState<Link[]>([])
  const [selectedAccount, setSelectedAccount] = React.useState<string | null>(null)
  const [balances, setBalances] = React.useState<{ balances?: Balance[] } | null>(null)
  const [txs, setTxs] = React.useState<{ transactions?: { booked?: Tx[]; pending?: Tx[] } } | null>(null)
  const [accountBalances, setAccountBalances] = React.useState<Record<string, { amount?: string; currency?: string } | null>>({})
  const [balancesBusy, setBalancesBusy] = React.useState<boolean>(false)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  async function loadAllBalances(links: Link[]) {
    const accounts = links.flatMap((l) => (l.accounts || []).map((a: string) => ({ accountId: a })))
    if (!accounts.length) { setAccountBalances({}); return }
    setBalancesBusy(true)
    try {
      const results = await Promise.allSettled(accounts.map(({ accountId }) => fetchWithJson<{ balances?: Balance[] }>(`/gocardless-accounts-balances?account_id=${accountId}`)))
      const next: Record<string, { amount?: string; currency?: string } | null> = {}
      results.forEach((r, i) => {
        let b: { amount?: string; currency?: string } | null = null
        if (r.status === 'fulfilled') {
          const list = r.value.balances || []
          const picked = list.find((x) => x.balanceType === 'interimBooked') || list[0]
          if (picked?.balanceAmount) b = { amount: picked.balanceAmount.amount, currency: picked.balanceAmount.currency }
        }
        next[accounts[i].accountId] = b
      })
      setAccountBalances(next)
    } finally { setBalancesBusy(false) }
  }

  async function fetchWithJson<T>(path: string): Promise<T> {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1${path}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`)
    return data as T
  }

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchWithJson<Link[]>('/gocardless-links')
        if (!cancelled) setLinks(data)
        if (!cancelled) await loadAllBalances(data)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function loadLinks() {
    setBusy('links'); setErr(null)
    try {
      const data = await fetchWithJson<Link[]>('/gocardless-links')
      setLinks(data)
      await loadAllBalances(data)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(null) }
  }

  async function loadAccount(accountId: string) {
    setSelectedAccount(accountId); setBusy(accountId); setErr(null); setBalances(null); setTxs(null)
    try {
      const [b, t] = await Promise.all([
        fetchWithJson<{ balances?: Balance[] }>(`/gocardless-accounts-balances?account_id=${accountId}`),
        fetchWithJson<{ transactions?: { booked?: Tx[]; pending?: Tx[] } }>(`/gocardless-accounts-transactions?account_id=${accountId}`),
      ])
      setBalances(b); setTxs(t)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(null) }
  }

  const totalAccounts = links.reduce((n, l) => n + (l.accounts?.length || 0), 0)
  const booked = txs?.transactions?.booked || []
  const entries = Object.entries(accountBalances)
  const totalAmount = entries.reduce((sum, [, b]) => sum + (Number(b?.amount || 0) || 0), 0)
  const totalCurrency = entries.find(([, b]) => b?.currency)?.[1]?.currency || 'EUR'

  const byInstitution = entries.reduce<any[]>((acc, [accountId, b]) => {
    const link = links.find((l) => (l.accounts || []).includes(accountId))
    if (!link || !b) return acc
    const n = Number(b.amount || 0) || 0
    const cur = b.currency || totalCurrency
    const existing = acc.find((x) => x.institutionId === link.institutionId)
    if (existing) existing.total += n
    else acc.push({ institutionId: link.institutionId, institutionName: link.institutionName, total: n, currency: cur })
    return acc
  }, [])

  return (
    <View style={[styles.container, { paddingTop: 54 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Money Tracker</Text>
        <Text style={styles.subtitle}>Saldo complessivo e spaccato per istituto.</Text>
      </View>

      {err && <Text style={styles.error}>{err}</Text>}

      <View style={styles.statsRow}>
        <Stat label="Collegamenti" value={String(links.length)} />
        <Stat label="Account" value={String(totalAccounts)} />
        <Stat label="Paese" value="IT" />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Saldo complessivo</Text>
          <View style={styles.totalWrapper}>
            <Text style={styles.totalAmount}>{fmtAmount(totalAmount.toFixed(2), totalCurrency)}</Text>
            {balancesBusy && <Text style={styles.busy}>Aggiornamento saldi…</Text>}
          </View>
        </View>
        <FlatList
          data={byInstitution}
          keyExtractor={(item) => item.institutionId}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.instList}
          renderItem={({ item }) => (
            <View style={styles.instCard}>
              <Text style={styles.instName}>{item.institutionName}</Text>
              <Text style={styles.instAmount}>{fmtAmount(item.total.toFixed(2), item.currency)}</Text>
            </View>
          )}
        />
        {!byInstitution.length && (
          <View style={styles.empty}>
            <Text>Nessun saldo disponibile. Collega un conto da Connetti banca e aggiorna.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Conti collegati</Text>
          <TouchableOpacity style={[styles.refreshBtn, busy === 'links' && styles.refreshBtnBusy]} onPress={loadLinks} disabled={busy === 'links'}>
            <Text style={[styles.refreshText, busy === 'links' && styles.refreshTextBusy]}>{busy === 'links' ? 'Aggiorno…' : 'Aggiorna'}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={links}
          keyExtractor={(item) => item.requisitionId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.linkList}
          renderItem={({ item }) => (
            <View style={styles.linkCard}>
              <View style={styles.linkHead}>
                <View>
                  <Text style={styles.linkInst}>{item.institutionName}</Text>
                  <Text style={styles.linkId}>{item.requisitionId}</Text>
                </View>
                <Pill status={item.status} />
              </View>
              <View style={styles.accountsRow}>
                {(item.accounts || []).map((a: string) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.accountBtn, selectedAccount === a && styles.accountBtnActive]}
                    onPress={() => loadAccount(a)}
                  >
                    <Text style={[styles.accountText, selectedAccount === a && styles.accountTextActive]}>{busy === a ? '…' : `Account ${a.slice(0, 8)}`}</Text>
                  </TouchableOpacity>
                ))}
                {!item.accounts?.length && <Text style={styles.noAccounts}>Nessun account disponibile.</Text>}
              </View>
              {item.error && <Text style={styles.linkError}>{item.error}</Text>}
            </View>
          )}
        />
        {!links.length && (
          <View style={styles.empty}>
            <Text>Nessun collegamento salvato. Vai su Connetti per iniziare.</Text>
          </View>
        )}
      </View>

      {selectedAccount && (
        <View style={styles.detailSection}>
          <View style={styles.detailHeader}>
            <View>
              <Text style={styles.detailTitle}>Dettaglio account</Text>
              <Text style={styles.detailId}>{selectedAccount}</Text>
            </View>
            <TouchableOpacity style={styles.detailBtn} onPress={() => loadAccount(selectedAccount)}>
              <Text style={styles.detailBtnText}>Ricarica</Text>
            </TouchableOpacity>
          </View>
          {busy === selectedAccount && <View style={styles.loader}><ActivityIndicator size="small" color="#22d3ee" /></View>}
          <View style={styles.detailGrid}>
            <View style={styles.detailCard}>
              <Text style={styles.detailSubtitle}>Saldi</Text>
              <View style={styles.balanceList}>
                {(balances?.balances || []).map((b, i) => (
                  <View key={i} style={styles.balanceItem}>
                    <Text style={styles.balanceType}>{b.balanceType || 'Balance'}</Text>
                    <Text style={styles.balanceAmount}>{fmtAmount(b.balanceAmount?.amount, b.balanceAmount?.currency)}</Text>
                  </View>
                ))}
                {!balances?.balances?.length && <Text style={styles.noData}>Nessun saldo disponibile.</Text>}
              </View>
            </View>
            <View style={styles.detailCard}>
              <View style={styles.detailSubtitleRow}>
                <Text style={styles.detailSubtitle}>Transazioni contabilizzate</Text>
                <Text style={styles.detailCount}>{booked.length} voci</Text>
              </View>
              <View style={styles.txList}>
                {booked.slice(0, 80).map((t, i) => {
                  const amt = Number(t.transactionAmount?.amount || 0)
                  const negative = !Number.isNaN(amt) && amt < 0
                  return (
                    <View key={t.transactionId || t.internalTransactionId || i} style={styles.txItem}>
                      <View style={styles.txBody}>
                        <Text style={styles.txTitle}>{t.remittanceInformationUnstructured || t.creditorName || t.debtorName || 'Transazione'}</Text>
                        <Text style={styles.txDate}>{t.bookingDate || t.valueDate || '—'}</Text>
                      </View>
                      <Text style={[styles.txAmount, negative ? styles.txNegative : styles.txPositive]}>{fmtAmount(t.transactionAmount?.amount, t.transactionAmount?.currency)}</Text>
                    </View>
                  )
                })}
                {!booked.length && <Text style={styles.noData}>Nessuna transazione contabilizzata disponibile.</Text>}
              </View>
            </View>
          </View>
        </View>
      )}

      <StatusBar barStyle="light-content" />
    </View>
  )
}

function ConnectScreen() {
  const [country] = React.useState('it')
  const [q, setQ] = React.useState('')
  const [institutions, setInstitutions] = React.useState<any[]>([])
  const [links, setLinks] = React.useState<Link[]>([])
  const [busy, setBusy] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  async function fetchWithJson<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1${path}`, { ...init, cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`)
    return data as T
  }

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchWithJson<Link[]>('/gocardless-links')
        if (!cancelled) setLinks(data)
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function loadLinks() {
    setBusy('links'); setErr(null)
    try { setLinks(await fetchWithJson<Link[]>('/gocardless-links')) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(null) }
  }

  async function search() {
    setBusy('search'); setErr(null)
    try { setInstitutions(await fetchWithJson<any[]>(`/gocardless-institutions?country=${encodeURIComponent(country)}`)) }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)) }
    finally { setBusy(null) }
  }

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = s ? institutions.filter((i) => i.name.toLowerCase().includes(s) || (i.bic || '').toLowerCase().includes(s)) : institutions
    return base.slice(0, 50)
  }, [institutions, q])

  async function connect(inst: any) {
    setBusy(inst.id); setErr(null)
    try {
      const data = await fetchWithJson<{ link: string }>('/gocardless-requisitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ institutionId: inst.id, institutionName: inst.name, country }),
      })
      await Linking.openURL(data.link)
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(null) }
  }

  return (
    <View style={[styles.container, { paddingTop: 54 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Connetti una banca</Text>
        <Text style={styles.subtitle}>Cerca BPER, BBVA, Revolut e avvia il consenso PSD2.</Text>
      </View>

      {err && <Text style={styles.error}>{err}</Text>}

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Scegli un istituto</Text>
            <Text style={styles.sectionSubtitle}>{filtered.length} risultati</Text>
          </View>
        </View>
        <View style={styles.controls}>
          <View style={styles.countrySelect}>
            <Text style={styles.countryLabel}>{country === 'it' ? 'Italia' : country === 'es' ? 'Spagna' : country === 'gb' ? 'Regno Unito' : country === 'de' ? 'Germania' : 'Francia'}</Text>
          </View>
          <TouchableOpacity style={[styles.searchBtn, busy === 'search' && styles.searchBtnBusy]} onPress={search} disabled={busy === 'search'}>
            <Text style={[styles.searchBtnText, busy === 'search' && styles.searchBtnTextBusy]}>{busy === 'search' ? 'Caricamento…' : 'Carica istituti'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchInputWrap}>
          <TextInput style={[styles.searchInput, { color: '#ffffff' }]}
            placeholder="Filtra per nome o BIC…"
            placeholderTextColor="#94a3b8"
            value={q}
            onChangeText={setQ}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.instListTab}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.instCardTab} onPress={() => connect(item)} disabled={!!busy}>
              <View style={styles.instBody}>
                <View style={styles.instAvatar}>
                  <Text style={styles.instAvatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.instInfo}>
                  <Text style={styles.instName}>{item.name}</Text>
                  <Text style={styles.instBic}>{item.bic || item.id.slice(0, 18)}</Text>
                </View>
              </View>
              <Text style={[styles.connectBtnText, busy && styles.connectBtnDisabled]}>{busy === item.id ? 'Redirect…' : 'Connetti'}</Text>
            </TouchableOpacity>
          )}
        />
        {!filtered.length && (
          <View style={styles.empty}>
            <Text>Carica gli istituti per il paese selezionato, poi filtra per banca.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Collegamenti esistenti</Text>
            <Text style={styles.sectionSubtitle}>Stato consenso e account disponibili.</Text>
          </View>
          <TouchableOpacity style={[styles.refreshBtn, busy === 'links' && styles.refreshBtnBusy]} onPress={loadLinks} disabled={busy === 'links'}>
            <Text style={[styles.refreshText, busy === 'links' && styles.refreshTextBusy]}>{busy === 'links' ? 'Aggiorno…' : 'Aggiorna'}</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={links}
          keyExtractor={(item) => item.requisitionId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.linkList}
          renderItem={({ item }) => (
            <View style={styles.linkCard}>
              <View style={styles.linkHead}>
                <View>
                  <Text style={styles.linkInst}>{item.institutionName}</Text>
                  <Text style={styles.linkId}>{item.requisitionId}</Text>
                </View>
                <Pill status={item.status} />
              </View>
              <View style={styles.accountsRow}>
                {(item.accounts || []).map((a: string) => (
                  <TouchableOpacity key={a} style={styles.accountBtn} disabled>
                    <Text style={styles.accountText}>Account {a.slice(0, 8)}</Text>
                  </TouchableOpacity>
                ))}
                {!item.accounts?.length && <Text style={styles.noAccounts}>Nessun account disponibile.</Text>}
              </View>
              {item.error && <Text style={styles.linkError}>{item.error}</Text>}
            </View>
          )}
        />
        {!links.length && (
          <View style={styles.empty}>
            <Text>Nessun collegamento salvato. Connetti una banca per iniziare.</Text>
          </View>
        )}
      </View>

      <StatusBar barStyle="light-content" />
    </View>
  )
}

function AccountDetailScreen({ route }: { route: any }) {
  const { accountId } = route.params
  const [balances, setBalances] = React.useState<{ balances?: Balance[] } | null>(null)
  const [txs, setTxs] = React.useState<{ transactions?: { booked?: Tx[]; pending?: Tx[] } } | null>(null)
  const [busy, setBusy] = React.useState<boolean>(false)

  async function fetchWithJson<T>(path: string): Promise<T> {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1${path}`, { cache: 'no-store' })
    const data = await res.json()
    if (!res.ok) throw new Error((data as { error?: string })?.error || `HTTP ${res.status}`)
    return data as T
  }

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      setBusy(true)
      try {
        const [b, t] = await Promise.all([
          fetchWithJson<{ balances?: Balance[] }>(`/gocardless-accounts-balances?account_id=${accountId}`),
          fetchWithJson<{ transactions?: { booked?: Tx[]; pending?: Tx[] } }>(`/gocardless-accounts-transactions?account_id=${accountId}`),
        ])
        if (!cancelled) { setBalances(b); setTxs(t) }
      } catch (e) { console.error(e) }
      finally { if (!cancelled) setBusy(false) }
    })()
    return () => { cancelled = true }
  }, [accountId])

  const booked = txs?.transactions?.booked || []

  return (
    <View style={[styles.container, { paddingTop: 54 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Dettaglio account</Text>
        <Text style={styles.subtitle}>{accountId}</Text>
      </View>

      {busy && <View style={styles.loader}><ActivityIndicator size="small" color="#22d3ee" /></View>}

      <View style={styles.detailGrid}>
        <View style={styles.detailCard}>
          <Text style={styles.detailSubtitle}>Saldi</Text>
          <View style={styles.balanceList}>
            {(balances?.balances || []).map((b, i) => (
              <View key={i} style={styles.balanceItem}>
                <Text style={styles.balanceType}>{b.balanceType || 'Balance'}</Text>
                <Text style={styles.balanceAmount}>{fmtAmount(b.balanceAmount?.amount, b.balanceAmount?.currency)}</Text>
              </View>
            ))}
            {!balances?.balances?.length && <Text style={styles.noData}>Nessun saldo disponibile.</Text>}
          </View>
        </View>
        <View style={styles.detailCard}>
          <View style={styles.detailSubtitleRow}>
            <Text style={styles.detailSubtitle}>Transazioni contabilizzate</Text>
            <Text style={styles.detailCount}>{booked.length} voci</Text>
          </View>
          <View style={styles.txList}>
            {booked.slice(0, 80).map((t, i) => {
              const amt = Number(t.transactionAmount?.amount || 0)
              const negative = !Number.isNaN(amt) && amt < 0
              return (
                <View key={t.transactionId || t.internalTransactionId || i} style={styles.txItem}>
                  <View style={styles.txBody}>
                    <Text style={styles.txTitle}>{t.remittanceInformationUnstructured || t.creditorName || t.debtorName || 'Transazione'}</Text>
                    <Text style={styles.txDate}>{t.bookingDate || t.valueDate || '—'}</Text>
                  </View>
                  <Text style={[styles.txAmount, negative ? styles.txNegative : styles.txPositive]}>{fmtAmount(t.transactionAmount?.amount, t.transactionAmount?.currency)}</Text>
                </View>
              )
            })}
            {!booked.length && <Text style={styles.noData}>Nessuna transazione contabilizzata disponibile.</Text>}
          </View>
        </View>
      </View>

      <StatusBar barStyle="light-content" />
    </View>
  )
}

function HomeTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="AccountDetail" component={AccountDetailScreen} />
    </Stack.Navigator>
  )
}

function ConnectTab() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Connect" component={ConnectScreen} />
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#22d3ee',
          tabBarInactiveTintColor: '#94a3b8',
          tabBarStyle: { backgroundColor: 'rgba(15,23,42,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: 6 },
        }}
      >
        <Tab.Screen name="Home" component={HomeTab} options={{ title: 'Home' }} />
        <Tab.Screen name="Connect" component={ConnectTab} options={{ title: 'Connetti' }} />
      </Tab.Navigator>
    </NavigationContainer>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '700', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4, lineHeight: 20 },
  error: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12, padding: 12, color: '#fca5a5', fontSize: 13, marginHorizontal: 20, marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 20 },
  statCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12, flex: 1 },
  statLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 6 },
  statValue: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  sectionSubtitle: { fontSize: 13, color: '#94a3b8' },
  totalWrapper: { alignItems: 'flex-end' },
  totalAmount: { fontSize: 30, fontWeight: '700', color: '#ffffff' },
  busy: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  instList: { paddingRight: 16 },
  instCard: { width: 140, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12, marginRight: 10 },
  instName: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 6 },
  instAmount: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  empty: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderStyle: 'dashed', borderRadius: 12, padding: 24, alignItems: 'center', color: '#94a3b8' },
  linkList: { paddingBottom: 16 },
  linkCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12, marginBottom: 10 },
  linkHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  linkInst: { fontSize: 14, fontWeight: '600', color: '#f8fafc' },
  linkId: { fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', marginTop: 2 },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1, fontSize: 11, fontWeight: '600' },
  accountsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  accountBtn: { backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  accountBtnActive: { backgroundColor: '#22d3ee', borderColor: 'rgba(34,211,238,0.35)' },
  accountText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  accountTextActive: { color: '#0f172a' },
  noAccounts: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  linkError: { fontSize: 12, color: '#fca5a5', marginTop: 6 },
  refreshBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  refreshBtnBusy: { opacity: 0.5 },
  refreshText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  refreshTextBusy: { opacity: 0.5 },
  detailSection: { marginHorizontal: 20, marginBottom: 20 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  detailId: { fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', marginTop: 2 },
  detailBtn: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  detailBtnText: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  detailGrid: { gap: 12 },
  detailCard: { backgroundColor: 'rgba(15,23,42,0.4)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 12 },
  detailSubtitle: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  detailSubtitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailCount: { fontSize: 12, color: '#94a3b8' },
  balanceList: { gap: 8 },
  balanceItem: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 },
  balanceType: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: '#94a3b8', marginBottom: 4 },
  balanceAmount: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  noData: { fontSize: 13, color: '#94a3b8' },
  txList: { gap: 8, maxHeight: 360 },
  txItem: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 10 },
  txBody: { flexDirection: 'column', gap: 2 },
  txTitle: { fontSize: 13, color: '#f8fafc' },
  txDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txAmount: { fontSize: 13, fontWeight: '600' },
  txPositive: { color: '#4ade80' },
  txNegative: { color: '#fb7185' },
  loader: { marginVertical: 16 },
  controls: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 12 },
  countrySelect: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10 },
  countryLabel: { fontSize: 13, color: '#f8fafc', fontWeight: '600' },
  searchBtn: { backgroundColor: '#22d3ee', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  searchBtnBusy: { opacity: 0.6 },
  searchBtnText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  searchBtnTextBusy: { opacity: 0.8 },
  searchInputWrap: { marginTop: 8 },
  searchInput: { backgroundColor: 'rgba(15,23,42,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#ffffff' },
  instListTab: { gap: 8 },
  instCardTab: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 10, marginBottom: 8 },
  instBody: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  instAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  instAvatarText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  instInfo: { flex: 1 },
  instName2: { fontSize: 13, fontWeight: '600', color: '#f8fafc' },
  instBic: { fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' },
  connectBtnText: { fontSize: 12, fontWeight: '600', color: '#f8fafc' },
  connectBtnDisabled: { opacity: 0.5 },
})
