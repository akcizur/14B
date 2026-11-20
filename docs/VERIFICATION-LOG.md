# District 14: ověření a vydání

## Stav aktuální implementace

| Kontrola | Výsledek | Význam |
|---|---|---|
| Automatické testy PR #4 | 42 prošlo, 0 selhalo | testy konfigurace, hierarchie, GLB měření, oken, schodů a kolizí |
| Produkční Vite build PR #4 | úspěšný | projekt se zkompiloval do produkční podoby |
| Upload Pages artefaktu PR #4 | úspěšný | sestavený webový artefakt byl připraven |
| Deploy job při PR #4 | přeskočen | workflow nenasazuje pull request; nasazuje se až po push/merge do main |
| Vizuální průchod GLB domu | neproveden | skutečná shoda vstupu, fasády, oken a skel ještě není ručně potvrzena |

PR #4 sloučil referenční svět do main commitem 02cb1b9eefb188fdacba4b9794de9739b06fd71e. Úspěšný workflow run pro implementaci: [run 44836941858](https://github.com/akcizur/14B/actions/runs/44836941858).

## Dokumentační a spawn aktualizace

PR #5 doplňuje stavební příručku, index dokumentace a plán růstu. Součástí je přesun spawnu z vozovky na kladný chodník: Z = 6,15 m. Regresní test kontroluje, že spawn leží uvnitř chodníku a mimo šířku vozovky.

Vlastní CI pro PR #5 se musí vyhodnotit podle nejnovějšího workflow runu na jeho HEAD SHA. Výsledek staršího PR #4 se nesmí vydávat za výsledek PR #5.

## Lokální ověření

Po stažení aktuální větve:

    npm install
    npm test
    npm run build
    npm run preview

- npm test spouští Node.js test runner.
- npm run build vytváří produkční složku dist.
- npm run preview zpřístupní vytvořenou produkční verzi pro ruční vizuální kontrolu.

## Vizuální checklist

Automatický test nemůže nahradit kontrolu geometrie v reálném WebGL prohlížeči. Před označením domu jako přijatého ověř:

- spawn na chodníku a bezpečné přejití přes přechod;
- přístupová cesta od chodníku k podestě a vstupu;
- poloha dveří vůči skutečné fasádě GLB;
- přechod z vnějšího modelu do interiéru a zpět;
- měřítko každé místnosti vůči vnější obálce;
- tři podlaží a jejich světlé výšky;
- schody, mezipodesta a horní otvor;
- všechna okna zevnitř i zvenčí;
- průhlednost skel, rámy a případné překryvy;
- průchodnost bez propadání nebo procházení stěnami.

## Pravidlo pro označování stavu

- **Testováno automaticky:** Node testy a produkční build prošly.
- **Nasazeno:** existuje úspěšný deploy workflow na main.
- **Vizuálně ověřeno:** byl proveden skutečný prohlížečový/WebGL průchod relevantními místy.

Tyto tři stavy se nesmějí zaměňovat.
