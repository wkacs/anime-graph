import PageShell from '@/components/ui/PageShell'
import Skeleton from '@/components/ui/Skeleton'

// Globális navigációs vázlat. Enélkül route-váltáskor a Next az ELŐZŐ oldalt
// mutatta, amíg az új szerver-válasz meg nem jött — mobilon (TWA, lassú net)
// másodpercekig úgy tűnt, mintha a koppintás el se sült volna, aztán „a News
// után hirtelen átugrott" az új lapra. A vázlat azonnal átveszi a helyet.
// A rács a leggyakoribb oldalforma (poszter-grid); a célzottabb vázlatot a
// route-szintű loading.tsx adhatja később, ez a közös alap.
export default function Loading() {
  return (
    <PageShell>
      <div role="status" aria-label="Loading" className="space-y-6">
        <div className="space-y-2.5">
          <div className="w-44">
            <Skeleton variant="text" />
          </div>
          <div className="w-64 opacity-60">
            <Skeleton variant="text" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <Skeleton variant="poster" count={12} />
        </div>
      </div>
    </PageShell>
  )
}
