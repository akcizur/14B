# District 14: referenční ulice a dům

**Stav dokumentace:** odpovídá sloučené architektuře hlavní větve po PR #4  
**Technologie:** Three.js + Vite + lokální GLB  
**Jednotky:** metry  
**Herní režim:** pouze Free Play / Sandbox  
**Priorita:** stavební geometrie a prostorová logika, nikoli vybavení interiérů

Tento dokument je hlavní technickou specifikací pro stavbu světa District 14. V případě rozporu se staršími poznámkami mají přednost aktuální datové definice v **src/world/world-config.js** a tento dokument. Hodnoty označené jako návrhový cíl nejsou tvrzením, že už jsou plně implementované.

## 1. Základní rozhodnutí

District 14 se nestaví jako hotové město, do kterého se postupně sypou modely. Staví se od jedné ověřitelné stavební jednotky směrem ven.

Pořadí je závazné:

1. uliční profil a bezpečný pěší přístup;
2. jedna parcela a jeden referenční dům;
3. skutečné rozměry domu a jeho vnější obálka;
4. podlaží, nosné dělení, schodišťové jádro a průchody;
5. poloha dveří, oken, parapetů, rámů a skla;
6. kontrola měřítka a průchodnosti v prohlížeči;
7. teprve potom první sousední parcela a další dům;
8. další ulice a blok až ve chvíli, kdy uliční fronta dává urbanistický smysl.

**Zatím se nepřidává:** nábytek, kuchyně, spotřebiče, dekorace, stromy, ploty, pouliční mobiliář, NPC ani doprava. Modely pro pozdější fáze zůstávají v asset knihovně, ale nejsou součástí startovní scény.

## 2. Hierarchie světa

### 2.1 Logické členění

Základní strom:

    DISTRICT 14
    └── STREET / hlavní ulice
        └── PARCEL 001 / stavební parcela
            └── HOUSE 001 / referenční dům
                ├── STAIRWELL / společné schodišťové jádro
                ├── GROUND FLOOR
                │   ├── vstupní hala
                │   ├── hlavní místnost
                │   └── servisní místnost
                ├── FIRST FLOOR
                │   ├── chodba
                │   ├── místnost A
                │   └── místnost B
                └── SECOND FLOOR
                    ├── chodba
                    ├── místnost A
                    └── místnost B

Hierarchie je záměrně datová, s trvalými ID. Uzel budovy musí mít odpovídající definici v WORLD_CONFIG.buildings. Počet uzlů podlaží musí odpovídat architecture.storeys.

### 2.2 Pravidla rodičů a potomků

Aktuální validátor src/world/world-hierarchy.js povoluje:

| Uzel | Povolený přímý potomek |
|---|---|
| district | street |
| street | block, parcel |
| block | parcel |
| parcel | building |
| building | storey, stairwell |
| storey | room |
| room | žádný |
| stairwell | žádný |

Blok není povinný při každé ulici. Použije se až tehdy, když více ulic vymezí městský blok. Pro první dům je proto parcela přímým potomkem hlavní ulice.

### 2.3 Pravidla ID

- ID je stabilní a nezávislé na názvu GLB souboru.
- ID se neopakuje v celé hierarchii.
- Nový dům musí mít současně definici entity i hierarchický uzel.
- Přejmenování viditelného názvu nesmí rozbít vazbu na uložená data.
- Nové parcely se přidávají explicitně. Runtime nesmí automaticky posouvat existující dům jen proto, že přibyla další parcela.

## 3. Ulice: referenční uliční profil

Aktuální scéna používá jednu přímou ulici orientovanou podél osy X. Souřadnice Z určuje šířku komunikace a polohu chodníků.

### 3.1 Aktuální rozměry

| Prvek | Aktuální hodnota | Poznámka |
|---|---:|---|
| světový podklad | 60 × 50 m | vizuální plocha, ne hranice celé budoucí čtvrti |
| hratelné hranice | X −28 až +28 m, Z −23 až +23 m | validátor pohybu hráče |
| vozovka | 54 × 9 m | jedna obousměrná komunikace |
| chodník | šířka 54 m, hloubka 2,45 m na každé straně | středy na Z = ±5,9 m |
| obruba | délka 54 m, šířka 0,2 m, výška 0,16 m | středy na Z = ±4,62 m |
| pěší přístup k domu | šířka 1,45 m | krátké propojení vstupu a chodníku |
| vstupní podesta | hloubka 0,8 m | přechod před dveřmi |
| přechod | osa X = 0 | příčné pruhy přes vozovku |

