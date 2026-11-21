## Následná kontrola schodiště (PR #8)

Při code review main bylo nalezeno neotestované chování: test výšky schodiště používal uniformní podlaží a neodhalil chybný přechod na horním rameni u neuniformních pater. Oprava nyní vybírá schodišťový segment podle výšky hráče a jeho skutečných výškových intervalů.

Nový regresní test používá referenční hodnoty `[0, 3.30, 5.77, 8.28, 11.95]` a kontroluje návaznost horního ramene při výstupu, průběžný bod i cílovou podlahu pro všechny tři spoje. CI této opravy je úspěšné: [run #63](https://github.com/akcizur/14B/actions/runs/44845630596) potvrzuje **49 testů, 49 úspěšných, 0 selhání**, produkční Vite build i Pages artefakt. Vizuální schválení v prohlížeči stále není provedeno.

# District 14: ověření a vydání

## Referenční dům a první obytná ulice

**PR:** [#7](https://github.com/akcizur/14B/pull/7)  
**Ověřovaný commit:** `74d14d7ec8de314105bc8c4d1387c8c2f39306c5`  
**Workflow:** [44843761197](https://github.com/akcizur/14B/actions/runs/44843761197)

| Kontrola | Výsledek | Poznámka |
|---|---|---|
| Node.js regresní testy | **48 prošlo, 0 selhalo** | GLB materiálové skupiny, fasáda, dveře, okna, podlaží, adaptivní schodiště, chodník a hierarchie |
| Produkční Vite build | **úspěšný** | Vite 6.4.5, build vytvořen |
| GitHub Pages artefakt | **úspěšný** | artefakt `github-pages` vytvořen |
| Deploy z pull requestu | přeskočen | očekávané chování; deploy probíhá po sloučení do main |
| Vizuální kontrola v prohlížeči | **nepotvrzena** | automatický prohlížeč odmítl lokální stránku systémovým blokováním; interiér proto není ručně vizuálně schválen |

Úspěšný CI běh potvrzuje regresní testy a produkční kompilaci. **Neznamená vizuální schválení** konkrétní fasády, schodišť, skel nebo proporcí místností.

### Kontroly zahrnuté v testech

- GLB je jeden mesh se sedmi materiálovými primitivy; konstrukční těleso, sklo a dveře jsou měřeny odděleně.
- Materiálové skupiny se čtou přes indexové rozsahy geometrie, ne přes bounding box celého meshe.
- Dveřní otvor se odvozuje z geometrie materiálu `door_white`.
- Okna se odvozují z geometrie `window_glass`; oddělené plochy stejného otvoru lze sloučit.
- Podlaží používají explicitní neuniformní výšky od prahu.
- Schodišťový plán kontroluje dvě ramena, mezipodestu a otvor horní desky.
- Ulice smí záměrně vynechat středové značení i přechod, pokud neexistuje odpovídající křižovatka.
- Hráčův spawn je na chodníku na stejné straně vozovky jako referenční dům.

## Předchozí vydání

### Původní architektura světa

PR #4 přidal první datově řízený model světa, entity se stabilními ID a validační vrstvu. Jeho workflow run: [44836941858](https://github.com/akcizur/14B/actions/runs/44836941858).

### Dokumentace a spawn

PR #5 doplnil první stavební dokumentaci, plán řízeného růstu a přesun spawnu z vozovky na chodník. Původní kontrola měla 42 průchozích testů. Workflow: [44839070862](https://github.com/akcizur/14B/actions/runs/44839070862).

## Lokální příkazy

Po stažení aktuální větve:

```bash
npm install
npm test
npm run build
npm run preview
```

- `npm test` spouští Node.js test runner.
- `npm run build` vytváří produkční složku `dist`.
- `npm run preview` zpřístupní produkční build pro ruční vizuální kontrolu.

## Vizuální akceptační checklist

Před označením domu jako vizuálně schváleného proveď ruční průchod v běžném WebGL prohlížeči:

- [ ] Vnější šířka, výška a hloubka odpovídají skutečnému GLB.
- [ ] Vnitřní stěny leží uvnitř konstrukční obálky a nezasahují do fasádních otvorů.
- [ ] Vstupní otvor sedí na dveřním mesh a práh navazuje na venkovní schody.
- [ ] Cesta od chodníku ke dveřím je souvislá a bez propadů.
- [ ] Každá místnost má věrohodnou průchozí šířku a návaznost na společné schodiště.
- [ ] U-stupně, mezipodesta a horní otvory se prostorově potkávají.
- [ ] Hráč projde všemi čtyřmi podlažími bez teleportu, propadnutí nebo kolize s deskou.
- [ ] Okna jsou zevnitř ve stejné poloze jako skla exteriéru.
- [ ] Skla jsou průhledná; rámy, parapety a nadpraží nepřekrývají průhled.
- [ ] Pohled zvenčí neukazuje vymyšlené otvory nebo nesoulad s původním GLB.
- [ ] Ulice, obruby, chodníky a vstupní cesta tvoří jediný souvislý pěší prostor.

## Pravidlo pro označování stavu

- **Testováno automaticky:** regresní testy a build prošly.
- **Nasazeno:** existuje úspěšný deploy workflow na main.
- **Vizuálně ověřeno:** konkrétní model a průchod byly ručně zkontrolovány v reálném WebGL prohlížeči.

Tyto tři stavy se nesmějí zaměňovat.
