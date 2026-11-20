import { useCallback, useEffect, useState } from 'react'
import { Button, Card, EmptyState, LoadingState, StatusPill } from '../../components/ui'
import PageHeader from '../../components/PageHeader'
import { useAuth } from '../../context/AuthContext'
import { createListing, fetchAvailableListings, fetchMyListings } from './api'

// Only approved donors reach this page: the route is wrapped in <VerificationGate role="provider"> (and the API refuses
// everyone else). Every donor, whatever the category, needs approval.
const SUBTITLE = 'List surplus food with a quantity and a collection window. Meal figures are estimates.'

const inputCls = 'mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3 text-sm font-normal focus:bg-panel'
const labelCls = 'block text-xs font-semibold uppercase tracking-[1px]'

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm".
const toLocalInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const inMinutes = (m) => toLocalInput(new Date(Date.now() + m * 60000))

const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

function validate(f) {
  const errs = {}
  if (!f.title.trim()) errs.title = 'Say what the food is'
  if (!f.food_type.trim()) errs.food_type = 'Add a food type, for example cooked meal'
  const qty = Number(f.quantity)
  if (!f.quantity || !(qty > 0) || qty > 100000) errs.quantity = 'Enter a quantity greater than 0'
  const start = new Date(f.window_start)
  const end = new Date(f.window_end)
  if (!f.window_start || Number.isNaN(start.getTime()) || start <= new Date()) errs.window_start = 'Collection must start in the future'
  if (!f.window_end || Number.isNaN(end.getTime()) || end <= start) errs.window_end = 'Collection must end after it starts'
  if (!f.address.trim()) errs.address = 'Add the pickup address'
  const lat = Number(f.lat)
  const lng = Number(f.lng)
  if (f.lat === '' || Number.isNaN(lat) || lat < -90 || lat > 90) errs.lat = 'Latitude must be between -90 and 90'
  if (f.lng === '' || Number.isNaN(lng) || lng < -180 || lng > 180) errs.lng = 'Longitude must be between -180 and 180'
  return errs
}

function FieldError({ msg }) {
  return msg ? <p className="mt-1.5 text-xs text-bad-ink">{msg}</p> : null
}

function Row({ label, children }) {
  return (
    <div className="rounded-[6px] bg-canvas px-4 py-3">
      <dt className="text-xs uppercase tracking-[1px] text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{children}</dd>
    </div>
  )
}

function ListingRow({ listing }) {
  return (
    <Card as="article" className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-2xl md:text-3xl">{listing.title}</h3>
          {listing.org_name && <p className="mt-1 text-xs text-muted">{listing.org_name}</p>}
        </div>
        <StatusPill status={listing.status} />
      </div>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        <Row label="Quantity">{listing.quantity} {listing.unit} <span className="font-normal text-muted">({listing.food_type})</span></Row>
        <Row label="Estimated meals">about {listing.est_meals} (estimate)</Row>
        <Row label="Collect between">{fmt(listing.window_start)} to {fmt(listing.window_end)}</Row>
        <Row label="Pickup address">{listing.address}</Row>
      </dl>
    </Card>
  )
}

const emptyForm = () => ({
  title: '', food_type: '', quantity: '', unit: 'portions',
  window_start: inMinutes(15), window_end: inMinutes(195),
  address: '', lat: '', lng: '', notes: '',
})