Jde o současné hodnoty konfigurace, nikoli o konečné urbanistické řešení celé čtvrti.

### 3.2 Prostorová logika

- Vozovka je jediný souvislý pás mezi obrubami.
- Chodníky leží mimo vozovku po obou stranách.
- Obruba je hranicí vozovky a pěší plochy.
- Pěší přístup k domu má navazovat na vstupní podestu a nejbližší chodník na stejné straně ulice.
- Přechod musí spojovat protilehlé chodníky, ne končit uprostřed obruby.
- Žádná budoucí příjezdová cesta ani parcela nesmí nechtěně zúžit vozovku nebo chodník.

### 3.3 Další návrhová pravidla pro ulici

Tato pravidla se použijí při rozšiřování, nejsou všechna implementována jako samostatné systémy:

- Zachovat průběžnou pěší trasu bez slepých konců.
- Při přidání parkování oddělit parkovací pruh od průchozí části chodníku.
- Vjezdy na parcely navrhovat jako přerušení obruby, nikoli jako náhodně položené betonové kvádry.
- Křižovatku přidat až s navazující druhou ulicí; nekreslit křížení, které nikam nepokračuje.
- Stromy, lampy, zastávky a další mobiliář umísťovat až po ověření průchozí šířky a výhledu.
- Přechody, nájezdy, podesty a chodníky musí mít stejnou výškovou referenci.
- Spawn hráče umisťovat na pěší plochu nebo bezpečnou vyhrazenou plochu, nikoli do jízdního pruhu.

## 4. Referenční parcela a dům

### 4.1 Současná definice

První stavební reference je:

| Vlastnost | Hodnota |
|---|---|
| ID | house-001 |
| GLB asset | Building Green |
| pozice | [0, 0, -13] |
| cílová normalizovaná výška | 10,1 m |
| rotace Y | 0 |
| strana vstupu | lokální +Z |
| počet podlaží | 3 |
| tloušťka stěny | 0,18 m |
| tloušťka stropní desky | 0,16 m |

Výška 10,1 m je normalizační požadavek pro načtený model. Skutečná šířka a hloubka se nepředepisují odhadem: runtime je změří z geometrie po aplikaci transformací GLB.

### 4.2 Jak se měří vnější obálka

Modul src/world/building-architecture.js:

1. aktualizuje světové matice kořenového modelu a potomků;
2. získá počátek a orientaci kořenového modelu;
3. převede geometrii do lokálního rámce budovy, ale zachová její skutečné měřítko;
4. projde bounding boxy všech meshů;
5. z osmi rohů každého bounding boxu sestaví celkovou obálku;
6. vrátí lokální min/max X, Y a Z.

Tím se odstraní vliv umístění a natočení v mapě, ale zachová se škálování modelu. Interiér proto může být generován v lokálních souřadnicích konkrétního domu.

**Důležité:** bounding box je obálka, ne architektonický půdorys. U členitého modelu může zahrnout římsu, přístavek nebo jiný výstupek. Proto musí následovat vizuální kontrola a případně explicitní metadata půdorysu.

## 5. Konstrukční interiér domu

Interiér je v této etapě pouze stavební geometrie. Není to hotový byt s vybavením.

### 5.1 Rozměry a podlaží

Výchozí pravidla generátoru:

| Parametr | Rozsah / hodnota |
|---|---:|
| tloušťka obvodové stěny | 0,14–0,28 m, standard 0,18 m |
| tloušťka stropní desky | 0,12–0,22 m, standard 0,16 m |
| maximální světlá výška podlaží | 3,2 m |
| minimální přijatelná světlá výška | 2,55 m |
| počet podlaží reference | 3 |

Výška podlaží se počítá z naměřené výšky obálky a zvoleného počtu podlaží:

    floorHeight = min(maxFloorHeight, (buildingHeight - 1.5 × slabThickness) / storeys)

