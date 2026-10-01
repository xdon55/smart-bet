// Read-only Supabase client for the PUBLIC catalogue.
//
// The catalogue tables (sports, leagues, teams, events, markets, market_types,
// selections, app_settings) have public SELECT policies, so the publishable key
// is enough: no session, no service role. Server-only — never import this from
// a route file or a *.functions.ts module at the top level (import it inside a
// handler with `await import(...)`).
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_')
}

/** New Supabase keys are opaque strings, not bearer JWTs. */
function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    )

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization')
    }

    headers.set('apikey', supabaseKey)
    return fetch(input, { ...init, headers })
  }
}

function createPublicClient() {
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_PUBLISHABLE_KEY']

  if (!url || !key) {
    const missing = [
      ...(!url ? ['SUPABASE_URL'] : []),
      ...(!key ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ]
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(', ')}.`)
  }

  return createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  })
}

let _public: ReturnType<typeof createPublicClient> | undefined

/** Lazily created, cached public (publishable-key) client. */
export const supabasePublic = new Proxy({} as ReturnType<typeof createPublicClient>, {
  get(_, prop, receiver) {
    if (!_public) _public = createPublicClient()
    return Reflect.get(_public, prop, receiver)
  },
})
