# District 14: plán auditu a úprav 3D světa

**Rozsah:** jediný otevřený Free Play / Sandbox svět  
**Stav:** plán po statickém auditu zdrojového kódu  
**Auditovaný commit:** `1a86314791583589038a494c05c89c68eac4b03b` (`main`, 20. 11. 2026)

## 1. Produktové rozhodnutí a hranice rozsahu

District 14 bude v této etapě **jeden souvislý 3D svět pro volné hraní a průzkum**. Hráč se může pohybovat po ulici, okolí budov a přístupných interiérech bez úkolů a bez povinného postupu.

V této etapě se **neimplementuje**:

- Rules World ani oddělený svět s pravidly,
- mise, questy, skóre, ekonomika, levelování nebo jiné cílové herní systémy,
- druhý herní režim nebo odkaz na City Courier,
- systém přepínání mezi různými světy.

K případnému Rules World se vrátíme až na výslovné rozhodnutí zadavatele. Architektura má umožnit pozdější rozšíření, ale nesmí kvůli němu komplikovat současný sandbox.

## 2. Shrnutí současného stavu

Projekt je jednoduchá aplikace Vite + Three.js. Scéna se skládá z lokálních GLB modelů, procedurálně doplněné ulice, zeleně, osvětlení, dopravy, chodců a dvou interiérů. Hlavní implementace je soustředěná v `src/main.js`, kolize jsou v `src/collision.js` a modely s manifestem v `public/models/`.

Pozitivní základ:
- modely se načítají lokálně přes manifest a opakované požadavky sdílí cache,
- existuje samostatný modul pro kruhové kolize s AABB a klouzání podél překážek,
- hráč může vstoupit do dvou interiérů,
- dopravní prostředky a chodci mají základní pohyb,
- CI na auditovaném commitu dokončilo 11/11 testů, produkční build i deploy.

**Důležité omezení auditu:** poskytnutou živou stránku `https://akcizur.github.io/14B/` se v tomto běhu nepodařilo načíst do vizuálního prohlížeče. Níže uvedené nálezy proto vycházejí z aktuálního zdrojového kódu, manifestu, stromu repozitáře a logů CI, nikoli z potvrzeného screenshotového průchodu živou scénou. Přesné vizuální umístění a proporce GLB modelů se musí ověřit při následujícím spuštění v prohlížeči.

## 3. Zjištěné chyby a technický dluh

### P0 – neplatný odkaz na jiný režim

- `index.html` obsahuje odkaz `./city-courier/`, ale v aktuálním stromu repozitáře není `public/city-courier/`.
- README a jeden test stále předpokládají existenci City Courier.
- Pro aktuální zadání je tento odkaz i očekávání zastaralé. V sandboxu má být pouze vstup do District 14.

**Náprava:** odstranit odkaz a související tvrzení z UI, README a testů. Nepřidávat chybějící režim.

### P1 – neúplné kolize objektů ve světě

Kolizní boxy se přidávají jen vybraným objektům. Z kódu vyplývá, že bez kolize zůstávají například ploty, lampy veřejného osvětlení, skleníky, kontejnery, autobusová zastávka, elektrická skříň, prádelní šňůra, klimatizace a většina stromů. Poštovní schránky a květináče jsou výslovně vynechané. Pohybující se auta a chodci také nemají kolizní tělesa.

**Dopad:** hráč může procházet částí městského vybavení, stromů a pohybujících se objektů. Současný seznam kolizí neodpovídá všemu, co je ve scéně vidět.

**Náprava:** zavést jednotný způsob registrace kolizí pro statické objekty a jednoduché dynamické kolize pro dopravu a chodce. U dekorativních objektů musí být možné kolizi vypnout záměrně, nikoli tím, že na ni vývoj zapomene.

### P1 – vstup do domu není vázaný na dveře

`nearestDoor()` vybírá dům podle vzdálenosti od středu vstupní pozice. Nekontroluje, zda hráč stojí před dveřmi nebo se na ně dívá. V důsledku lze pravděpodobně vstoupit do domu i z boku či zezadu, pokud se hráč přiblíží dostatečně blízko.

Pozice dveřního markeru je navíc odvozena pevnými offsety od bounding boxu budovy. Není ověřeno, že odpovídá skutečnému vstupu v konkrétním GLB modelu.

**Náprava:** navázat interakci na skutečnou pozici dveří, přístupovou zónu a směr hráče. Vizuální marker musí sedět na vstupu modelu. Vstup zezadu přes stěnu nesmí být možný.

### P1 – interiéry nejsou prostorově odvozené od budov

Oba domy používají procedurálně vytvořený interiér stejné základní velikosti (7 × 4,4 m, výška 3 m), zatímco obálka budovy je načtená z GLB modelu a normalizovaná na výšku 10,1 m. Interiér je při vstupu zapínán místo vnějšího modelu a kamera se teleportuje do předem určené pozice.