U domu s výškou 10,1 m a třemi podlažími vychází limit 3,2 m na jedno podlaží. Součet tří podlaží je 9,6 m; zbylá výška zůstává jako rezerva pro horní konstrukci a nesmí se bez kontroly vyplnit nahodilou místností.

Vnitřní půdorys se zmenšuje o tloušťku obvodových stěn. Žádná část podlahy, příčky ani schodiště se nesmí rozšířit mimo změřenou obálku.

### 5.2 Podlahy a stropy

- Přízemí má souvislou podlahovou desku.
- Vyšší podlaží mají desky s otvorem pro schodišťové jádro.
- Otvor musí být větší než průchozí šířka ramen a musí obsahovat prostor pro mezipodestu.
- Horní deska a střešní deska nesmí proniknout do vnější horní hrany GLB obálky.
- Podlahy se generují pro každé podlaží samostatně, aby bylo možné kontrolovat výšku i průchodnost.

### 5.3 Schodiště

Aktuální generátor používá dvouramenné schodiště s opačným směrem ramen a mezipodestou:

- dvě průchozí ramena;
- šířka jednoho ramene 0,72–0,88 m;
- mezera mezi rameny přibližně 0,12 m;
- devět stupňových modulů na jedno rameno;
- běh ramene nejvýše 2,35 m, případně zkrácený podle hloubky interiéru;
- mezipodesta propojuje obě ramena;
- otvor ve vyšším stropě odpovídá prostoru schodiště.

Při generování se ověřuje, zda se schodiště, chodba a minimální průchozí prostor vůbec vejdou do vnitřní šířky. Pokud ne, generování má skončit chybou, ne vytvořit nepoužitelný půdorys.

### 5.4 Pohyb po schodech

Aktuální runtime odvozuje výšku hráče z jeho lokální polohy na rameni a interpoluje ji mezi podlažími. Otvor v horních deskách nepovolí volný pohyb přes prázdný prostor schodiště.

To je funkční základ pro vertikální pohyb, nikoli plnohodnotný fyzikální systém: zatím není implementována gravitace, skok, fyzický kontakt chodidel s jednotlivými stupni ani simulace pádu. To musí být výslovně ověřeno v herní scéně.

### 5.5 Dispozice

Přízemí musí mít čitelný vstupní prostor, společné schodiště a navazující obytné/servisní části. Vyšší podlaží mají přístup z chodby a místnosti s dveřními otvory.

Aktuální generátor vytváří základní koridor a jednoduché příčky. Názvy místností v hierarchii popisují zamýšlenou dispozici; samy o sobě ještě nejsou detailním stavebním výkresem každé příčky.

Při další iteraci se mají nejprve kontrolovat:
- šířka chodby;
- průchod od vstupu ke schodišti;
- přístup na každé podlaží;
- dveřní otvory a jejich vzájemné kolize;
- prostor pod schodištěm;
- návaznost otvoru ve stropě na horní mezipodestu;
- světelný a okenní kontakt místností s fasádou.

Nábytek se nepřidává, dokud tato geometrie nefunguje.

## 6. Okna, dveře a skla

### 6.1 Okna odvozená z fasády

Generátor se pokouší identifikovat okna a sklo přímo v GLB podle názvů meshů, rodičovských uzlů nebo materiálů obsahujících výrazy:

window, glass, glazing, fenster

Rozpoznané části se převedou do lokálních souřadnic budovy. Strana fasády se určuje podle nejbližší obvodové roviny. Části jednoho fyzického otvoru se slučují podle blízkosti jejich středů, aby rám a sklo nevytvořily několik duplicitních oken.

Otvor se použije pouze tehdy, pokud rozměry a výška odpovídají danému podlaží. Pokud model neobsahuje rozpoznatelné názvy, použije se zatím pravidelný výchozí rytmus oken.

### 6.2 Zasklení

- Sklo je samostatná plocha uvnitř otvoru.
- Rám se skládá z bočních, horních a spodních částí a příčky.
- Skleněná plocha nepřebírá kolizi stěny.
- Materiál má omezenou neprůhlednost, aby bylo možné číst vnitřní prostor.
- Okno musí být ve stejné poloze a přibližně stejném rozměru jako otvor ve vnější fasádě.

