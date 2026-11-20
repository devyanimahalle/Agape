import { Link, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import { Card } from '../components/ui'
import { PORTALS } from '../lib/portals'
import { PORTAL_ROLES, loginPath, registerPath, safeNext } from '../lib/routes'

// whitespace-nowrap keeps "Sign in as Donor / Provider" on one line at every width the cards can have.
const btn = 'press inline-block whitespace-nowrap rounded-[6px] px-3 py-2.5 text-center text-xs font-bold uppercase tracking-[0.5px] md:text-[13px]'

// The gateway between the landing page and sign-in: pick the kind of account first. Compact on purpose: on a
// 1280x720 desktop the nav, band and all three cards (buttons and register links included) fit above the fold.
export default function RoleSelectPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  return (
    <Page compact title="Sign in" subtitle="Choose how you use Agape.">
      <ul className="grid gap-3 md:grid-cols-3">
        {PORTAL_ROLES.map((key) => {
          const p = PORTALS[key]
          return (
            <li key={key} className="flex">
              <Card as="article" aria-label={p.cardTitle} className="flex w-full flex-col p-5 md:p-6">
                <h2 className="text-3xl leading-none">{p.cardTitle}</h2>
                <p className="mt-3 text-sm leading-snug text-muted">{p.cardText}</p>
                <div className="mt-5 flex flex-1 flex-col justify-end gap-2.5">
                  <Link to={loginPath(key, next)} className={`${btn} bg-brand-bright text-ink hover:bg-brand`}>
                    Sign in as {p.label}
                  </Link>
                  <p className="min-h-5 text-xs text-muted">
                    {p.register && (
                      <>
                        {p.register.text}{' '}
                        <Link to={registerPath(key)} className="font-bold text-ink underline underline-offset-4">{p.register.label}</Link>
                      </>
                    )}
                  </p>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 text-sm text-muted">
        <Link to="/" className="underline underline-offset-4">Back to the home page</Link>
      </p>
    </Page>
  )
}
