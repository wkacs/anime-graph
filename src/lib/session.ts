import { cookies } from 'next/headers'
import { verifySession } from './auth'

// route-oldali helper: a bejelentkezett user id-ja vagy null
export async function requireUserId(): Promise<number | null> {
  const token = (await cookies()).get('session')?.value
  return verifySession(process.env.SESSION_SECRET!, token)
}
