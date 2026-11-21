# District 14: referenční dům a obytná ulice

**Stav:** nově přestavěná referenční etapa  
**Jednotky:** metry  
**Režim:** Free Play / Sandbox  
**Rozsah:** jeden dům, jedna parcela, jeden uliční profil  
**Vybavení:** záměrně žádné

Tento dokument je konstrukční specifikace aktuálního prvního výřezu světa. Rozměry se odvozují z lokálního GLB modelu **building-green.glb**. Nejde o dekorativní generátor místností ani o univerzální půdorys pro všechny budovy.

## 1. Co se měnilo a proč

Předchozí interiér používal jeden společný bounding box budovy a z něj odvozoval čtyři falešná okna, umístění vstupu a půdorys. To neodpovídalo skutečné fasádě. Model má vlastní oddělené mesh části pro cihlové těleso, rámy, sklo, dveře, sokl a horní římsy. Nová verze je čte zvlášť.

Nová pravidla:

- dominantní cihlový mesh určuje stavební obálku a vnitřní rozměry;
- dveře se měří z mesh materiálu **door_white**;
- okna se měří z oddělených skleněných ploch **window_glass**;
- oddělené trojúhelníkové plochy jednoho okna se slučují podle skutečné polohy, šířky a mezery;
- malé tabulky, které překrývají dveřní křídlo, se nepovažují za samostatná fasádní okna;
- okno se nesmí vyrobit, pokud není ve fasádě naměřený otvor;
- střešní římsa a dekorativní přesahy nesmějí zvětšit půdorys interiéru.

## 2. Referenční model

| Vlastnost | Naměřená hodnota před runtime normalizací |
|---|---:|
| Celková šířka GLB | 2,416 m |
| Celková výška GLB | 3,475 m |
| Celková hloubka GLB | 1,340 m |
| Materiál hlavního tělesa | brick_shadeGreen |
| Materiál skla | window_glass |
| Materiál vstupních dveří | door_white |

Runtime normalizuje model na výšku 13,4 m. Měřítkový faktor je přibližně 3,856. Výsledná vnější obálka je přibližně **9,32 × 13,40 × 5,17 m** (šířka × výška × hloubka). Strukturální cihlové těleso je užší než celková obálka dekorativních částí a používá se pro vnitřní stěny.

| Konstrukční prvek | Přibližný rozměr po normalizaci |
|---|---:|
| Hlavní dvojité vstupní dveře | 2,92 × 2,86 m |
| Jedno přízemní okno | 2,08 × 2,84 m |
| Jedno horní okno | 0,76 × 1,59 m |
| Horní okna | 4 v každém ze 3 řádků |
| Přízemní okna | 2 |

Rozměry jsou měřeny z geometrie a transformací GLB, ne odhadnuty z textury nebo screenshotu.

## 3. Podlaží a konstrukční datum

Nultá výšková úroveň interiéru odpovídá skutečnému spodnímu okraji vstupních dveří. Dům má zvýšený sokl; interiérová podlaha se proto nesmí položit automaticky na nejnižší bod libovolného mesh modelu.

World config obsahuje výšky podlaží v metrech od prahu:

| Úroveň | Výška od prahu | Výška podlaží |
|---|---:|---:|
| Přízemí | 0,00 m | 3,30 m |
| 1. patro | 3,30 m | 2,47 m |
| 2. patro | 5,77 m | 2,51 m |
| 3. patro | 8,28 m | 3,67 m |
| Horní deska | 11,95 m | — |

Neuniformní výšky odpovídají řádkům oken na fasádě a horní konstrukci. Poslední podlaží je vyšší, protože horní řada oken a střešní část modelu ponechávají více prostoru nad posledním parapetem. Výška stropu se nesmí potichu zkrátit jen kvůli uniformnímu generátoru.

Tloušťka obvodové stěny je 0,18 m; stropní deska 0,16 m. Parametry jsou v metrech a patří k tomuto modelu, nikoli automaticky ke všem budoucím domům.

## 4. Dispozice a schodiště

Půdorys se odvozuje z vnitřní strany strukturálního cihlového tělesa po odečtení tloušťky obvodových stěn. Centrální schodišťové jádro navazuje na skutečnou polohu hlavního vstupu.

- dvě paralelní ramena do tvaru U;
- světlá šířka ramene 0,98 m;
- mezera mezi rameny 0,12 m;
- cílová výška jednoho stoupání je 0,16 m; výsledná výška se dopočítá na přesné dělení konkrétního podlaží;
- počet stoupání se mění podle skutečné výšky podlaží, šířka jádra a délka ramene zůstávají stejné;
- jedno rameno má 2,60 m běhu, nástupní prostor 0,70 m a mezipodesta 0,65 m;
- první tři spojení podlaží mají 10 / 8 / 8 stoupání na rameno; výška stoupání vychází přibližně 16,5 / 15,4 / 15,7 cm a hloubka nášlapu 26 / 32,5 / 32,5 cm;
- mezipodesta je součástí schodišťového otvoru;
- otvor v horních deskách kopíruje jádro a mezipodestu;
- po stranách schodiště jsou dvě průchozí místnosti, přístupné z podesty přes stavební dveřní otvory.

