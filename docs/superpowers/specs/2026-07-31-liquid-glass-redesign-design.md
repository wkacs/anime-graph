# Liquid Glass újraélesztés — design spec

**Dátum:** 2026-07-31
**Státusz:** jóváhagyva (user, demó-iteráció után)
**Cél:** az app kinézete marad (szén-monokróm, sötét), de az élmény „életre kel": liquid glass felületek, átszűrődő életlen fény, kurzorkövető csillanás, fluid 400-600 ms-os mozgás — wow minden kártyán és gombon, de sosem tolakodó.

## Döntés-előzmény (demó-iteráció)

Három interaktív demó után rögzített irány:

1. Klasszikus mozgás-személyiségek (játékos spring / visszafogott / filmszerű) — **elvetve**, egyik sem adta az érzést.
2. Ambient + scroll + játékos-prémium keverék — **közelebb, de nem az**.
3. **Liquid glass** (VisionOS-jellegű): fény az üveg mögött, specular highlight, fluid görbék — **„Aha pontosan ez"**, azzal a módosítással, hogy a mint-zöld akcent kikerül, szén-monokróm marad.

További user-döntések:
- **Megközelítés:** teljes framer-motion refaktor (nem csak CSS-réteg).
- **Font:** Inter váltja az Instrument Sans + Bricolage Grotesque párost.
- **Hatókör:** teljes app (főoldal, böngésző, adatlap, listák, toplista, graf-környezet, nav).

## 1 · Design-nyelv (globals.css tokenek)

### Üveg-skála
A jelenlegi `--surface-1/2/3` skála helyére `glass-1/2/3`:

| Token | blur | háttér | szerep |
|---|---|---|---|
| glass-1 | 16px | rgba(255,255,255,0.035) | sorok, kis kártyák |
| glass-2 | 24px | rgba(255,255,255,0.05) | kártyák, panelek |
| glass-3 | 32px | rgba(255,255,255,0.08) | nav, modál, kiemelt |

Minden szint: `saturate(170%)`, 1px fehér-alpha él, `inset 0 1px 0` felső él-csillanás, mély lágy árnyék. A meglévő `.glass/.glass-strong` legacy aliasok az új skálára mutatnak.

### Fény-réteg (ambient)
- `GlowField` komponens a root layoutban, a tartalom MÖGÖTT (z-index 0, fixed).
- 3-4 semleges orb (fehér `0.07-0.10` alpha, acélszürke `0.08-0.09`), `blur(70px)`, `mix-blend-mode: screen`, 20-40 s drift-ciklusok, `alternate`.
- Mobilon 2 orb.

### Specular (kurzorkövető csillanás)
- EGY globális `pointermove` listener (rAF-throttle), a viewportban lévő `.glass` elemeken állítja a `--mx/--my` CSS-változókat.
- `.glass::before`: `radial-gradient(340px circle at var(--mx) var(--my), rgba(255,255,255,0.09), transparent 65%)`, hoverre úszik be (opacity 0.5 s).
- Touch-eszközön inaktív.

### Motion-tokenek
- Easing: `--fluid: cubic-bezier(0.32,0.72,0,1)`.
- Időzítés: micro 300 ms · belépés 500 ms · kilépés 350 ms (kilépés mindig rövidebb).
- Framer spring-preset: ~5% túllövés (pl. stiffness 260 / damping 30) — játékos, de prémium.
- Hover: `translateY(-4px) scale(1.015)` kártyán, `scale(1.03)` gombon; active: `scale(0.97)` gyors (100 ms).

### Tipográfia
- **Inter** (next/font/google) veszi át a `--font-instrument` és `--font-bricolage` szerepét is; display: Inter 700-800, `-0.03em` tracking.
- Nagy címeken ezüst-gradiens szöveg: `linear-gradient(100deg,#fafafa,#c9ccd4 45%,#8f939c)` + `background-clip:text`.
- Geist Mono (label/adat) és Noto Sans JP (japán címek) marad.

### Szín
- Szén-monokróm chrome; a mint (`#7fd8ad`) mint UI-AKCENT kivezetve (gombok, badge-ek, headline-ok nem zöldek).
- Státusz-színek (`--status-watching` stb.) apró ADAT-jelzésként maradnak (pontok, dot-ok) — adat-szemantika, nem akcent.
- Poszter-eredetű halo-fények maradnak színesek (tartalom-fény): a MediaCard mögötti glow a poszter domináns színéből jön.

## 2 · Motion-architektúra

