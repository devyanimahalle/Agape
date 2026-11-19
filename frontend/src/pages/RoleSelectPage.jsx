import { Link, useSearchParams } from 'react-router-dom'
import Page from '../components/Page'
import { Card } from '../components/ui'
import { PORTALS } from '../lib/portals'
import { PORTAL_ROLES, loginPath, registerPath, safeNext } from '../lib/routes'

const btn = 'press mt-auto inline-block rounded-[6px] px-6 py-3 text-center text-sm font-bold uppercase tracking-[1px]'

// The gateway between the landing page and sign-in: pick the kind of account first.
export default function RoleSelectPage() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))

  return (
    <Page title="Sign in" subtitle="Choose how you use Agape. Each role has its own sign-in and its own home.">
      <ul className="grid gap-3 md:grid-cols-3">
        {PORTAL_ROLES.map((key) => {
          const p = PORTALS[key]
          return (
            <li key={key} className="flex">
              <Card as="article" aria-label={p.cardTitle} className="flex w-full flex-col p-7 md:p-9">
                <h2 className="text-3xl md:text-4xl">{p.cardTitle}</h2>
                <p className="mt-3 leading-relaxed text-muted">{p.cardText}</p>
                <div className="mt-8 flex flex-1 flex-col gap-3">
                  <Link to={loginPath(key, next)} className={`${btn} bg-brand-bright text-ink hover:bg-brand`}>
                    Sign in as {p.label}
                  </Link>
                  {p.register && (
                    <p className="text-sm text-muted">
                      {p.register.text}{' '}
                      <Link to={registerPath(key)} className="font-bold text-ink underline underline-offset-4">{p.register.label}</Link>
                    </p>
                  )}
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
      <p className="mt-6 text-sm text-muted">
        <Link to="/" className="underline underline-offset-4">Back to the home page</Link>
      </p>
    </Page>
  )
}
