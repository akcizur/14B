# District 14: architektura světa

**Engine:** Three.js + Vite  
**Jednotka:** metr  
**Autorovací rozsah:** jedna ulice, jedna parcela, jeden referenční dům  
**Režim:** Free Play / Sandbox

## Prostorový koncept: Main Street World

District 14 je jeden souvislý svět soustředěný kolem jediné dominantní obytné komunikace **Main Street**. Hlavní ulice pokračuje v obou směrech až za horizont a tvoří hlavní orientační i dopravní osu celé hry. Po obou stranách ji lemuje souvislá nebo téměř souvislá řada obytných domů.

Prostor není klasická pravoúhlá uliční síť. Paralelní ulice se nevytvářejí jako pravidelná síť a jejich počet musí zůstat velmi malý. Případná vedlejší komunikace je výjimkou, vzniká jen z konkrétního prostorového důvodu a nesmí konkurovat Main Street. Pěší průchody, vstupy, chodníky, parkování a malé předprostory nejsou automaticky dalšími ulicemi.

Svět může technicky používat prostorové navázání/loop pro zachování kontinuity, ale nesmí působit jako kruhová silnice nebo uzavřený blok. Z pohledu hráče jde o dlouhou obytnou ulici pokračující k horizontu. Interiéry a exteriéry zůstávají v jednom souřadnicovém prostoru bez přechodu na samostatnou scénu.

## Vizuální identita: československé retro-futuristické sídliště

Základní architektonický jazyk vychází z československé bytové a občanské výstavby přibližně z let **1950–1975**: raný a pozdní modernismus, panelové a prefabrikované domy, jednoduché kubické hmoty, pravidelný rastr oken, lodžie, balkony, keramické nebo cihlové obklady, betonové konstrukce a střídmá barevnost. Nejde o přesnou historickou rekonstrukci, ale o uvěřitelnou alternativní budoucnost vyrůstající z této stavební tradice.

Cyberpunková vrstva je technologická, nikoli dekorativní přemíra neonů. Technologie působí jako postupné modernizace staršího sídliště: dodatečné světelné značení, veřejné terminály, kabelové a servisní trasy, dopravní signalizace, antény, energetická infrastruktura, navigační prvky a decentní barevné světelné akcenty. Beton, omítka, sklo, kov a běžné obytné detaily zůstávají dominantní.

### Vertikální město a létající doprava

District 14 je částečně vertikální město se dvěma propojenými vrstvami pohybu:

- **Pozemní vrstva:** Main Street, chodníky, vstupy, parkování a pěší pohyb. Zde zůstává měřítko a charakter obytné ulice.
- **Vzdušná vrstva:** hover/flycars, vyhrazené letové koridory nad úrovní běžného provozu, vybrané střešní nebo zvýšené nástupní a přistávací plochy a vertikální spojení mezi úrovněmi.

Vzdušná doprava musí mít čitelnou výškovou hierarchii a bezpečné odstupy od fasád, oken, střech, chodníků a pěších zón. Létající auta nesmějí bez pravidel prolétat interiéry nebo těsně skrz obytné balkony. Přistávací místa jsou konkrétní architektonické a dopravní uzly, ne náhodné plošiny na každé střeše. Vertikální vrstva nesmí zničit čitelnou hlavní osu Main Street.

### Zásady Main Street

- jedna dominantní průběžná ulice;
- obytné řady domů po obou stranách hlavní komunikace;
- chodníky po obou stranách, vstupy orientované podle skutečných fasád;
- jen několik málo vedlejších ulic, nepravidelně a účelně umístěných;
- žádné automatické generování paralelních ulic, pravoúhlých bloků ani rozsáhlé uliční sítě;
- perspektiva zástavby a komunikace musí přirozeně pokračovat až k horizontu;
- variace domů, odstupů, předprostorů a zeleně nesmí rozbít čitelnost hlavní uliční osy.

## Architektonická pravidla

1. Vnější GLB model definuje fyzickou obálku a měřítko interiéru.
2. Konstrukční těleso se měří odděleně od okenních rámů, říms a dekorativních přesahů.
3. Dveře, okna a sklo se čtou z konkrétních mesh/material částí.
4. Podlaží mohou mít rozdílné výšky. Jejich úrovně jsou explicitní data v metrech.
5. Schodiště, podesta a otvor v desce sdílejí jeden parametrický plán.
6. Ulice, parcela, vstup a přístupová cesta jsou jeden prostorový celek.
7. Chybějící stavební metadata se nesmějí nahrazovat náhodně umístěnou geometrií.
8. Obsah roste ručně a v pořadí; procedurální generátor čtvrti zatím není součástí projektu.

