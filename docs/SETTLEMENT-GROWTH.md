# District 14: řízený růst z jednoho domu

**Aktuální cíl:** jedna stavební reference a krátká obytná ulice  
**Základní princip:** nejprve přesný dům, potom jeho nejbližší okolí, teprve potom hierarchie ulic a bloků  
**Režim:** pouze Free Play / Sandbox

## Zásady

1. Svět nezačíná rozptylem objektů, ale jednou ověřenou stavební jednotkou.
2. Ulice se navrhuje spolu s parcelou a vstupem, ne jako samostatná textura pod budovami.
3. Interiér vzniká z naměřené vnější geometrie, nikoli z univerzálního obdélníku.
4. Vybavení interiéru zůstává vypnuté, dokud neprojde konstrukční geometrie.
5. Každá etapa má vlastní kontrolní bránu. Nesmí se přidávat několik nových systémů najednou.

## Hierarchie světa

**District → Street → Block → Parcel → Building → Storey → Room**

Schodišťové jádro je společná část budovy a připojuje se přímo k Building. Block se vytvoří až ve chvíli, kdy jej skutečně vymezují dvě nebo více propojených ulic. Nevkládá se jen proto, aby strom dat vypadal úplně.

## Současná startovní scéna

- jeden uliční úsek;
- vozovka 6,0 m;
- chodníky 1,6 m na obou stranách;
- obruby 0,20 × 0,14 m;
- jedna parcela a jeden dům Building Green;
- jeden měřený hlavní vstup a přístupová cesta;
- čtyři konstrukční podlaží, schodišťové jádro a dvě místnosti na každém podlaží;
- žádná doprava, NPC, stromy, mobiliář ani vybavení interiéru.

Žádný přechod ani odbočení se nekreslí bez skutečného napojení další ulice.

## Etapy

### 0. Přijmout referenční dům a uliční profil

Ověřit měřítko GLB, fasádu, dveře, okna, sklo, výškové úrovně, chodník, obruby, schody a pěší přístup.

**Brána:** vnější a vnitřní konstrukce sedí ve stejné metrické soustavě; hráč projde od chodníku dveřmi do všech podlaží a zpět.

### 1. Zpřesnit okolí referenční parcely

Doplnit jen nezbytné stavební okraje parcely: hranici veřejného chodníku, předprostor domu, přístupovou trasu a případně zadní obslužný průchod, pokud ho doloží model nebo zadání. Zatím bez plotů, zahradních dekorací a nábytku.

**Brána:** parcela je čitelná v půdorysu i při pohledu z ulice a nemá slepé kolizní kapsy.

### 2. Přidat druhou parcelu na téže ulici

Druhá parcela se umístí podél stejného uličního profilu. Každý dům má vlastní GLB měření, vlastní vstupní kotvu, počet podlaží a půdorys. První dům se při tom nesmí přemístit ani změnit měřítko.

**Brána:** dva domy tvoří uvěřitelnou uliční frontu a jejich vstupy nenarušují chodník.

### 3. Dokončit uliční frontu a blok

Až po přijetí nejméně dvou parcel určit stavební čáru, odstupy, případné vjezdy, zadní hranice a průchody. Blok vznikne až z reálného propojení ulic.

**Brána:** pěší síť je souvislá a dává smysl i bez dekorací.

### 4. Přidat další typ domu

Vybrat jiný GLB a samostatně změřit jeho konstrukční těleso. Nepřebírat půdorys Building Green. Každý model musí projít stejnou kontrolou měřítka, vstupu, podlaží, schodiště a oken.

### 5. Teprve potom vybavit a oživit svět

Nábytek, kuchyně, koupelny, svítidla, stromy, lavičky, auta a chodci se vrátí až po stavebním schválení. Jejich kolize nesmějí ubírat předepsanou průchozí šířku.

## Zakázané zkratky

- náhodně rozmístit domy bez parcel a uliční čáry;
- kopírovat stejný interiér na různé GLB modely;
- vytvářet falešná okna na fasádách bez geometrie skla;
- přidat přechod, křižovatku nebo středovou čáru bez návazné dopravy;
- přidávat nábytek, aby zakryl chybnou dispozici;
- považovat úspěšný build za vizuální schválení;
- rozšiřovat svět před přijetím první reference.

## Stav

| Oblast | Stav |
|---|---|
| Jeden referenční dům | implementován jako první metrická reference |
| Čtení skutečné dveřní geometrie | implementováno |
| Čtení oddělených skleněných ploch | implementováno |
| Čtyři neuniformní podlaží | implementováno v konfiguraci |
| Schodišťové jádro a horní otvory | implementováno |
| Uliční profil bez falešné křižovatky | implementováno |
| Druhá parcela | záměrně odložena |
| Další ulice a blok | záměrně odloženo |
| Vybavení interiérů | záměrně odloženo |
| Doprava, NPC a mobiliář | záměrně odloženo |

Každá etapa před dalším růstem vyžaduje: aktualizovaná data, validační testy, produkční build, ruční vizuální kontrolu a dokumentovaný rozdíl mezi hotovým a plánovaným.