### 6.3 Dveře a vstup

Vstupní strana se určuje pomocí frontSide v lokálním rámci domu. Pozice vstupu je odvozena od měřené obálky a otočena do světových souřadnic. Interakce je dostupná z vnější přístupové strany.

Současný přechod do interiéru je herní přepnutí: vnější GLB model se skryje, vnitřní geometrie se zobrazí a hráč se přemístí do vstupního bodu interiéru. Nejde zatím o fyzicky otevřené dveře, kterými hráč projde bez přechodu scény.

**Nutná ruční kontrola:** vypočítaný vstup musí přesně sedět na skutečných vstupních dveřích modelu. Pokud GLB neobsahuje čitelný dveřní uzel nebo metadata, musí se pro konkrétní dům doplnit explicitní lokální souřadnice dveří. Bounding box sám nezná skutečnou polohu dveří.

## 7. Návaznost domu na ulici

Pro referenční dům platí:

- dům je na záporné straně osy Z;
- lokální přední strana je +Z;
- vstup směřuje do ulice;
- krátká podesta navazuje na přístupovou cestu;
- přístupová cesta končí u chodníku na stejné straně ulice;
- uliční profil zůstává volný pro pěší a budoucí dopravu.

Vnější kolizní stopa domu musí blokovat průchod skrz jeho obálku. Interakce se nesmí vyvolat ze zadní nebo boční strany domu.

Při rozšiřování se musí každý dům kontrolovat jako celek: parcela, odstup od chodníku, vstup, přístupová cesta, fasáda, vnitřní půdorys a kolize.

## 8. Jak přidat druhý dům

Druhý dům se nepřidává kopírováním celé první scény. Přidává se jako nová samostatná parcela:

1. Vymezit parcelu vedle existujícího domu.
2. Určit uliční čáru a odstup budovy od chodníku.
3. Změřit nový GLB model po normalizaci.
4. Zkontrolovat, že má dostatečnou šířku, hloubku a výšku pro požadovaný typ dispozice.
5. Nastavit vlastní frontSide, natočení a počet podlaží.
6. Doplnit stabilní ID do WORLD_CONFIG.buildings.
7. Přidat stejný identifikátor jako uzel typu building pod nový uzel parcel.
8. Doplnit odpovídající uzly podlaží, místností a schodiště.
9. Ověřit chodník, vstupní cestu a kolize obou parcel.
10. Spustit testy a vizuálně projít oba domy.

Příklad entity (hodnoty polohy a natočení jsou ilustrativní, ne doporučené souřadnice pro hotové umístění):

    {
      id: 'house-002',
      asset: 'Building Red',
      position: [12, 0, -13],
      height: 10.1,
      rotationY: 0,
      role: 'house',
      frontSide: 1,
      architecture: {
        storeys: 3,
        wallThickness: 0.18,
        slabThickness: 0.16
      },
      collision: {
        type: 'bounds',
        scaleX: 0.88,
        scaleZ: 0.82,
        minWidth: 4,
        minDepth: 3.3
      }
    }

Příklad hierarchie se musí doplnit stejným ID. Samotná entita bez uzlu parcely a budovy nepatří do cílové architektury.

## 9. Kdy přidat další ulici a blok

Druhá ulice není další dekorativní pás asfaltu. Přidá se až tehdy, když:
- hlavní ulice má alespoň dvě ověřené parcely;
- je známá šířka obou chodníků a poloha vjezdů;
- nová ulice má definovaný začátek, konec a napojení;
- křižovatka má souvislou vozovku, obruby, přechody a pěší trasy;
- nové parcely nezakrývají vjezdy a neblokují existující vstupy;
- stavební blok je skutečně vymezen ulicemi, ne jen skupinou náhodně rozmístěných budov.

Hierarchie už umí popsat block, ale runtime je zatím pouze jedna parametrická přímá ulice. Více ulic, křižovatky, pozemkové hranice a síť komunikací jsou budoucí rozšíření.

## 10. Testování a akceptační podmínky

### Automatické testy

