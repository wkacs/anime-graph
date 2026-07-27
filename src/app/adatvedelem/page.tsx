import type { Metadata } from 'next'
import PageShell from '@/components/ui/PageShell'
import { LEGAL_UPDATED, OPERATOR, PROCESSORS, SERVICE_NAME } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Adatvédelmi tájékoztató | Anime Graph',
  description: 'Milyen adatot kezel az Anime Graph, miért, meddig, és milyen jogaid vannak.',
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="h2 mt-10 mb-3 text-text-1">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 max-w-[68ch] text-[15px] leading-[1.75] text-text-2">{children}</p>
}

export default function AdatvedelemPage() {
  return (
    <PageShell width="narrow">
      <h1 className="display-l text-text-1">Adatvédelmi tájékoztató</h1>
      <p className="mt-2 text-sm text-text-3">Utolsó módosítás: {LEGAL_UPDATED}</p>

      <H>Ki kezeli az adataidat</H>
      <P>
        A szolgáltatás neve {SERVICE_NAME}. Az adatkezelő: {OPERATOR.name}, székhely: {OPERATOR.address}
        {OPERATOR.registration ? `, nyilvántartási szám: ${OPERATOR.registration}` : ''}. Adatvédelmi
        kérdésekben elérhető: {OPERATOR.email}.
      </P>

      <H>Milyen adatot kezelünk</H>
      <P>
        <strong className="text-text-1">Fiókadatok:</strong> felhasználónév, e-mail-cím, jelszó (kizárólag
        scrypt-tel képzett lenyomat formájában, a nyers jelszót nem tároljuk és nem ismerjük), bemutatkozás,
        nyelvi beállítás, regisztráció időpontja.
      </P>
      <P>
        <strong className="text-text-1">Tartalom, amit te hozol létre:</strong> anime- és manga-listád,
        értékeléseid, szöveges véleményeid, epizód-haladásod, könyvjelzőid, kedvenc karaktereid, valamint az
        ezekből képzett ízlés-profil.
      </P>
      <P>
        <strong className="text-text-1">Technikai adatok:</strong> munkamenet-süti a bejelentkezéshez,
        nyelvválasztás sütije, továbbá az IP-címed a visszaélés elleni védelemhez (kérésszám-korlátozás). Az
        IP-cím rövid, automatikusan lejáró rekordban él, és nem kötjük hozzá a fiókodhoz.
      </P>
      <P>
        <strong className="text-text-1">Értesítések:</strong> ha engedélyezed a böngésző-értesítéseket, a
        feliratkozás technikai azonosítóját tároljuk. Bármikor visszavonhatod.
      </P>
      <P>
        Az e-mail-megerősítés és a jelszó-visszaállítás linkjeiből csak a token sha256-lenyomatát tároljuk, így
        egy esetleges adatbázis-szivárgás önmagában nem tesz lehetővé fiók-átvételt.
      </P>

      <H>Miért kezeljük, és milyen jogalapon</H>
      <P>
        A fiókod működtetése, a listád tárolása és az ajánlások előállítása a veled kötött{' '}
        <strong className="text-text-1">szerződés teljesítéséhez</strong> szükséges (GDPR 6. cikk (1) b)). A
        visszaélés elleni védelem és a szolgáltatás biztonsága a mi{' '}
        <strong className="text-text-1">jogos érdekünk</strong> (6. cikk (1) f)). A böngésző-értesítés a te{' '}
        <strong className="text-text-1">hozzájárulásod</strong> alapján működik (6. cikk (1) a)), amit bármikor
        visszavonhatsz.
      </P>

      <H>AI-feldolgozás, és ami ezzel jár</H>
      <P>
        A szolgáltatás lényege, hogy a szöveges véleményeidből ízlés-profilt épít. Ehhez a véleményed szövege és
        a listád vonatkozó része <strong className="text-text-1">külső AI-szolgáltatóhoz kerül továbbításra</strong>.
        Az elsődleges szolgáltató Kínában működik. Ez az Európai Gazdasági Térségen kívüli adattovábbítást
        jelent, ahol az adatvédelmi szint eltérhet az uniós szinttől.
      </P>
      <P>
        Ha ezt nem szeretnéd, ne írj szöveges véleményt. A lista vezetése, a katalógus böngészése és a gráf
        AI-feldolgozás nélkül is működik.
      </P>

      <H>Kinek adjuk tovább</H>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="py-2 pr-4 font-medium text-text-1">Címzett</th>
              <th className="py-2 pr-4 font-medium text-text-1">Cél</th>
              <th className="py-2 font-medium text-text-1">Hol</th>
            </tr>
          </thead>
          <tbody>
            {PROCESSORS.map((p) => (
              <tr key={p.name} className="border-b border-white/5 last:border-0">
                <td className="py-2 pr-4 align-top text-text-1">{p.name}</td>
                <td className="py-2 pr-4 align-top text-text-2">{p.purpose}</td>
                <td className="py-2 align-top whitespace-nowrap text-text-2">{p.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <P>Az adataidat nem adjuk el, és nem használjuk hirdetési célra.</P>

      <H>Meddig őrizzük</H>
      <P>
        A fiókodhoz kötött adatokat addig kezeljük, amíg a fiókod fennáll. Ha törlöd a fiókodat, a hozzá tartozó
        adatok törlődnek. A visszaélés elleni védelem technikai rekordjai rövid időn belül automatikusan
        lejárnak. A rendszer-levelek kézbesítési adatait a levélküldő szolgáltató a saját határidői szerint
        kezeli.
      </P>

      <H>A te jogaid</H>
      <P>
        Kérheted a rólad kezelt adatok másolatát, helyesbítését, törlését, a kezelés korlátozását, és
        tiltakozhatsz a jogos érdeken alapuló kezelés ellen. Kérheted az adataid hordozható formában történő
        kiadását is. Írj a(z) {OPERATOR.email} címre, és egy hónapon belül válaszolunk.
      </P>
      <P>
        Ha úgy érzed, jogsértés történt, panaszt tehetsz a Nemzeti Adatvédelmi és Információszabadság
        Hatóságnál (NAIH, 1055 Budapest, Falk Miksa utca 9-11., naih.hu), illetve bírósághoz fordulhatsz.
      </P>

      <H>Sütik</H>
      <P>
        Csak működéshez szükséges sütiket használunk: a bejelentkezési munkamenetet és a nyelvválasztást. Nincs
        analitikai és nincs hirdetési süti, ezért süti-hozzájárulási sávot sem kérünk.
      </P>

      <H>Változás</H>
      <P>
        Ha a tájékoztató érdemben változik, a fenti dátum frissül. Lényeges változásról a regisztrált
        felhasználókat e-mailben értesítjük.
      </P>
    </PageShell>
  )
}