## Moduly

| Modul | Odpovědnost |
|---|---|
| src/world/world-config.js | světová data, uliční profil, budovy, patra, hierarchie |
| src/world/world-validation.js | validace modelů, transformací, ID a metrických úrovní |
| src/world/world-hierarchy.js | povolené vztahy district/street/parcel/building/storey/room |
| src/world/building-architecture.js | měření GLB obálky a fasád, půdorys, zasklení, dveře, desky, schodiště |
| src/main.js | načtení assetů, ulice, domy, vstup, pohyb a přechod ven/dovnitř |
| tests/ | regresní testy metrických dat, fasád, schodů, přístupu a hierarchie |

## Měření modelu

measureBuildingBounds vytváří plnou obálku v lokálním rámci domu po aplikaci transformací potomků. measureStructuralBounds vybírá dominantní konstrukční mesh, aby dekorativní římsa nepřifoukla půdorys.

Fasádní okna vznikají z oddělených trojúhelníkových komponent skleněných meshů. Komponenty stejného okna se slučují pouze při shodné ose, rovině a šířce a při malé svislé mezeře. Materiál dveří se měří zvlášť; z jeho geometrie se získá střed, šířka, výška i výška prahu.

## Metrický plán

Budova ukládá explicitní architecture.floorLevels. Hodnoty jsou relativní k měřenému vstupnímu prahu a jsou přísně rostoucí. Výšky stupňů se počítají z konkrétního rozdílu mezi dvěma sousedními úrovněmi. Počet stoupání na rameno se adaptuje podle cílové výšky 0,16 m, zatímco šířka jádra, délka běhu a mezipodesta zůstávají konstantní.

Plán obsahuje:
- konstrukční vnitřní obálku;
- otvor skutečného vstupu;
- skutečná okna na konkrétních fasádách;
- schodišťové jádro a šířky ramen;
- mezipodestu a otvory stropních desek;
- průchozí hranice a kolizní obdélníky místností.

## Životní cyklus scény

1. Načíst lokální manifest GLB.
2. Validovat světovou konfiguraci a hierarchii.
3. Vytvořit krátký uliční profil, chodníky a obruby.
4. Načíst referenční vnější model.
5. Změřit celkovou i konstrukční obálku.
6. Změřit dveřní a skleněné fasádní prvky.
7. Odvodit podlaží a vygenerovat vnitřní konstrukční geometrii.
8. Zaregistrovat kolize, vstupní kotvu a pěší přístup.
9. Zobrazit startovní obrazovku.

## Rozšiřování

Druhá parcela se přidá pod street-main jako samostatný uzel. Budova dostane svůj vlastní asset, transformaci, měřítko, dveřní metadata a úrovně podlaží. Existující dům se při přidání další parcely nepřepočítává ani nepřemisťuje.

Nová ulice potřebuje skutečnou geometrii vozovky, obrub, přechodů a napojení. Samotný hierarchický uzel nestačí k vytvoření křižovatky. Blok existuje jen tehdy, pokud ho ulice opravdu uzavírají.

## Mimo rozsah

- Rules World, mise, ekonomika a postup;
- vybavení interiérů a dekorace;
- procedurální generování čtvrti;
- doprava, NPC a veřejný mobiliář.

Automatické testy ověřují geometrii a data. Vizuální shoda konkrétního GLB, skel, schodišť a uličního vstupu vyžaduje samostatný průchod ve WebGL.

## Návrhový příčný řez Main Street

Tato sekce zavádí první rozměrový návrh pozemní a vzdušné vrstvy. Hodnoty označené jako **provisional** jsou pracovní parametry pro další geometrickou validaci, nikoli tvrzení o již implementovaném nebo otestovaném provozu.

### Pozemní profil

Stávající ověřovaný profil zůstává základní referencí:

| Prvek | Návrhový rozměr | Stav |
|---|---:|---|
| Vozovka | 6,0 m | zachovat stávající baseline |
| Chodník | 1,6 m na každé straně | zachovat stávající baseline |
| Obruba | 0,20 × 0,14 m | zachovat stávající baseline |
| Pěší přístup k domu | 1,80 m | zachovat stávající baseline |
| Odsazení domu za chodníkem | cca 1,4 m | výchozí hodnota reference |
| Parkování | lokální zálivy cca 2,2 m široké | provisional, pouze ve vybraných úsecích |