Tento přístup může fungovat jako herní zkratka, ale geometrie interiéru, dveří, oken a obálky nemusí přesně navazovat. Kolize nábytku se vytvářejí z bounding boxů modelů, což může být u nepravidelných tvarů příliš hrubé.

**Náprava:** při vizuálním průchodu ověřit oba domy zvlášť. Sjednotit pozici dveří, měřítko, orientaci, okna a průchodnost. U nábytku upravit příliš objemné nebo chybějící kolizní tvary a zajistit, aby se hráč nezasekával v rozích.

### P1 – pohyb a kolizní řešení potřebují důkladnější testy

- Diagonální vstup sčítá pohyb dopředu a do strany, takže hráč může běžet rychleji diagonálně.
- `resolveAxisMovement()` dává při řešení blokovaného pohybu přednost ose X. V určitých rozích to může způsobovat nevyvážené klouzání.
- Hráčova pozice Y je v každém kroku nastavena na pevnou hodnotu 1,7 m. Neexistuje gravitace, schody ani změna výšky terénu.
- Současné testy kolizí ověřují jen několik izolovaných případů, nikoli pohyb po skutečné mapě.

**Náprava:** normalizovat vektor pohybu, otestovat klouzání v rozích a u úzkých průchodů a sjednotit pravidla pro chůzi po chodníku, silnici a v interiéru. Gravitaci nebo skákání nepřidávat automaticky; nejdříve ověřit, zda je současný rovinný sandbox vůbec potřebuje.

### P1 – hranice světa a průchodnost nejsou ověřené jako celek

Venkovní pohyb je omezen obdélníkem X -40 až 40 a Z -29 až 29. Je potřeba ověřit, že tato hranice odpovídá skutečné geometrii země, silnice, chodníků a okolních budov. U některých objektů může hráč projít skrz, u jiných může být naopak zbytečně blokovaný velkým AABB.

**Náprava:** určit jasnou hranici hratelného prostoru, bezpečný spawn a průchozí trasy. Dekorativní pozadí musí být odlišeno od objektů, které hráče skutečně blokují.

### P2 – výkon a načítání

- Produkční JavaScript bundle má přibližně 599 kB minifikovaně a Vite hlásí překročení limitu 500 kB.
- Všechny modely potřebné pro svět se připravují při inicializaci před zobrazením úvodní obrazovky. Na pomalejších zařízeních může být čekání dlouhé.
- `shadowify()` zapíná vrhání a přijímání stínů na všech meshech, včetně drobných objektů.
- Scéna používá několik bodových světel, stínovou mapu 2048² a pixel ratio až 1,7 bez uživatelské volby výkonu.
- Dvě testovací sady opakují část stejných kontrol GLB manifestu.

**Náprava:** měřit reálný čas načítání a FPS, rozdělit kód do logických modulů a podle potřeby použít lazy loading, jednodušší stíny a limity kvality. Nesnižovat vizuální kvalitu naslepo; optimalizovat podle měření.

### P2 – nepřesnosti v HUD a dokumentaci

- README označuje čas jako „in-game clock“, ale HUD zobrazuje skutečný lokální čas zařízení.
- Dokumentace a testy stále popisují druhý režim City Courier.
- Zobrazený počet 68 assetů je pevně zadaný text, nikoli hodnota načtená z manifestu.
- Není doložen kompletní licenční a atribuční přehled modelů; README na to správně upozorňuje.

**Náprava:** sjednotit terminologii, popis ovládání a fakta v dokumentaci. Čas buď označit jako lokální čas, nebo později implementovat skutečný herní čas. Počet assetů odvozovat z manifestu.

## 4. Plán změn

### Fáze 0 – stabilizace rozsahu

1. Potvrdit jediný režim Free Play / Sandbox.
2. Odstranit odkaz City Courier z úvodní obrazovky.
3. Opravit README a testy, aby nevyžadovaly neexistující druhý režim.
4. Zachovat aktuální technologický základ Three.js + Vite; nepřepisovat projekt do Reactu ani jiného frameworku bez důvodu.

**Výsledek:** aplikace jednoznačně spouští jeden volný 3D svět.

### Fáze 1 – technický a vizuální průchod mapou

1. Vytvořit přehled všech zón: hlavní ulice, chodníky, zahrady, domy, okolní budovy, zeleň a interiéry.
2. Ověřit měřítko modelů, jejich orientaci, výšku vůči zemi a vzájemné překryvy.
3. Zkontrolovat povrch silnice, obrubníky, chodníky, přechody a vstupy do budov.
4. Přidat dočasný debug režim: bounding boxy, kolizní boxy, pozice hráče, směr pohledu, FPS a počty objektů.
5. Zkontrolovat spawn a všechny hrany mapy.