- `src/lib/motion.ts` — KÖZPONTI variant/tokens modul: `fadeUp`, `staggerContainer(delay)`, `cardHover`, `listItem`, `springFluid`, `tweenFluid`. Minden komponens innen importál; tilos inline egyedi timing.
- `template.tsx`: **opacity-only marad** — transform containing blockot csinálna és eltörné a `position:fixed` overlay-eket (vibe picker, finish modal, graph panels). Ez dokumentált gotcha, NEM szabad transformot tenni bele. Időzítés: 0.3 s fluid.
- Reveal: `whileInView` + `viewport={{ once: true, amount: 0.2 }}` szekció-szinten, 60-90 ms stagger a gyerekeken.
- Tab/filter aktív-jelölő: framer `layoutId` úszó üveg-pill (SeasonFilterBar, MobileTabBar, TopNav, adatlap-tabok).
- `AnimatePresence`: szűrő-váltás grid-exit/enter, modálok, sheetek.
- `MotionConfig reducedMotion="user"` a providerben + CSS `prefers-reduced-motion` fallback az ambient rétegre.

## 3 · Komponens-lefedés

| Terület | Komponensek | Mit kap |
|---|---|---|
| Primitívek | ui/Button, ui/Chip | üveg-pill + specular + whileHover/whileTap |
| Primitívek | ui/Skeleton | shimmer üveg-felületen |
| Primitívek | ui/SectionHeader, ui/PageShell, ui/EmptyState | reveal + stagger |
| Kártya | MediaCard (+ ui/PosterAmbient bővítés) | üvegkeret, poszter-színű halo mögötte, hover-emelés + poster-scale |
| Nav | TopNav, MobileTabBar | glass-3 sáv, layoutId aktív-indikátor, scrollra sűrűsödő üveg |
| Főoldal | home/HeroToday | nagy fluid belépés, ambient fény-parallax |
| Főoldal | home/WeekCalendar, SeasonGrid, FollowedRow, NextSeason, SocialFeed | stagger-reveal, filter-exit/enter |
| Adatlap | CatalogTitlePage, StreamLinks, ThemesPlayer, CharacterGrid | poszter+meta lépcsős belépés, üveg-panelek |
| Toplista | Podium, LeaderboardRow, MetricValue | podium-reveal, sor-stagger, count-up |
| Graf | graf page, HierarchyPanel | canvas köré fade+scale belépés/kilépés, üveg-panelek; a 3D belső kamera/fizika NEM változik |
| Egyéb | TonightPicker, RecommendMorph, WrappedStory | meglévő animációk átkötése a közös tokenekre |

## 4 · Perf-védőkorlátok

- **Blur-budget:** igazi `backdrop-filter` csak: nav, modálok, hero-panelek, tabok, kiemelt kártyasorok (viewportonként ~10-15 elem max). Nagy rácsokon (böngésző-grid, hosszú listák) **pszeudo-üveg**: alpha-bg + él-csillanás + árnyék, backdrop-filter NÉLKÜL — sötét háttéren vizuálisan közel azonos, GPU-n nagyságrenddel olcsóbb.
- Mobil: blur-értékek felezve, GlowField 2 orb.
- Csak `transform`/`opacity` animálódik; `will-change` csak interakció alatt.
- Bundle: framer-motion már dependency; `LazyMotion` + `m.*` megfontolandó, de nem kötelező első körben.
- A 455 meglévő teszt zölden marad; ahol komponens-teszt DOM-ra érzékeny, motion-mock.

## 5 · Nem-célok

- Funkcionalitás, adatmodell, API, i18n-szövegek nem változnak.
- 3D-gráf belső működése (kamera, fizika, node-render) nem változik.
- Poszter/tartalom-színek nem változnak; világos mód nincs (app dark-only).

## Elfogadási kritériumok

1. Minden fő oldal (/, /bongeszo, /anime/[id], /lista, /toplista, /graf, /velemenyek, /vs, /stats) az új üveg-nyelvet használja.
2. Kurzorkövető specular él minden hoverölhető üvegen desktopon; touch-on nincs.
3. GlowField ambient fény minden oldalon a tartalom mögött.
4. Inter az egyetlen sans (Geist Mono + Noto JP marad); Bricolage és Instrument Sans eltávolítva.
5. Mint-zöld UI-akcent nincs; státusz-dot adatszínek maradnak.
6. `prefers-reduced-motion` alatt: ambient áll, reveal-ek instant, funkcionalitás teljes.
7. `npm test` (455) + `tsc` + `next build` zöld.
8. Lighthouse perf a főoldalon nem romlik 5 pontnál többet a kiindulóhoz képest.
