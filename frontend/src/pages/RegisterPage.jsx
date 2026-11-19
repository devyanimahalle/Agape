import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import { Button, Card } from '../components/ui'
import { api, setToken, USE_MOCKS } from '../lib/api'
import { PORTALS } from '../lib/portals'
import { homeForRole, loginPath, selectRolePath } from '../lib/routes'
import { useAuth } from '../context/AuthContext'

const inputCls = 'mt-1.5 w-full rounded-[6px] bg-canvas px-4 py-3 text-sm font-normal focus:bg-panel'
const labelCls = 'block text-xs font-semibold uppercase tracking-[1px]'
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/

function FieldError({ msg }) {
  return msg ? <p className="mt-1.5 text-xs text-bad-ink">{msg}</p> : null
}

function validate(role, f) {
  const e = {}
  if (!f.name.trim()) e.name = 'Enter your name'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Enter a valid email address'
  if (!PHONE_RE.test(f.phone.trim())) e.phone = 'Enter a valid phone number, for example +91 90000 00000'
  if (f.password.length < 8) e.password = 'Use at least 8 characters'
  if (!f.org_name.trim()) e.org_name = role === 'ngo' ? 'Enter your organisation name' : 'Enter your business name'
  if (role === 'ngo' && !f.reg_number.trim()) e.reg_number = 'Enter your registration number'
  if (!f.address.trim()) e.address = 'Enter the address'
  const lat = Number(f.lat)
  const lng = Number(f.lng)
  if (f.lat === '' || Number.isNaN(lat) || lat < -90 || lat > 90) e.lat = 'Latitude must be between -90 and 90'
  if (f.lng === '' || Number.isNaN(lng) || lng < -180 || lng > 180) e.lng = 'Longitude must be between -180 and 180'
  return e
}

// Self-registration for NGOs and donors. Admin accounts are never self-registered.
export default function RegisterPage() {
  const { user, refresh } = useAuth()
  const [params] = useSearchParams()
  const role = params.get('role')
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', org_name: '', reg_number: '', category: 'restaurant', address: '', lat: '', lng: '' })
  const [errors, setErrors] = useState({})
  const [serverMsg, setServerMsg] = useState('')
  const [geoMsg, setGeoMsg] = useState('')
  const [busy, setBusy] = useState(false)

  if (role !== 'ngo' && role !== 'provider') return <Navigate to={selectRolePath()} replace />
  if (user) return <Navigate to={homeForRole(user.role)} replace />

  const portal = PORTALS[role]
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  function useMyLocation() {
    setGeoMsg('')
    if (!navigator.geolocation) {
      setGeoMsg('This browser cannot share a location. Enter the coordinates by hand.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setF((x) => ({ ...x, lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) })),
      () => setGeoMsg('Location was not shared. Enter the coordinates by hand.'),
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    const errs = validate(role, f)
    setErrors(errs)
    if (Object.keys(errs).length) return
    setBusy(true)
    setServerMsg('')
    try {
      const body = {
        role,
        name: f.name.trim(),
        email: f.email.trim(),
        phone: f.phone.trim(),
        password: f.password,
        org_name: f.org_name.trim(),
        address: f.address.trim(),
        lat: Number(f.lat),
        lng: Number(f.lng),
        ...(role === 'ngo' ? { reg_number: f.reg_number.trim() } : { category: f.category }),
      }
      const data = await api('/auth/register', { method: 'POST', json: body })
      setToken(data.access_token)
      await refresh() // the redirect above sends the new account to its home
    } catch (err) {
      setToken(null)
      setServerMsg(err?.detail || 'Could not create the account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Page title={role === 'ngo' ? 'Register your NGO' : 'Register as a donor'} subtitle={portal.context} width="max-w-3xl">
      {USE_MOCKS ? (
        <Card className="p-7 md:p-9">
          <h2 className="text-3xl md:text-4xl">Not in demo mode</h2>
          <p className="mt-3 text-muted">Registration needs the live backend. In demo mode you can continue straight into the {portal.label} area.</p>
          <Link to={loginPath(role)} className="press mt-6 inline-block rounded-[6px] bg-brand-bright px-6 py-3 text-sm font-bold uppercase tracking-[1px] text-ink hover:bg-brand">
            Go to {portal.label} sign in
          </Link>
        </Card>
      ) : (
        <Card className="p-7 md:p-9">
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {serverMsg && <p role="alert" className="rounded-[6px] bg-bad-bg px-4 py-3 text-sm text-bad-ink">{serverMsg}</p>}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className={labelCls}>Your name *</label>
                <input id="name" className={inputCls} value={f.name} onChange={set('name')} autoComplete="name" />
                <FieldError msg={errors.name} />
              </div>
              <div>
                <label htmlFor="phone" className={labelCls}>Phone *</label>
                <input id="phone" className={inputCls} value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder="+91 90000 00000" />
                <FieldError msg={errors.phone} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className={labelCls}>Email *</label>
                <input id="email" type="email" className={inputCls} value={f.email} onChange={set('email')} autoComplete="email" />
                <FieldError msg={errors.email} />
              </div>
              <div>
                <label htmlFor="password" className={labelCls}>Password *</label>
                <input id="password" type="password" className={inputCls} value={f.password} onChange={set('password')} autoComplete="new-password" />
                <FieldError msg={errors.password} />
              </div>
            </div>

            <div>
              <label htmlFor="org_name" className={labelCls}>{role === 'ngo' ? 'Organisation name *' : 'Business name *'}</label>
              <input id="org_name" className={inputCls} value={f.org_name} onChange={set('org_name')} autoComplete="organization" />
              <FieldError msg={errors.org_name} />
            </div>

            {role === 'ngo' ? (
              <div>
                <label htmlFor="reg_number" className={labelCls}>Registration number *</label>
                <input id="reg_number" className={inputCls} value={f.reg_number} onChange={set('reg_number')} placeholder="REG/2023/001" />
                <FieldError msg={errors.reg_number} />
              </div>
            ) : (
              <div>
                <label htmlFor="category" className={labelCls}>Kind of donor *</label>
                <select id="category" className={inputCls} value={f.category} onChange={set('category')}>
                  <option value="restaurant">Restaurant</option>
                  <option value="caterer">Caterer</option>
                  <option value="general">Home kitchen / other</option>
                </select>
              </div>
            )}

            <div>
              <label htmlFor="address" className={labelCls}>Address *</label>
              <input id="address" className={inputCls} value={f.address} onChange={set('address')} autoComplete="street-address" />
              <FieldError msg={errors.address} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="lat" className={labelCls}>Latitude *</label>
                <input id="lat" inputMode="decimal" className={inputCls} value={f.lat} onChange={set('lat')} placeholder="28.6139" />
                <FieldError msg={errors.lat} />
              </div>
              <div>
                <label htmlFor="lng" className={labelCls}>Longitude *</label>
                <input id="lng" inputMode="decimal" className={inputCls} value={f.lng} onChange={set('lng')} placeholder="77.2090" />
                <FieldError msg={errors.lng} />
              </div>
            </div>
            <div>
              <Button variant="ghost" onClick={useMyLocation} className="!px-0 !py-1 underline underline-offset-4">Use my current location</Button>
              {geoMsg && <p className="mt-1.5 text-xs text-muted">{geoMsg}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button type="submit" variant="brand" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
              <Link to={loginPath(role)} className="text-sm font-bold underline underline-offset-4">I already have an account</Link>
            </div>
          </form>
        </Card>
      )}
    </Page>
  )
}