Výška stoupání se počítá samostatně pro každé podlaží z jeho skutečné výšky. Nepoužívá se jeden konstantní počet stupňů pro celý dům. Kontroluje se také vztah 2 × výška stoupání + hloubka nášlapu v komfortním rozmezí 0,56 až 0,65 m.

Pohyb hráče používá stejný plán jako vykreslená geometrie. V otvoru horní desky je průchozí pouze rameno nebo mezipodesta; prázdný prostor mezi rameny není podlaha.

## 5. Fasáda, okna, skla a dveře

### Okna

Každá fyzická tabule se vyčte z oddělených skleněných trojúhelníků. Dvě navazující tabule nad sebou se sloučí do jediného otvoru, pokud mají stejnou osu, stejnou šířku a malou svislou spáru. Tím vznikne jeden konzistentní otvor s rámem, parapetem a nadpražím.

Otvor se řeže do vnitřní stěny ve stejné souřadnici jako sklo ve vnějším modelu. Vnitřní sklo zůstává samostatným průhledným mesh objektem. Rámy jsou uvnitř otvoru; žádný rám nesmí vytvořit neprůchozí kolizní stěnu přes skleněnou plochu.

Pokud budoucí GLB nemá rozpoznatelný skleněný mesh, generátor okna nevymyslí. Model musí dodat explicitní lokální metadata nebo být odmítnut při validační kontrole.

### Vstup

Vstup se měří z materiálu **door_white**. Střed, šířka, výška a práh určují:
- otvor ve vnitřní přední stěně;
- vnitřní vstupní bod;
- vnější interakční bod;
- směr normály dveří;
- přístupovou cestu a výškový přechod od chodníku.

Zvýšený práh se připojuje dvěma schody stejné výšky k venkovní cestě. Pěší cesta má horní povrch ve stejné výšce jako chodník; její hrana se dotýká prvního stupně bez mezery. Vnitřní podlaha začíná v úrovni skutečného prahu. Nejde o fyzické otevírání dveřního křídla; vstup stále přepíná vnější a vnitřní geometrii.

## 6. Ulice a parcela

První ulice je klidná obytná komunikace, nikoli nedokončená městská křižovatka. Šířky jsou záměrně kompaktní:

| Prvek | Rozměr |
|---|---:|
| Vozovka | 6,0 m |
| Chodník na každé straně | hloubka 1,6 m, délka profilu 36 m |
| Obruba | 0,20 m široká × 0,14 m vysoká, přesně navazuje na chodník |
| Délka prvního uličního úseku | 36 m |
| Šířka pěší přístupové cesty | 1,80 m |
| Odsazení domu za chodníkem | přibližně 1,4 m |

Ulice nemá středovou čáru, izolovaný přechod ani křižovatku, která nikam nepokračuje. Přechod se přidá až tam, kde bude napojená druhá ulice nebo doložený pěší uzel.

Dům stojí na jedné parcele na záporné straně osy Z. Vchod směřuje k chodníku a cesta vede bez přerušení od prahu k veřejné pěší ploše. Spawn hráče je na chodníku na stejné straně jako dům, nikoli v jízdním pruhu.

## 7. Co je záměrně vynecháno

- žádný nábytek, kuchyně, koupelna ani dekorace;
- žádná auta, autobusy, NPC ani pouliční mobiliář;
- žádné ploty a nahodilé zahradní objekty;
- žádná druhá ulice ani procedurální rozrůstání;
- žádný Rules World, mise, ekonomika nebo postup.

## 8. Akceptační kontrola před druhou parcelou

- [ ] Vnější šířka, výška a hloubka odpovídají skutečnému GLB.
- [ ] Interiérový plášť nepřesahuje dovnitř ani ven mimo konstrukční obálku.
- [ ] Vstupní otvor je na skutečné ose dveří a má jejich rozměr.
- [ ] Venkovní schody propojují práh a cestu bez mezery.
- [ ] Přízemní i horní okna sedí na odpovídající řádky fasády.
- [ ] Sklo je průhledné a neblokuje průchod.
- [ ] Každé podlaží má přístup ze schodišťového jádra.
- [ ] Stupně, mezipodesta a otvor ve stropě na sebe navazují.
- [ ] Kolize neblokují dveřní otvory ani průchod po schodech.
- [ ] Ulice, obruby, chodníky a cesta tvoří souvislou pěší trasu.
- [ ] Provede se ruční vizuální průchod ve WebGL před schválením druhé parcely.

Automatické testy ověřují data a matematické vztahy. Nejsou náhradou za vizuální kontrolu konkrétního modelu v prohlížeči.