Parkování se nesmí řešit souvislým pruhem, který by zúžil vozovku nebo chodník. Má vznikat jako lokální záliv či kapsa na vybraných parcelách, s přerušením u vstupů, rozhledových míst a pěších přechodů. Základní profil proto zůstává čitelný i bez zaparkovaných vozidel.

### Vzdušný profil

Pracovní varianta používá jeden koridor vedený nad podélnou osou Main Street:

| Parametr | Návrhová hodnota | Stav |
|---|---:|---|
| Podélná osa koridoru | osa vozovky | provisional |
| Šířka koridoru | 6,0 m | provisional |
| Směry provozu | dva, výškově oddělené | návrhový princip |
| Střed spodní letové hladiny | +18,0 m od úrovně vozovky | provisional |
| Střed horní letové hladiny | +22,0 m od úrovně vozovky | provisional |
| Předpokládaná výška vozidla | do 2,0 m | pracovní obálka, nutno potvrdit modelem |
| Cílový odstup spodku vozidla od střechy reference | nejméně 3,5 m | předběžný kontrolní cíl |

Dvě výškově oddělené hladiny jsou zvoleny proto, aby se protisměrná doprava nemusela rozdělit do dvou širokých koridorů nad fasádami. Skutečná obálka koridoru se musí počítat z rozměrů konkrétního flycaru, jeho kolizního tvaru, výšky střech a dynamické rezervy při zatáčení či stoupání.

### Ochranné odstupy a uzly

- Letová osa zůstává nad ulicí; koridor se nesmí posouvat nad obytné fasády jen kvůli snadnějšímu generování.
- Žádný běžný průlet nesmí zasahovat do oken, lodžií, balkonů, střech ani interiérů.
- Svislé stoupání a klesání se povolí jen v označených vertikálních uzlech, nikoli kdekoliv podél fasády.
- Přistávací a nástupní plochy budou pouze na vybraných konstrukčně vhodných budovách nebo samostatných dopravních uzlech.
- V okolí vstupů, chodníků a pěších předprostorů se nesmí nacházet nízko vedená letová trasa.
- Každý uzel musí mít vyznačený přístup, čekací plochu, bezpečnou výškovou návaznost a prostor mimo hlavní pěší proud.

### Kontrolní geometrie

Před implementací je nutné ověřit příčný řez v měřítku 1:1: vozovku, obruby, chodníky, odsazení fasád, výšku střech referenčního domu, obálku vozidla a obě letové hladiny. Kontrola musí zahrnout i nejvyšší balkon, římsu nebo anténu, nikoli pouze základní střešní desku.

Návrh se nepovažuje za schválený, dokud:
1. kolizní obálka vozidla neprojde celou délkou koridoru bez kontaktu s budovami;
2. výšková rezerva zůstane zachována i nad nejvyššími prvky střech;
3. vertikální uzly nevedou přes obytné fasády a pěší zóny;
4. pozemní profil zachová souvislý a bezpečný pěší průchod;
5. bude provedena ruční vizuální kontrola ve WebGL.


## Prototyp vzdušného koridoru ve scéně

První vizuální prototyp zobrazuje dvě výškově oddělené vodicí linie a společné boční vodítko koridoru nad osou vozovky. Značky jsou rozmístěny rovnoměrně po celé délce segmentu včetně obou konců. Parametry pocházejí z `WORLD_CONFIG.airLayer`.

**Prototyp není funkční dopravní systém.** Neobsahuje vozidla, fyziku, navigaci, kolizní obálku, vyhýbání ani řízení směru. Výška 18/22 m, šířka 6 m a vodítka jsou pracovní návrhové hodnoty. Před jejich potvrzením je potřeba vytvořit 1:1 řez s reálnou obálkou budovy, střešními prvky a modelem flycaru.


## Habitatový koncept a ochranný prstenec (nové rozhodnutí 2026-11-21)

World design se nově rozvíjí jako umělý space habitat chráněný masivní prstencovou strukturou inspirovanou Starship. Vnitřní prostor má umělou atmosféru; vnější prostor je vesmír. Městský půdorys obsahuje přesně tři definované ulice: dominantní dlouhou Main Street a dvě podřízené vedlejší ulice. Nezakládat další street grid.


Toto je koncepční rozhodnutí, nikoli hotová geometrie. Tvar a měřítko prstence, masterplan tří ulic, atmosférický/light systém a letové koridory čekají na návrh a validaci. Podrobnosti: [DISTRICT-14-SPACE-HABITAT.md](./DISTRICT-14-SPACE-HABITAT.md).
