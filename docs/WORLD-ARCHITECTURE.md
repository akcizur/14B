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