function ListingForm({ profile, onCreated }) {
  const [form, setForm] = useState(() => {
    const f = emptyForm()
    if (profile?.address) f.address = profile.address
    if (profile?.lat != null) f.lat = String(profile.lat)
    if (profile?.lng != null) f.lng = String(profile.lng)
    return f
  })
  const [errors, setErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [geoMsg, setGeoMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function useMyLocation() {
    setGeoMsg('')
    if (!navigator.geolocation) {
      setGeoMsg('This browser cannot share a location. Enter the coordinates by hand.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) })),
      () => setGeoMsg('Location was not shared. Enter the coordinates by hand.'),
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      const created = await createListing({
        title: form.title.trim(),
        food_type: form.food_type.trim(),
        quantity: Number(form.quantity),
        unit: form.unit,
        window_start: new Date(form.window_start).toISOString(),
        window_end: new Date(form.window_end).toISOString(),
        address: form.address.trim(),
        lat: Number(form.lat),
        lng: Number(form.lng),
        notes: form.notes.trim() || null,
      })
      onCreated(created)
      setForm((f) => ({ ...emptyForm(), address: f.address, lat: f.lat, lng: f.lng }))
    } catch (err) {
      setServerMsg(err.detail ?? err.message ?? 'Could not create the listing')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverMsg && <p role="alert" className="rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{serverMsg}</p>}

      <div>
        <label htmlFor="title" className={labelCls}>What is it *</label>
        <input id="title" className={inputCls} value={form.title} onChange={set('title')} placeholder="Dal and rice, 40 portions" maxLength={200} />
        <FieldError msg={errors.title} />
      </div>

      <div>
        <label htmlFor="food_type" className={labelCls}>Food type *</label>
        <input id="food_type" className={inputCls} value={form.food_type} onChange={set('food_type')} placeholder="cooked meal, bakery, produce" maxLength={100} />
        <FieldError msg={errors.food_type} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="quantity" className={labelCls}>Quantity *</label>
          <input id="quantity" type="number" inputMode="decimal" min="0" step="any" className={inputCls} value={form.quantity} onChange={set('quantity')} />
          <FieldError msg={errors.quantity} />
        </div>
        <div>
          <label htmlFor="unit" className={labelCls}>Unit *</label>
          <select id="unit" className={inputCls} value={form.unit} onChange={set('unit')}>
            <option value="portions">portions</option>
            <option value="kg">kg</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="window_start" className={labelCls}>Collection opens *</label>
          <input id="window_start" type="datetime-local" className={inputCls} value={form.window_start} onChange={set('window_start')} />
          <FieldError msg={errors.window_start} />
        </div>
        <div>
          <label htmlFor="window_end" className={labelCls}>Collection closes *</label>
          <input id="window_end" type="datetime-local" className={inputCls} value={form.window_end} onChange={set('window_end')} />
          <FieldError msg={errors.window_end} />
        </div>
      </div>

      <div>
        <label htmlFor="address" className={labelCls}>Pickup address *</label>
        <input id="address" className={inputCls} value={form.address} onChange={set('address')} placeholder="Street, area, city" maxLength={500} autoComplete="street-address" />
        <FieldError msg={errors.address} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lat" className={labelCls}>Latitude *</label>
          <input id="lat" inputMode="decimal" className={inputCls} value={form.lat} onChange={set('lat')} placeholder="28.6139" />
          <FieldError msg={errors.lat} />
        </div>
        <div>
          <label htmlFor="lng" className={labelCls}>Longitude *</label>
          <input id="lng" inputMode="decimal" className={inputCls} value={form.lng} onChange={set('lng')} placeholder="77.2090" />
          <FieldError msg={errors.lng} />
        </div>
      </div>
      <div>
        <Button variant="ghost" onClick={useMyLocation} className="!px-0 !py-1 underline underline-offset-4">Use my current location</Button>
        {geoMsg && <p className="mt-1.5 text-xs text-muted">{geoMsg}</p>}
      </div>

      <div>
        <label htmlFor="notes" className={labelCls}>Notes <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></label>
        <textarea id="notes" rows={3} className={inputCls} value={form.notes} onChange={set('notes')} placeholder="Packaging, allergens, who to ask for" maxLength={1000} />
      </div>

      <Button type="submit" variant="brand" disabled={busy}>{busy ? 'Listing…' : 'List this food'}</Button>
    </form>
  )
}

export default function ProviderListingsPage() {
  const { profile } = useAuth()

  const [listings, setListings] = useState([])
  const [others, setOthers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [mine, available] = await Promise.all([fetchMyListings(), fetchAvailableListings()])
      setListings(mine)
      setOthers(available)
    } catch (err) {
      setError(err.detail ?? err.message ?? 'Could not load your listings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleCreated(created) {
    setListings((rows) => [created, ...rows])
    setNotice(`Listed. This is about ${created.est_meals} meals (an estimate). Verified NGOs can now reserve it.`)
  }

  return (
    <main>
      <PageHeader title="Surplus listings">{SUBTITLE}</PageHeader>
      <div className="mx-auto max-w-6xl px-5 py-12 md:px-10 md:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section aria-label="New listing">
            <Card className="p-7 md:p-9">
              <h2 className="text-3xl md:text-4xl">New listing</h2>
              <div className="mt-6">
                <ListingForm profile={profile} onCreated={handleCreated} />
              </div>
            </Card>
          </section>

          <section aria-label="Your listings">
            <h2 className="mb-4 text-3xl md:text-4xl">Your listings</h2>
            {notice && <p role="status" className="mb-3 rounded-[6px] bg-ok-bg px-4 py-3 text-sm text-ok-ink">{notice}</p>}
            {loading && <LoadingState label="Loading your listings…" />}
            {!loading && error && (
              <EmptyState title="Could not load your listings" action={<Button variant="dark" onClick={load}>Try again</Button>}>{error}</EmptyState>
            )}
            {!loading && !error && listings.length === 0 && (
              <EmptyState title="No listings yet">Your first listing will appear here once you post it.</EmptyState>
            )}
            {!loading && !error && listings.length > 0 && (
              <div className="grid gap-3">
                {listings.map((l) => <ListingRow key={l.id} listing={l} />)}
              </div>
            )}
          </section>
        </div>

        {!loading && !error && (
          <section aria-label="Open on the platform" className="mt-16">
            <h2 className="text-3xl md:text-4xl">Open on the platform</h2>
            <p className="mb-4 mt-2 max-w-2xl text-sm text-muted">Food other verified donors have listed right now. This is what NGOs see on their food board.</p>
            {others.length === 0 ? (
              <EmptyState title="Nothing else is listed">When another donor lists food, it shows up here.</EmptyState>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {others.map((l) => <ListingRow key={l.id} listing={l} />)}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  )
}
