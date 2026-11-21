# District 14: architektura světa

**Engine:** Three.js + Vite  
**Jednotka:** metr  
**Autorovací rozsah:** jedna ulice, jedna parcela, jeden referenční dům  
**Režim:** Free Play / Sandbox

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

Budova ukládá explicitní architecture.floorLevels. Hodnoty jsou relativní k měřenému vstupnímu prahu a jsou přísně rostoucí. Výšky stupňů se počítají z konkrétního rozdílu mezi dvěma sousedními úrovněmi.

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