**Výsledek:** vznikne ověřená mapa skutečných průchozích a neprůchozích míst, ne jen seznam objektů ve zdrojovém kódu.

### Fáze 2 – pohyb a fyzická konzistence

1. Normalizovat diagonální pohyb a sjednotit rychlost chůze/běhu.
2. Vyladit kolizní řešení u rohů, stěn, plotů, stromů a úzkých průchodů.
3. Doplnit kolize chybějících statických objektů podle jejich role.
4. Nastavit jednoduché kolize pohybujících se vozidel a chodců, pokud mají hráči fyzicky bránit v průchodu.
5. Zajistit, že kolize dekorací, interiérů a vnějších budov se navzájem nevylučují ani nepřekrývají chybně.
6. Zpřesnit interakci dveří: správná strana, reálná pozice a směr hráče.

**Výsledek:** hráč se může přirozeně pohybovat a nemůže procházet pevnou geometrií ani se běžně zasekávat.

### Fáze 3 – domy a interiéry

1. Ověřit obě budovy a vstupy proti jejich skutečným GLB modelům.
2. Srovnat vnější dveře, marker a bod teleportu s vnitřní geometrií.
3. Zkontrolovat průchodnost kolem nábytku, dveřních otvorů a příček.
4. Upravit kolize nábytku, aby odpovídaly jeho reálnému půdorysu.
5. Prověřit stěny, okna, strop, osvětlení a přechod ven/dovnitř.

**Výsledek:** oba interiéry působí jako přirozená součást stejného světa a mají funkční vstup i výstup.

### Fáze 4 – atmosféra, doprava a život světa

1. Ověřit rychlosti, směry a trasy všech aut a chodců.
2. Zkontrolovat, zda se objekty navzájem neprotínají, nevjíždějí do chodníků a správně se vracejí na trasu.
3. Doladit osvětlení, stíny, mlhu, barvy povrchů a vizuální čitelnost.
4. Zajistit, aby dekorativní objekty podporovaly orientaci a nepůsobily jako náhodně rozmístěné assety.

**Výsledek:** svět působí soudržně a živě, ale zůstává sandboxem bez úkolů a pravidel.

### Fáze 5 – výkon, testy a vydání

1. Změřit načítání, velikost bundle, FPS a spotřebu paměti.
2. Optimalizovat stíny, světla, pixel ratio a načítání pouze tam, kde měření ukáže problém.
3. Doplnit automatické testy manifestu, kolizí, interakcí a základních mapových hranic.
4. Ověřit produkční build a nasazení přes GitHub Pages.
5. Provést ruční průchod v aktuálních desktopových prohlížečích a ověřit pointer lock, pauzu, návrat z focus loss a změnu velikosti okna.

**Výsledek:** stabilní, reprodukovatelná verze otevřeného světa.

## 5. Akceptační kritéria

- Po otevření GitHub Pages se načte jeden District 14 Free Play svět.
- V konzoli nejsou nevyřešené chyby a všechny požadované modely se načtou bez 404.
- Hráč se může pohybovat po všech zamýšlených venkovních trasách a obou interiérech.
- Pevné budovy, stěny, ploty a relevantní městské objekty mají správné kolize.
- Hráč neprochází vozidly nebo chodci, pokud jsou nastavené jako fyzické překážky.
- Do domu lze vstoupit pouze u správného vstupu, nikoli přes zadní nebo boční stěnu.
- Interiéry nemají nechtěné mezery, překryvy a neprůchodné dveře.
- Spawn a hranice mapy jsou bezpečné a srozumitelné.
- Výkon je změřen na běžném desktopovém zařízení a případné kompromisy v kvalitě jsou zdokumentované.
- Žádné mise, skóre, pravidla ani Rules World nejsou součástí této fáze.

## 6. Doporučené pořadí implementace

| Priorita | Oblast | Důvod |
|---|---|---|
| P0 | Jediný Free Play režim a odstranění City Courier odkazu | Odpovídá aktuálnímu zadání |
| P1 | Kompletní kolize a průchodnost mapy | Základní funkčnost sandboxu |
| P1 | Dveře a návaznost interiérů | Odstraní průchod skrz obálku domů |
| P1 | Pohyb, rohy a hranice světa | Zabrání zasekávání a chybné rychlosti |
| P2 | Rozmístění a chování dopravy/NPC | Věrohodnost živého světa |
| P2 | Atmosféra a vizuální soudržnost | Kvalita výsledné scény |
| P2 | Optimalizace a rozšíření testů | Stabilní běh na více zařízeních |

## 7. Rozhodovací bod

Po dokončení a otestování Free Play sandboxu se zastaví vývoj a vyhodnotí se stav světa. **Rules World se nezačne vytvářet automaticky.** Bude samostatným budoucím rozhodnutím a novým zadáním.
