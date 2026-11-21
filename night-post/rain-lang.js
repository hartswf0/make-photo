/* The languages of the rain. In each mode the falling glyphs spell words of that language, and a control's word
   (shown while a finger rests on it, and read by screen readers) is in that language.
   Dialogue and its recorded voices are English in every mode for now.
   The Amharic was written without a native reader's check; corrections are welcome. */
(function () {
  const K = ["draw", "pour", "share", "ask", "donkey", "ride", "down", "park", "wing", "map", "lidar", "listen", "plates", "eye", "back", "squirt", "throw", "dance", "radio", "jump", "expose", "menu", "drive",
    "who", "drop", "chalk", "song", "aunt", "beacon", "archive", "compound", "phone", "where", "say"];
  const T = {
    en: ["English", "water rain donkey pump well beacon signal road hill song night chalk cloud wind yard archive carry",
      "Draw water|Pour|Share water|Ask|Water the donkey|Ride|Get down|Park|Fly|Map|Lidar|Listen|Plates|Her eyes|Step back|Squirt|Throw|Dance|Radio|Jump|Expose|Menu|Drive|Who are you?|The water?|The chalk mark?|The song?|The aunt?|The beacon?|The archive?|The yard?|Your phone?|Where next?|Say…"],
    am: ["አማርኛ", "ውሃ ዝናብ አህያ ፓምፕ ጉድጓድ መብራት ምልክት መንገድ ኮረብታ ዘፈን ሌሊት ጠመኔ ደመና ነፋስ ግቢ መዝገብ ተሸከም",
      "ውሃ ቅዳ|አፍስስ|ውሃ አካፍል|ጠይቅ|አህያዋን አጠጣ|ጋልብ|ውረድ|አቁም|ብረር|ካርታ|ሊዳር|አዳምጥ|ምስሎች|በዓይኗ|ወደ ኋላ|እርጭ|ወርውር|ጨፍር|ሬዲዮ|ዝለል|ፎቶ አንሳ|ምናሌ|ንዳ|ማን ነሽ?|ውሃው?|የጠመኔ ምልክቱ?|ዘፈኑ?|አክስቴ?|መብራቱ?|መዝገቡ?|ግቢው?|ስልክሽ?|ቀጥሎ ወዴት?|ተናገር…"],
    zh: ["中文", "水 雨 驴 水泵 井 灯塔 信号 路 山 歌 夜 粉笔 云 风 院子 档案 运",
      "取水|倒水|分水|问|给驴喝水|骑|下来|停车|飞|地图|激光雷达|听|底片|她的视角|退后|喷水|扔|跳舞|收音机|跳|曝光|菜单|驾驶|你是谁？|水呢？|粉笔线？|那首歌？|姑姑？|灯塔？|档案？|院子？|你的手机？|接下来去哪？|说…"],
    es: ["Español", "agua lluvia burro bomba pozo faro señal camino colina canción noche tiza nube viento patio archivo llevar",
      "Sacar agua|Verter|Compartir agua|Preguntar|Dar agua al burro|Montar|Bajar|Aparcar|Volar|Mapa|Lidar|Escuchar|Placas|Sus ojos|Atrás|Rociar|Lanzar|Bailar|Radio|Saltar|Exponer|Menú|Conducir|¿Quién eres?|¿El agua?|¿La marca de tiza?|¿La canción?|¿La tía?|¿El faro?|¿El archivo?|¿El patio?|¿Tu teléfono?|¿Y ahora adónde?|Decir…"],
    pt: ["Português", "água chuva burro bomba poço farol sinal caminho colina canção noite giz nuvem vento pátio arquivo levar",
      "Tirar água|Verter|Partilhar água|Perguntar|Dar água ao burro|Montar|Descer|Estacionar|Voar|Mapa|Lidar|Ouvir|Chapas|Os olhos dela|Recuar|Esguichar|Atirar|Dançar|Rádio|Saltar|Expor|Menu|Conduzir|Quem és tu?|A água?|A marca de giz?|A canção?|A tia?|O farol?|O arquivo?|O pátio?|O teu telefone?|E agora, para onde?|Dizer…"],
    fr: ["Français", "eau pluie âne pompe puits balise signal route colline chanson nuit craie nuage vent cour archive porter",
      "Puiser l’eau|Verser|Partager l’eau|Demander|Abreuver l’âne|Monter|Descendre|Garer|Voler|Carte|Lidar|Écouter|Plaques|Ses yeux|Reculer|Asperger|Lancer|Danser|Radio|Sauter|Exposer|Menu|Conduire|Qui es-tu ?|L’eau ?|La marque de craie ?|La chanson ?|La tante ?|La balise ?|Les archives ?|La cour ?|Ton téléphone ?|Et ensuite, où ?|Dire…"],
    de: ["Deutsch", "Wasser Regen Esel Pumpe Brunnen Leuchtfeuer Signal Weg Hügel Lied Nacht Kreide Wolke Wind Hof Archiv tragen",
      "Wasser schöpfen|Gießen|Wasser teilen|Fragen|Esel tränken|Reiten|Absteigen|Parken|Fliegen|Karte|Lidar|Zuhören|Platten|Ihre Augen|Zurücktreten|Spritzen|Werfen|Tanzen|Radio|Springen|Belichten|Menü|Fahren|Wer bist du?|Das Wasser?|Die Kreidemarke?|Das Lied?|Die Tante?|Das Leuchtfeuer?|Das Archiv?|Der Hof?|Dein Telefon?|Wohin als Nächstes?|Sagen…"],
    ru: ["Русский", "вода дождь осёл насос колодец маяк сигнал дорога холм песня ночь мел облако ветер двор архив нести",
      "Набрать воды|Налить|Поделиться водой|Спросить|Напоить осла|Ехать верхом|Слезть|Припарковать|Лететь|Карта|Лидар|Слушать|Пластины|Её глазами|Отойти|Брызнуть|Бросить|Танцевать|Радио|Прыгнуть|Экспонировать|Меню|Вести|Кто ты?|Вода?|Меловая метка?|Песня?|Тётя?|Маяк?|Архив?|Двор?|Твой телефон?|Куда дальше?|Сказать…"]
  };
  const L = {}; for (const c in T) { const lab = {}; T[c][2].split("|").forEach((w, i) => { lab[K[i]] = w; }); L[c] = { code: c, name: T[c][0], words: T[c][1].split(" "), label: lab }; }
  window.RAIN_LANG = { order: ["en", "am", "zh", "es", "pt", "fr", "de", "ru"], get: c => L[c] || L.en };
})();
