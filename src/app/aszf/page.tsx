import type { Metadata } from 'next'
import Link from 'next/link'
import PageShell from '@/components/ui/PageShell'
import { LEGAL_UPDATED, OPERATOR, SERVICE_NAME } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Felhasználási feltételek | Anime Graph',
  description: 'Mire vállalkozunk, mit várunk tőled, és mi a helyzet a tartalmakkal.',
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="h2 mt-10 mb-3 text-text-1">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 max-w-[68ch] text-[15px] leading-[1.75] text-text-2">{children}</p>
}

export default function AszfPage() {
  return (
    <PageShell width="narrow">
      <h1 className="display-l text-text-1">Felhasználási feltételek</h1>
      <p className="mt-2 text-sm text-text-3">Utolsó módosítás: {LEGAL_UPDATED}</p>

      <H>Ki a szolgáltató</H>
      <P>
        A {SERVICE_NAME} szolgáltatást {OPERATOR.name} üzemelteti (székhely: {OPERATOR.address}). Kapcsolat:{' '}
        {OPERATOR.email}. A regisztrációval elfogadod az alábbi feltételeket.
      </P>

      <H>Mit nyújt a szolgáltatás</H>
      <P>
        Anime- és manga-lista vezetése, katalógus-böngészés, 3D-s kapcsolati térkép, valamint az ízlésedből
        épített ajánlások. A szolgáltatás jelenleg díjmentes. Nem garantáljuk a folyamatos, hibamentes
        elérhetőséget, és fenntartjuk a jogot funkciók módosítására vagy megszüntetésére.
      </P>

      <H>Fiók</H>
      <P>
        A regisztrációhoz valós e-mail-cím kell, mert a fiók megerősítése és a jelszó-visszaállítás ezen
        keresztül működik. A jelszavad titokban tartása a te felelősséged. Egy személy egy fiókot hozzon létre.
        14 éven aluliak a szolgáltatást ne használják.
      </P>

      <H>Az általad feltöltött tartalom</H>
      <P>
        A véleményeid és a listád a tiéd maradnak. Azzal, hogy közzéteszed őket, engedélyt adsz arra, hogy a
        szolgáltatáson belül megjelenítsük, és hogy az ízlés-profilod előállításához feldolgozzuk (beleértve a
        külső AI-szolgáltatót, lásd az{' '}
        <Link href="/adatvedelem" className="text-text-1 underline decoration-white/25 underline-offset-4">
          adatvédelmi tájékoztatót
        </Link>
        ). Ezt az engedélyt a tartalom törlésével visszavonod.
      </P>
      <P>
        Ne tegyél közzé jogsértő, gyűlölködő, zaklató vagy mások jogait sértő tartalmat, és ne tölts fel olyat,
        amire nincs jogod. A feltételeket sértő tartalmat eltávolíthatjuk, ismételt vagy súlyos esetben a fiókot
        felfüggeszthetjük.
      </P>

      <H>Amit ne csinálj</H>
      <P>
        Ne terheld automatizált eszközzel a szolgáltatást, ne kerüld meg a kérésszám-korlátozást vagy az
        AI-kereteket, ne próbálj más fiókjához hozzáférni, és ne szedd le tömegesen az adatbázist. A
        katalógusadatok külső forrásokból (például AniList) származnak, azok saját feltételei is érvényesek.
      </P>

      <H>Felelősség</H>
      <P>
        A szolgáltatást {'„ahogy van”'} alapon nyújtjuk. Az ajánlások gépi becslések, nem
        szakvélemények. A
        katalógusadatok pontosságáért nem vállalunk felelősséget, mert külső forrásból érkeznek. A jogszabály
        által megengedett mértékig kizárjuk a felelősséget a szolgáltatás használatából eredő közvetett károkért.
        Ez nem érinti a fogyasztót a kógens jogszabályok alapján megillető jogokat.
      </P>

      <H>Megszűnés</H>
      <P>
        A fiókodat bármikor törölheted. Mi akkor függeszthetjük fel vagy szüntethetjük meg a hozzáférésedet, ha
        megszeged a feltételeket, vagy ha a szolgáltatás üzemeltetését beszüntetjük. Utóbbi esetben ésszerű időt
        adunk az adataid kimentésére.
      </P>

      <H>Alkalmazandó jog</H>
      <P>
        A jelen feltételekre a magyar jog irányadó. A fogyasztói jogviták rendezéséhez békéltető testülethez
        fordulhatsz.
      </P>

      <H>Változás</H>
      <P>
        A feltételek módosulhatnak. Lényeges változásról a regisztrált felhasználókat e-mailben értesítjük, és a
        fenti dátumot frissítjük. A további használat a módosítás elfogadását jelenti.
      </P>
    </PageShell>
  )
}
