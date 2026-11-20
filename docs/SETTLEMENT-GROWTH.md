# District 14: plán postupného růstu

**Aktuální etapa:** jedna hlavní ulice, jedna parcela, jeden referenční dům  
**Cíl:** rozšiřovat město bez ztráty měřítka, průchodnosti a stavební logiky  
**Aktivní režim:** pouze Free Play / Sandbox

Úplná stavební a uliční specifikace je v [Referenční ulici a domě](REFERENCE-HOUSE-AND-STREET.md). Tento dokument stanovuje pořadí růstu a rozhodovací brány.

## Zásady

- Vnější GLB shell určuje rozměry interiéru.
- Ulice, parcely a budovy jsou ve společných metrech.
- Každá budova má samostatnou dispozici odvozenou ze svých rozměrů.
- Schodiště, dveře, okna a skla jsou konstrukce, ne dekorace.
- Nábytek a ostatní vybavení se řeší až po přijetí stavební geometrie.
- Každá přidaná část světa má vlastní stabilní ID, validační pravidla a testy.
- Nepřidávat více nových prvků najednou. Každá etapa musí být samostatně kontrolovatelná.

## Aktuální startovní řez

- jedna přímá obousměrná ulice;
- dva chodníky a obruby;
- jeden přechod pro chodce;
- jedna přístupová cesta k domu;
- jeden dům Building Green;
- tři konstrukční podlaží se schodišťovým jádrem;
- bez dopravy, NPC, stromů, plotů a pouličních dekorací.

## Etapy růstu

### Etapa 0: potvrdit uliční profil

- zkontrolovat šířku vozovky, obrub, chodníků a přechodu;
- umístit spawn mimo jízdní pruh;
- projít pěší trasu z chodníku k domu;
- ověřit, že přístupová cesta nekončí před obrubou ani nepřekrývá dveřní rám.

**Brána:** žádná mezera v pěší trase, žádná kolize s fasádou a žádný spawn ve vozovce.

### Etapa 1: přijmout referenční dům

- změřit reálný GLB shell;
- ověřit půdorys a výšku;
- ověřit vstupní polohu na konkrétní fasádě;
- projít přízemí a horní podlaží;
- ověřit schodiště, mezipodestu, stropní otvor, okna a sklo;
- zkontrolovat kolize a přechod ven/dovnitř.

**Brána:** referenční dům je schválen jako měřítkový a konstrukční vzor. Automatické testy samy o sobě nestačí.

### Etapa 2: přidat první sousední parcelu

- vymezit druhou parcelu podél stejné ulice;
- zachovat průběžný chodník a odstup od vozovky;
- přidat jeden samostatný dům s vlastním měřením;
- doplnit hierarchy node a validaci;
- ověřit, že oba vstupy zůstávají přístupné.

**Brána:** druhý dům nesmí změnit rozměry ani polohu prvního domu.

### Etapa 3: vytvořit souvislou uliční frontu

- určit stavební čáru a odstupy domů;
- navrhnout zahradní předprostor a zadní hranice parcel;
- naplánovat případné vjezdy a průchody;
- udržet jednotnou šířku chodníku a logický rytmus vstupů;
- ověřit výhledy a pěší průchody.

**Brána:** nejméně dvě parcely tvoří čitelnou ulici, nikoli náhodnou řadu modelů.

### Etapa 4: přidat další typ budovy

- vybrat GLB s jinými proporcemi;
- změřit shell a znovu odvodit interiér;
- zvolit počet podlaží podle skutečné výšky;
- použít vlastní vstupní kotvu a okna;
- nepřenášet půdorys referenčního domu na jiný model bez kontroly.

**Brána:** druhý typ budovy splňuje stejné parametry průchodnosti a návaznosti na ulici.

### Etapa 5: druhá ulice a blok

- druhou ulici přidat jako skutečný navazující úsek;
- navrhnout křižovatku, obruby a přechody;
- vymezit blok pouze tehdy, když jej ulice opravdu obklopují;
- doplnit parcely pod správnou street/block větev;
- znovu ověřit průchozí síť a měřítko.

**Brána:** síť ulic je spojitá a pěší pohyb nevede do slepých nebo nepropojených míst.

### Etapa 6: veřejný prostor a život ulice

Až po přijetí geometrie ulic a domů lze přidat:
- stromy a zeleň;
- lampy, lavičky a zastávky;
- parkování a vjezdy;
- vozidla a jejich kolize;
- chodce a interakce;
- další drobné pouliční objekty.

Každý prvek musí respektovat průchozí šířky a kolize.

### Etapa 7: vybavení interiérů

Nábytek, koupelny, kuchyně, světla a dekorace přijdou až po stavebním schválení. Vybavení se bude umísťovat podle hotového půdorysu a nebude se používat k zakrývání chybných proporcí místností.

## Co se nesmí předbíhat

- nepřidávat dopravu do neověřeného uličního profilu;
- nepřidávat ploty, pokud blokují vstupní trasu;
- nekopírovat stejný interiér do různě velkých domů;
- nevytvářet okna, která nesedí na fasádu;
- nepřidávat interiérový nábytek před ověřením schodiště a dveří;
- nezačínat procedurální generování, dokud ručně vytvořené parcely nejsou stabilní.

## Aktuální stav implementace

| Oblast | Stav |
|---|---|
| jedna ulice + jedna parcela + jeden dům | implementováno |
| hierarchie a validace ID | implementováno |
| odvození rozměrů z GLB | implementováno a testováno na testovací geometrii |
| konstrukční interiér a schody | implementováno |
| rozpoznání oken podle názvů GLB | implementováno; konkrétní model vyžaduje vizuální kontrolu |
| spawn mimo vozovku | implementováno v této dokumentační větvi |
| druhá parcela | čeká na schválení reference |
| druhá ulice a blok | neimplementováno |
| nábytek a dekorace | záměrně odloženo |
| doprava, NPC a mobiliář | záměrně odloženo |

## Akceptace každé etapy

Etapa se nepovažuje za hotovou jen proto, že build projde. Musí mít:
1. aktualizovaná data;
2. validační testy;
3. produkční build;
4. vizuální kontrolu relevantní oblasti;
5. aktualizovanou dokumentaci s rozdílem mezi hotovým a plánovaným.

Rules World, mise, skóre a postup zůstávají mimo tento plán.
