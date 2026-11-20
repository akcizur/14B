# District 14 — dokumentace

Toto je rozcestník technické, stavební a produkční dokumentace. Aktuální svět se vyvíjí od jedné ověřitelné ulice a jednoho referenčního domu. Dokumentace rozlišuje implementované funkce, návrhová pravidla a dosud neověřené části.

## Začni tady

1. **[Referenční ulice a dům](REFERENCE-HOUSE-AND-STREET.md)**  
   Hlavní stavební specifikace: metrické měřítko, uliční profil, parcela, obálka GLB, podlaží, příčky, schodiště, vstupy, okna, skla, kolize, akceptační testy a postup přidání druhého domu.

2. **[Architektura světa](WORLD-ARCHITECTURE.md)**  
   Rozdělení odpovědností modulů, datový kontrakt, validace a lifecycle tvorby scény.

3. **[Plán postupného růstu](SETTLEMENT-GROWTH.md)**  
   Etapy od jedné ulice a domu k sousední parcele, uliční frontě, bloku a dalšímu veřejnému prostoru.

4. **[Ověření a vydání](VERIFICATION-LOG.md)**  
   Výsledky CI, rozdíl mezi testy, deployem a vizuální kontrolou a checklist pro přijetí domu.

5. **[Historický audit Free Play](FREE-PLAY-SANDBOX-PLAN.md)**  
   Archivní záznam staršího stavu. Nejde o aktuální implementační checklist.

## Kde je pravda

| Téma | Primární zdroj |
|---|---|
| Poloha domu, rozměry ulice, spawn, počet podlaží | src/world/world-config.js |
| Povolené uzly sídelní hierarchie | src/world/world-hierarchy.js |
| Validace konfigurace | src/world/world-validation.js |
| Výpočet měřítka a konstrukční geometrie domu | src/world/building-architecture.js |
| Běh scény, ovládání a přechody | src/main.js |
| Regresní testy stavební geometrie | tests/building-architecture.test.js |
| Regresní testy konfigurace a hierarchie | tests/world-config.test.js |

Při rozporu mezi dokumentem a kódem se nejprve ověří aktuální implementace. Pokud se mění záměr, aktualizují se současně konfigurace, validace, testy a dokumentace.

## Pravidla aktualizace dokumentace

Každá změna světa musí popsat:

- co je implementováno;
- co je pouze návrhové pravidlo;
- jaké rozměry a souřadnice byly změněny;
- jaké testy byly přidány nebo upraveny;
- zda byla provedena vizuální kontrola v prohlížeči;
- jaké známé omezení zůstává.

Zelený build neznamená vizuálně schválenou budovu. Měřítko fasády, vstupní dveře, zasklení, schodiště a návaznost chodníku se musí ověřit také v reálné scéně.

## Rozsah

Aktivní je jediný otevřený Free Play / Sandbox svět. Nábytek a vybavení interiéru, doprava, NPC a dekorativní městské objekty zůstávají mimo startovní stavební etapu. Rules World, mise, skóre a ekonomika se nezačínají vytvářet bez samostatného schválení.
