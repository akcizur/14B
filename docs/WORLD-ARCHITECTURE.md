# District 14: architektura světa

**Aktuální referenční rozsah:** jedna hlavní ulice, jedna parcela, jeden dům  
**Runtime:** Three.js + Vite  
**Autorovací jednotka:** metr  
**Aktivní režim:** Free Play / Sandbox

Tento soubor popisuje odpovědnosti modulů a pravidla architektury. Detailní stavební rozměry, geometrie, ulice, schodiště, okna, skla, vstupy a akceptační podmínky jsou vedeny v [Referenční ulici a domě](REFERENCE-HOUSE-AND-STREET.md).

## Základní zásady

1. **Vnější model určuje měřítko.** Interiér se nesmí kreslit od oka. Šířka, hloubka a výška vznikají z naměřené geometrie GLB po aplikaci transformací.
2. **Ulice a dům jsou jeden prostorový celek.** Vstup, podesta, přístupová cesta, chodník a parcela sdílejí metrické souřadnice.
3. **Nejdříve konstrukce, potom vybavení.** Podlahy, stěny, příčky, schody, dveřní otvory, okna a zasklení mají přednost před nábytkem a dekoracemi.
4. **Obsah je hierarchický.** District → Street → Block (pokud ho vymezují ulice) → Parcel → Building → Storey → Room. Schodišťové jádro je společná součást budovy.
5. **Každý obsahový prvek má stabilní ID.** Entita nesmí existovat jen jako volně vložený mesh bez datového záznamu.
6. **Validace před vytvořením scény.** Chybějící model, duplicitní ID, neplatná poloha nebo nesoulad hierarchie musí selhat před spawnováním světa.
7. **Růst ručně a kontrolovaně.** Druhá parcela a další ulice se přidají až po ověření reference. Procedurální generátor města zatím není cílem.

## Současný systém a odpovědnosti

| Modul | Odpovědnost |
|---|---|
| src/world/world-config.js | hlavní uliční profil, domy, umístění, parametry architektury a hierarchie |
| src/world/world-validation.js | validační pravidla entit, transformací, modelů a stavebních parametrů |
| src/world/world-hierarchy.js | typy uzlů, povolené vztahy rodič/potomek, unikátní ID a návaznost domů |
| src/world/building-architecture.js | měření obálky GLB, rozpoznání oken, dispozice, konstrukční desky, stěny, schody a skla |
| src/main.js | načtení manifestu, vytvoření ulice a domů, kolize, ovládání a přechod ven/dovnitř |
| tests/ | regresní testy konfigurace, hierarchie, geometrie, schodů, oken, modelů a kolizí |

## Datový kontrakt budovy

Každá stavba musí mít:
- unikátní ID;
- klíč assetu existující v lokálním manifestu;
- polohu v metrech;
- cílovou normalizovanou výšku;
- natočení;
- roli building/house;
- orientaci přední fasády;
- počet podlaží a konstrukční parametry;
- explicitní kolizní profil;
- odpovídající uzel v settlement hierarchii.

Rozměry vnitřního půdorysu se odvozují z reálné geometrie. Pokud dům nemá dostatečný prostor pro schodiště a průchozí chodbu, generátor má stavbu odmítnout, ne rozšiřovat interiér za fasádu.

## Lifecycle scény

1. Načíst lokální manifest.
2. Ověřit světovou konfiguraci a hierarchii.
3. Vytvořit základní uliční geometrii.
4. Načíst vnější shell referenčního domu.
5. Změřit jeho rozměry v lokálním rámci.
6. Vygenerovat vnitřní konstrukční geometrii a návazné vstupní body.
7. Zaregistrovat kolize a interakci.
8. Teprve poté zobrazit startovní obrazovku.

## Rozšíření bez přepisování světa

Nová parcela přidá vlastní budovu a hierarchický uzel. Existující dům se nesmí automaticky přemísťovat. Nová ulice vyžaduje samostatnou geometrii komunikace, chodníky, obruby, napojení a validaci křižovatky; pouhé přidání uzlu street do stromu ji nevytvoří.

Dlouhodobě lze oddělit:
- street network a křižovatky;
- parcel footprinty a stavební čáry;
- building shells a interior plans;
- společné prostory a bytové jednotky;
- prostorový index a načítání zón;
- vizualizační/debug vrstvu pro měřítko, kolize, ID a dveřní kotvy.

Tyto systémy jsou návrhové hranice pro budoucnost, nikoli tvrzení, že už jsou implementované.

## Ověření

Poslední kontrola PR #4: 42/42 automatických testů prošlo, produkční build i upload artefaktu uspěly. Deploy job byl u pull requestu přeskočen podle workflow pravidel.

Automatické testy neprokazují vizuální shodu konkrétního GLB domu s vygenerovaným interiérem. Ruční kontrola vstupních dveří, oken, schodů a napojení na chodník zůstává nutná. Stav a akceptační seznam jsou průběžně vedené v [referenční specifikaci](REFERENCE-HOUSE-AND-STREET.md).

## Mimo aktuální rozsah

- Žádný Rules World.
- Žádné mise, questy, skóre, ekonomika ani postup.
- Žádný multiplayer.
- Žádné vybavení interiéru v referenční fázi.
- Žádný procedurální generátor čtvrti před ověřením ručně vytvořených parcel.