Testovací sada aktuálního PR #4 ověřila 42 testů, všechny prošly. Pokrývá:
- validitu konfigurace a asset manifestu;
- unikátní ID a hierarchii osídlení;
- měření modelu při rotaci a změně měřítka;
- výpočet podlaží a konstrukčních rozměrů;
- geometrii schodiště a výšku pohybu;
- průchodnost horním otvorem schodiště;
- detekci pojmenovaných oken a skla na fasádách;
- regresní kontroly základního světa.

CI dále dokončilo produkční build a upload GitHub Pages artefaktu.

### Ruční vizuální kontrola, která stále zbývá

Automatický test není důkaz, že konkrétní Building Green v reálném prohlížeči přesně sedí na vytvořený vnitřní půdorys. Je potřeba projít:
- z ulice k domu a ke vstupu;
- z vnější fasády dovnitř;
- všechna tři podlaží;
- obě ramena a mezipodesty;
- každý okenní otvor zevnitř i zvenčí;
- průhlednost skla a překryvy rámů;
- kolize u rohů, příček a dveří;
- návrat z interiéru ven.

Do provedení tohoto průchodu je stav označen jako **automaticky ověřený, vizuálně neuzavřený**.

### Akceptační kritéria

- [ ] Měřítko interiéru odpovídá skutečné obálce GLB.
- [ ] Žádná stěna, podlaha ani strop nepřesahuje vnější obálku.
- [ ] Každé podlaží má použitelnou světlou výšku.
- [ ] Schody, mezipodesta a stropní otvor tvoří souvislou průchozí trasu.
- [ ] Hráč nemůže propadnout schodišťovým otvorem.
- [ ] Vstupní dveře odpovídají skutečnému místu na fasádě.
- [ ] Okna a zasklení sedí na vnějších fasádních otvorech.
- [ ] Přístupová cesta plynule navazuje na chodník.
- [ ] Chodník a přechod zůstávají průchozí.
- [ ] Teprve po splnění bodů se přidá další parcela.

## 11. Současné technické hranice

Aby dokumentace nepředstírala hotové funkce, platí tato rozlišení:

| Oblast | Stav |
|---|---|
| jedna ulice a jeden dům v konfiguraci | implementováno |
| datová hierarchie District → Street → Parcel → Building → Storey → Room | implementováno a validováno |
| měření obálky GLB | implementováno a testováno na testovacích geometriích |
| automatická detekce pojmenovaného skla/oken | implementováno; konkrétní asset vyžaduje vizuální potvrzení |
| generování podlah, stěn, příček a otvorů | implementováno |
| třípodlažní schodišťová geometrie | implementováno |
| výškový přechod hráče po schodišti | základní interpolace implementována |
| fyzikální gravitace a skok | neimplementováno |
| dveře s reálným otevíráním a plynulým průchodem | neimplementováno; přechod je interakční přepnutí |
| plnohodnotný editor parcel a půdorysů | neimplementováno |
| druhá ulice a křižovatky | neimplementováno |
| vybavení interiéru | záměrně odloženo |
| vizuální browser průchod referenčním domem | čeká na ruční ověření |

## 12. Soubory a odpovědnosti

| Soubor | Odpovědnost |
|---|---|
| src/world/world-config.js | rozměry ulice, dům, jeho pozice a hierarchie |
| src/world/world-validation.js | validace entit, modelů, polohy a konstrukčních definic |
| src/world/world-hierarchy.js | validace uzlů, rodičů, unikátních ID a počtu podlaží |
| src/world/building-architecture.js | měření GLB, odvození půdorysu, stěny, desky, schody, okna a skla |
| src/main.js | načtení scény, napojení domu na ulici, přechody a řízení hráče |
| tests/building-architecture.test.js | geometrie budovy, schody a detekce oken |
| tests/world-config.test.js | světová konfigurace a hierarchie |
| docs/SETTLEMENT-GROWTH.md | etapy růstu od domu k bloku a čtvrti |
| docs/WORLD-ARCHITECTURE.md | systémová architektura a dlouhodobé hranice modulů |

## 13. Rozsah hry

V tomto projektu zůstává aktivní pouze jeden otevřený svět Free Play / Sandbox. Dokumentace a hierarchie připravují rozšiřitelnost města; nepřidávají mise, pravidla, ekonomiku, skóre ani druhý herní režim.
