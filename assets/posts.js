const posts = [
  {
    title: "鵬",
    subtitle: "대붕",
    date: "2026-06-02",
    dateDisplay: "십분 읽기·2026년06월01일",
    img: "IMG_20250906_164811465.jpg",
    imgPosition: "top center",
    paragraphs: [
      `<i>선생님이나 형님들께 부담이 되지 않도록 조용히 이 글을 남겨둡니다. 혹시라도 이 글을 보시게 된다면, 그리고 앞으로 제 블로그에서 새롭게 인연을 맺게 될 분들을 위해 한국이 제게 어떤 의미였는지, 제가 왜 이 나라와 언어를 배우고 있는지에 대한 설명을 남깁니다.</i>`,
      `무엇보다 이 글은 단순히 세상에 보여주기 위해서가 아니라, 저 자신을 위해 소리 내어 정리해야만 했던 이야기이기도 합니다.`,
      `(이 글은 아직 번역기를 활용해 작성하고 있습니다. 언젠가는 이 모든 것을 제 한국어로 온전히 전할 수 있기를 바라지만, 한국어 학습은 제 인생에서 가장 큰 도전이 되고 있습니다. 꼭 이토록 어려울 필요는 없었을지도 모릅니다. 하지만 제가 한국어를 대하는 방식이, 이 언어에 대해 훨씬 더 깊은 수준의 정성과 주의를 기울이게 만듭니다.)`,
      `아래의 글은 지극히 개인적이고 다소 철학적인 제 이야기입니다. 이 글을 공유하는 이유는, 제가 블로그에 이 게시물을 올리게 된 중요한 배경이자 맥락이 되기 때문입니다.`,
      `열두 살 무렵, 저는 처음 미국을 경험했습니다. 그 여행은 제게 잊을 수 없는 기억으로 남았습니다. 그토록 어린 나이였음에도, 그곳과 브라질의 차이는 '우리가 사는 세상이 주변 환경에 의해 얼마나 크게 빚어지는가'에 대해 깊이 성찰하게 만들었기 때문입니다.`,
      `그때부터 저는 제 삶에 한 가지 사명을 부여했습니다. 바로 '순간들을 수집하는 것'입니다. 쾌락을 좇기 위함이 아니라, 저 자신과 타인에게 도움이 될 해답을 제 내면에서 찾기 위해서였습니다.`,
      `그 여행에서 가장 깊은 인상을 남긴 것은 다름 아닌 미국 사람들이었습니다. 비록 관광객 신분이었지만, 가족의 지인 댁에 머물며 그들의 일상에 조금이나마 참여할 수 있었습니다. 그 문화 속에 머물렀던 놀라운 경험을 가슴에 품고, 저는 영어를 유창하게 배우겠다고 다짐하며 집으로 돌아왔습니다.`,
      `그리고 4년 뒤, 저는 영어를 능숙하게 구사하게 되었습니다. 영어는 제가 몰랐던, 그러나 매우 반가운 제 영혼의 새로운 영역을 열어주었습니다. 그것은 분석적이고, 절제되어 있으며, 이성적이고 일에 집중하는 제 모습이었습니다. 브라질 사람 특유의 가볍고 장난기 많은 제 영혼과는 조금 대조되는 모습이기도 합니다.`,
      `그 이후로 마치 완전히 새로운 우주가 제 앞에 펼쳐진 것 같았고, 저는 그 우주와 교감하는 것을 진심으로 사랑하게 되었습니다. 이후 스페인어와 약간의 프랑스어까지 두 가지 언어를 더 배웠고, 각 언어는 제 내면에서 발견되는 새로운 성격이자 새로운 정체성이 되었습니다.`,
      `새로운 언어를 배울 때 마주하는 딜레마는, 당신이 결코 예전과 똑같은 사람으로 남을 수 없다는 점입니다. 새로운 자아는 언제나 과거의 자아에게 가르침을 주며, 결국 당신은 마음속에 품게 된 여러 문화 중 어느 한 곳에도 온전히 속하지 못하는 경계인이 됩니다.`,
      `예전에 교육용 로봇 공학 논문을 준비하면서, 교육을 '민주화'하는 것의 중요성에 대해 다룬 적이 있습니다. 제게 교육이란 곧 우리의 영혼을 고양시키는 일이기 때문입니다. 교육이 영혼을 고양하는 것이라면, 다른 언어를 통해 우리에게 새로운 영혼을 부여하는 것은 그 고양의 궁극적인 형태일 것입니다.`,
      `언어는 그저 허공에 흩어지는 소리나 낯선 문자가 아닙니다. 언어는 하나의 역사이자 문화이며, 감정이자 고통, 그리고 기쁨입니다. 세상을 바라보는 새로운 인터페이스입니다. 농담과 맥락, 전쟁과 상실, 그리고 승리의 기록입니다. 새로운 언어를 배운다는 것은 세상을 보는 새로운 시각을 얻는 것입니다.`,
      `한국어는 제가 지금껏 배운 언어 중 가장 많은 노력을 요구하고 있습니다. 허공에 흩어지는 소리를 넘어 단군 신화, 국악, 한자가 한국어에 미친 영향을 이해해야 하고, 역사와 음식을 배워야 하기 때문입니다. 이는 그저 소리를 익히는 것보다 훨씬 더 고된 작업입니다. 아마도 제 어린 시절 미국 여행이 그랬듯, 이는 하나의 문화를 온전히 이해하기 위해 바쳐야 할 10년간의 과정일지도 모릅니다. 마치 새로운 세계가 열린 것 같고, 저는 이제 막 그 세계를 이해하기 시작했을 뿐입니다.`,
      `이러한 맥락에서, 작년에 저는 한국을 방문할 수 있는 크나큰 축복을 받았습니다. 저를 아는 모든 사람에게 "이번 여행은 복권에 당첨된 것보다 더 가치 있었다"고 말했고, 지금 이 자리에서도 그 말을 반복하고 싶습니다. 복권 당첨금은 제 마음속 깊은 곳에 있는, 제가 스스로 해결하고 싶은 문제들을 가르쳐주지 못했을 것입니다. 한국에 가는 것 자체는 여건만 된다면 언제든 할 수 있는 일입니다. 중요한 것은 단순히 그곳에 머물렀다는 사실이 아니라, 그 여행을 둘러싼 '상황'과 특히 저와 함께해 준 '사람들'이었습니다.`,
      `먼저, 이 모든 것은 제 삶에 '영광(Glória)'을 가져다 달라고 하늘에 기도했던 것에서 시작되었습니다. 그 영광이 '글로리아(Glória, 하영 - 참고로 본인은 이 사실을 전혀 모르시며, 현재 저의 한국어 선생님이십니다)'라는 이름의 인연을 통해 찾아올 줄은, 그리고 이 여행과 사람들을 통해 '영광은 결코 내 개인의 것이 될 수 없다'는 깨달음을 얻게 될 줄은 꿈에도 몰랐습니다. 영광은 신의 것이며, 우리 모두의 것입니다. 이 진리를 가슴 깊이 느낄 수 있었습니다.`,
      `국제 논문을 쓰고, 국립대를 졸업하고, 브라질(한국의 85배 면적) 전역에서 열리는 로봇 공학 대회의 웹페이지와 자료를 구성하며 1년에 수차례 비행기를 타는 업무를 하고 있었음에도 불구하고... 제 내면에는 아주 커다란 공허함이 있었습니다.`,
      `저는 단 한 번도 저 자신을 순수한 웹 개발자, 웹 디자이너, 소프트웨어 엔지니어, 혹은 교육 기술 연구원으로만 여긴 적이 없습니다. 저는 그저 밖으로는 무언가 하나에 집중하고 싶어 하면서, 이 네 가지 역할을 동시에 수행하고 있었을 뿐입니다. 항상 타인이 제게 요구하는 모습이 되려 애썼지만, 한 번도 '진정한 나 자신'으로 살아간다는 느낌을 받지 못했습니다.`,
      `그러다 한국기술원 분들을 만났습니다. 단순한 기업으로서가 아니라 그곳의 '사람들'을 의미하며, 저는 그분들을 지구 반대편에 있는 제 진정한 형님들로 여깁니다. 그분들은 높은 직급의 관리자를 부를 수도 있었지만, 평범한 개발자이자 디자이너인 저를 불러주셨습니다. 제 인생에서 이토록 영광스러운 순간은 없었습니다. 제가 무엇을 했기에 이런 과분한 대우를 받았을까요? 제가 이해하기로는, 저는 그저 '저 자신'이었기 때문에 눈에 띄었던 것 같습니다. 상냥하고, 열려 있었으며, 상대를 존중하고 프로답게 임했던 것. 제가 가진 본연의 모습 그 이상도 이하도 아니었습니다.`,
      `제 인생에서 한 번도 일어난 적 없는 일이었습니다. 있는 그대로의 제 모습으로 주목받은 것은 처음이었죠. 이전까지 저의 세계는 오직 제가 새로운 논문이나 서비스, 프로젝트를 결과물로 내놓을 때만 저를 인정해 주었습니다. 살면서 처음으로, 단지 저라는 사람 자체로 누군가에게 인정받은 것입니다.`,
      `이후 함께 초청받은 동료 레오와 함께 거대한 문서를 작성하기로 했습니다. 이는 깊은 감사의 표현이자 한국 기업 측에 우리 여행의 가치를 증명하기 위함이었습니다. (비록 그들이 먼저 요구한 적은 없었지만요.)`,
      `아쉽게도 당시 대회 조직 문서 작업과 관련해 아무런 도움을 받을 수 없었기에, 레오와 저, 저희 두 사람이 직접 과거 폴더에서 자료를 찾아내고, 옛 매뉴얼의 정보들을 취합해 자체 매뉴얼을 만들어야 했습니다. 알맞은 부서에 연락을 취하고, 국제 RoboCup 측과 소통하며 필요한 모든 것을 구축하는 작업 역시 오롯이 저희가 도맡아 했습니다. 다행히 결과는 성공적이었고, 그분들도 만족스러워하시는 것 같았습니다.`,
      `하지만 이번 한국 여행에서 저를 진정으로 감동시킨 것은 일 자체가 아니었습니다. 저를 감동시킨 것은 제가 마주한 그 '다른 세상'이었습니다.`,
      `평생 동안 저는 마늘을 많이 먹는다고, 과묵하다고, 로봇과 로봇 공학을 좋아한다는 이유로 관광과 축구, 1차 산업이 중심인 제 조국에서 "너드 같은 취향"이라며 평가받고 재단당해 왔습니다.`,
      `하지만 한국에서는 제가 남들과 다르다는 사실이 큰 문제가 되지 않았고, 오히려 제게 일종의 자유를 주었습니다. 어차피 외국인이라는 정의상 그곳에 완벽히 동화될 수 없었기에, 억지로 끼워 맞추려 애쓸 필요 없이 그저 '저 자신'이면 충분했기 때문입니다.`,
      `어떤 한국인도 저를 함부로 대하지 않았습니다. 혼자서든, 레오와 함께든, 아니면 저희 형님들과 함께 들어간 모든 가게에서, 제가 그저 저다운 모습으로 다가갔을 때 사람들은 저를 무척 따뜻하게 환영해 주었습니다. 문화를 존중하지 않는 무례한 관광객들도 많다는 것을 압니다. 하지만 저는 어느 순간에도 제 본연의 모습 그 이상을 꾸며내지 않았습니다.`,
      `남들과 조금 다르게 행동한다는 이유로 제 조국에서조차 숱한 어려움을 겪었던 사람으로서, 이는 정말 신선하고 거대한 충격이었습니다.`,
      `집으로 돌아왔을 때, 이 모든 것은 제게 깊은 성찰의 계기가 되었습니다. 단순히 한국이라는 나라 자체에 대한 생각뿐만이 아닙니다. 한국은 우리가 믿고 있는 세상 그 이상의 훨씬 넓은 세상이 존재한다는 것을 깨닫게 해준, 신이 제게 내리신 축복이었습니다.`,
      `한국에서 이분들과 함께한 경험은, 우리가 종종 '우리의 것이 아닌 압박감'으로 스스로를 깎아내리고 재단하고 있다는 사실을 일깨워 주었습니다. 우리의 작은 연못 너머에는 무한히 많은 연못들이 존재합니다. 물고기에 비유하자면, 새로운 연못으로 들어가는 지혜를 얻은 사람으로서 우리는 다른 물고기들이 각자의 연못(관심사, 사람, 열정, 지식, 언어 등)을 찾을 수 있도록 도울 수 있습니다. 우리 모두는 전체의 '영광'을 위해함께 일하고 돕는 존재들입니다. 이것이 제가 한국에서의 경험을 통해 얻은 가장 중요한 깨달음 중 하나입니다. 저는 하늘에 영광을 구했지만, 영광은 결코 제 손안에 머무는 것이 아니라 우리가 가진 것을 나눌 때 비로소 전체와 함께한다는 사실을 배웠습니다.`,
      `이는 오래전 읽었던 도가(道가) 사상의 한 이야기를 떠올리게 합니다.`,
      `북쪽 바다에 사는 물고기 곤이 거대한 태풍을 만나 거대한 새 붕이 되어 날아오른다는 이야기입니다. 물고기로 있을 때는 곤의 마음을 알지 못하고, 붕이 되어 날아오를 때도 붕의 마음을 온전히 이해하는 이는 없습니다. 오직 붕 자신만이 그 비행이 어떤 것인지 압니다.`,
      `이 이야기가 제게 깊게 와닿는 이유는, '나의 세계'로부터 받는 평가와 시선이 늘 제게는 무겁고 힘겨웠기 때문입니다. 곤을 바다에서 끌어올려 준 태풍(이 경우, 저를 이끌어주신 제 형님들)은 제가 하늘에 깊이 감사해야 할 절대적인 은혜입니다.`,
      `어쩌면 제 삶이 저를 한국에서의 장기 체류로 이끌지 않을 수도 있습니다. 하지만 이 나라에서 맺은 인연, 그리고 제 형님들만은 언제나 제 곁에 소중히 간직하고 싶습니다. 저는 영원히 그분들께 감사할 것입니다. 앞으로도 아름다운 한국어와 문화를 배우고 한국 음식을 즐기며 살아갈 것이고, 한국은 언제나 제 가슴속에 따뜻한 자리를 차지할 것입니다.`,
      `저에게 한국은 '저 자신을 사랑하는 법'을 가르쳐준 나라입니다. 약간 유치하게 들릴 수도 있고, 인터넷에서 흔히 보이는 맹목적이고 절박한 사람처럼 보일까 조금 걱정도 됩니다만 결코 그런 것이 아닙니다. 삶이 저를 한국으로 이끌지 않더라도 제게는 이미 계획해 둔 삶의 궤적이 있습니다. 이 글은 그저 제가 살아온 시간, 저의 형님들, 그리고 하늘에 대한 깊은 감사의 자리에서 우러나온 이야기입니다.`,
      `제가 영어를 배우며 제 영혼의 미지의 영역과 연결되었듯, 한국어 또한 아직 제가 알지 못하는 제 영혼의 또 다른 이면과 닿을 수 있는 연결고리가 되기를 바랍니다. 그리고 이 깨달음을 바탕으로, 제가 지금 영어를 가르치고 교육용 로봇 도구를 만들고 있는 것처럼, 모든 이에게 이 지혜를 나누고 가르칠 수 있기를 소망합니다`,
      `진심으로, 한국어는 제 인생 최대의 도전이 되고 있습니다. 그동안 수없이 복잡한 도구들도 몇 주 만에 터득해 왔지만, 여가 시간을 쪼개어 공부하는 한국어는 제가 지금껏 시도해 본 일 중 단연코 가장 어렵고 무거운 여정입니다.`
    ]
  },
  {
    title: "Post-Korea comments #1",
    featured: true,
    subtitle: "I faced the Abyss and came back to tell the story",
    date: "2026-04-20",
    "img": "IMG_20240731_185254394~2.jpg",
    "imgPosition": "bottom center",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `In 2023, life challenged me to look deeply into "Nietzsche's Abyss" - and I survived to tell the story.`,
      `I've been quite absent these past few months, and I may remain so for a few more. Many things happened, and I am currently restructuring my life. I will share my journey so far with those interested. I believe acquired wisdom needs to be shared, and those open to hearing it can digest it however they see fit and take what is useful for their own lives.`,
      `Think of these next 8 posts as a "poetry-snapshot" that captures my internal journeys up to mid-2026.`
    ]
  },
  {
    title: "Post-Korea comments #2",
    subtitle: "Reflections of a spectator",
    "img": "IMG_20250911_143834741.jpg",
    "imgPosition": "center center",
    date: "2026-04-20",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `I've always felt profoundly different, and that brought me a lot of anguish. I judged myself heavily, isolated myself trying to fit in, and suffered a lot in the process. Today, I rationalize this through human names like "Intellectual giftedness" or numbers in DSM-5 tests. But, as someone with academic titles and publications to my name, I know these are methodological inventions created to seek the Truth - but which often end up creating power structures that distance us from it. A homeless person can have wisdom just as valid, if not MORE valid, than a post-doc.`,
      `It was very easy, in my youth, to project my difference onto others negatively (calling them "normies") or to redirect it all to myself, seeing myself as "broken". The truth is that all these labels and tests are just abstractions of the unique reality experienced by each of us, through our own biological and chemical lenses.`,
      `I always saw myself as a spectator condemned to a reality that doesn't emotionally belong to me. This, however, changed after a 33-hour flight. In the position of a spectator of ANOTHER world (Korea) - free from the pressures of my own - I formed a very clear mental map of what affects me in my bubble, which is incredibly smaller than "the whole". When you are already a "stranger" by definition (a foreigner), you don't need to wear yourself out pretending to be what you are not.`,
      `Materialism was not providing the answers I sought. A car existed in someone's consciousness before it was drawn; wood only became a tool because someone looked at a tree beyond its planned purpose. Consciousness comes first; materialization follows.`,
      `I concluded that the judgments placed upon us and our differences are, actually, STRENGTHS to provide new perspectives. All religions say that "we are here for a purpose", and that is real. You matter much more (with your flaws and all) than the modern materialist current tries to convince you.`
    ]
  },
  {
    title: "Post-Korea comments #3",
    subtitle: "Entropy",
    date: "2026-04-20",
    "img": "IMG_20250906_092913095.jpg",
    "imgPosition": "top center",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `<i>Disclaimer: What I philosophize here goes beyond language. Words are symbols to which we attribute feelings. My symbol for "home" might not be yours. Discussions about the nature of things fail and generate misunderstandings when they get stuck solely in semantics.</i>`,
      `Possibly the most beautiful non-religious work ever written has no certain authorship: the <b>Tao Te Ching</b>. Millennia ago, it compiled what modern physics had to rediscover at the end of the 19th century: the universe tends towards equilibrium ("entropy", "ordered chaos"). Fighting against the flow of the universe generates friction. And friction never changes the "end", because universal forces are much greater than us, mere agents of reality.`,
      `Fighting against this current brings unbalanced forces into our lives, of a destructive and corrosive nature. Conflicts generally arise from semantics or the anxiety for control. By accepting the end and letting go of the during - stopping the urge to control the process - we achieve glory with much less effort.`,
      `(Remembering that glory always belongs to the whole, never personal. Personal glory invariably generates friction in some area invisible to the eyes).`,
      `Friction comes back in the form of suffering, and you deserve more, for you are part of something very beautiful. By following the current (after discovering your role in it), we can turn our personal vector towards love, tolerance, peace, art, and beauty - the equilibrium that we can, more accurately, call God.`
    ]
  },
  {
    title: "Post-Korea comments #4",
    subtitle: "Cultural constructs and tailor-made abysses",
    "img": "IMG_20250905_082153272.jpg",
    "imgPosition": "top center",
    date: "2026-04-20",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `Going to Korea was the profound experience of being born again - but now as an external and adult spectator. Korea did the impossible: it was not crushed in East Asia by its giant neighbors. It is a society with a beautiful history, but one that agonizes under pressures and abysses created by itself.`,
      `I saw a society that does not repudiate childhood with our Brazilian "fragile masculinity". It is not weird to see adult men with cute backpacks, or services and taxis with charismatic mascots. But, on the other hand, they imprison themselves in aesthetic and behavioral standards of frightening rigidity. The contrast shows, blaringly, how we are the authors of our own cages. I saw a tense nation, carrying a scarcity mindset (which hasn't matched its reality for decades) and competing obsessively. How does a nation with the taeguk ☯ (equilibrium) on its flag create so much internal friction?`,
      `It is strange and liberating to see how Brazil and Korea invent abysses of such distinct natures.`,
      `I experienced a revealing situation: I proposed an art piece based on the ancient floral patterns of Korean palaces (dancheong). Historically used to keep insects away with the smell of the paint, ward off evil from houses, and create architectural harmony with the nature around the building. I was warned that today this could be frowned upon by some groups as "idolatry". Curiously, other Korean traditions do not suffer the same repudiation.`,
      `It is as if a universal human instinct for control and puritanism had crossed oceans and centuries (coming from Europe in the case of what is defined as "idolatry") to manifest there in Korea, censoring its own history in the name of a new morality. It is sad to see belief systems based on love (like Christianity and Buddhism) dividing themselves to invalidate and tear down the other's search for meaning.`
    ]
  },
  {
    title: "Post-Korea comments #5",
    subtitle: "Control vs. Freedom",
    date: "2026-04-20",
    "img": "IMG_20230718_074258567.jpg",
    "imgPosition": "bottom center",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `If we are pointed towards truth, unity, and love, I feel we need to abdicate our anxious desire for control. The problem is that the universal and the divine are beyond-human, and our brain is biologically programmed to want to control everything out of fear for our survival.`,
      `I feel we are constantly being pushed into a modern slavery, masked as convenience. In the near future, you will own almost nothing: you will pay monthly fees to use AI, to access your music, your movies, your phone. We will work only to pay the tributes imposed on us to access basic life.`,
      `This transcends capitalism or communism, right or left; I perceive this as a spiritual battle for your soul and your free will. It manifests on both sides from the way we are pushed into rampant consumption to the doctrines that try to dictate the rigid way we must emanate and feel love.`,
      `Wealth is not about resources. Control structures try to turn us into servants who worship materialism and hedonism, deconstructing idealism, philosophy, and our personal relationship with the whole. Your existence is worth infinitely more than that.`
    ]
  },
  {
    title: "Post-Korea comments #6",
    subtitle: "Semantics (God exists and doesn't care if you believe in them)",
    "img": "IMG_20240725_175752724.jpg",
    "imgPosition": "bottom center",
    date: "2026-04-20",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `We are all part of one thing. This was the central message of the great figures of humanity. But the wisdom of love is bothersome, because our survivalist filters fight against the beauty of unity. Many of those who tried to preach this unconditional love were killed because decentralized love threatens control structures. Loving unconditionally is a courageous choice.`,
      `We seek control to feel safe and create abysses to validate ourselves. The things of life do not exist to be the subject of semantic debates, but to be searched for internally.`,
      `Unless a belief (be it religion, nationalism, academicism, or scientism) preaches the superiority of one group over another, almost all of them try to point to the same truth using different methods. Someone in the countryside of India can feel a love as genuine and divine as someone living under the story of Buddha or Christ. An atheist might not understand the "spirit" as something mystical, but can rather understand it as an informational pattern, encoded in the human brain, that is contagious between people. And it all remains real regardless of your beliefs, meaning the discussion is semantic in nature.`,
      `God can be, materially, the figure your faith dictates, or the coordinating force of all creation - including you. When doctrines become semantic disputes devoid of love, they have already become distortions of the human ego.`,
      `We appear to be a sum of vectors: our balance can flow with the universe extracting the best from people (the good), or point to ourselves through unresolved fears and cravings for control (the evil). Our energies create waves in the social field. It is our role to perceive which of these waves are causing friction in our soul and readjust our compass with humility.`
    ]
  },
  {
    title: "Post-Korea comments #7",
    subtitle: "Wealth is Consciousness",
    date: "2026-04-20",
    "img": "IMG_20240806_074644847.jpg",
    "imgPosition": "bottom center",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `Wealth is not about resources. A dog with infinite food can eat until it gets sick; a lottery winner can blow it all and end up on the streets. Having access to resources doesn't make you wealthy.`,
      `Being human is having the ability to rationalize BEYOND intuition. A bird builds a nest guided by the perfect intuition of what a home is. We have the opposite challenge: we get lost in logical rationalization and forget our intuitive and divine side - the state of flow that creates true art.`,
      `But our rationality gives us a superpower: low time preference. We mold the world creatively to reap rewards in the medium term, long term, and intergenerationally.`,
      `True human wealth is our consciousness. Solving problems generates wealth because you are exporting your IDEA - your materialized consciousness. Art and music generate value because they export feelings frozen in time through an object. Studying generates wealth because it elevates your human capital, expanding your capacity to export complex perspectives.`,
      `Focusing only on material goods without expanding your consciousness in the opposite direction of the ego generates corruption and friction. That is why free access to education and the arts is so vital. The structures that censor this are cruel because they architecturally perpetuate spiritual poverty. Having consciousness bothers nihilism. You matter, and the world needs your unique lens.`
    ]
  },
  {
    title: "Post-Korea comments #8",
    subtitle: "The past, present, and future are about creating",
    "img": "IMG_20250906_171322018.jpg",
    "imgPosition": "bottom center",
    date: "2026-04-20",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `In the future of AI - and that's why we need to continue fighting fiercely for open-source models, so we don't become slaves to corporate subscriptions - we will be able to unlock the most beautiful potential of our species. The potential to elevate our consciousness and use our ARTISTIC will to create and innovate as the central focus of existence.`,
      `Steve Jobs would not have revolutionized the world without Steve Wozniak's hands. But what if Wozniak himself could be his own "Steve Jobs"? What if he had thousands of non-conscious "virtual hands" to project his own solutions and visions?`,
      `I love coding, but I know the technical barrier of my profession will soon disappear. And I am happy about that!`,
      `<b>You will be able to code too.</b>`,
      `My years of experience are not lost; they have simply been added to my consciousness so that I can apply them in endeavors of a new nature, crossing areas of knowledge that were previously impossible to connect alone.`,
      `In the age of AI, we will be able to be students, inventors, and creators on a scale humanity has never seen. If we don't let machines think for us, this technology actually STRENGTHENS us as humans. The battle for your soul continues; you must stay awake.`
    ]
  },
  {
    title: "Post-Korea comments #9",
    subtitle: "What I will do with this (lluc.dev)",
    "img": "IMG_20250906_163445492.jpg",
    "imgPosition": "bottom center",
    date: "2026-04-20",
    dateDisplay: "2026년04월20일",
    paragraphs: [
      `After facing this abyss for the time I did, I let go of the Lucas that existed until now.`,
      `I accepted that I am too much of an artist to be a classic programmer, but too square and rational for the bohemian art life. Regardless of these apparent contradictions, I understood that my purpose as an artist is exactly the same as my purpose as an educator and science communicator: to touch and elevate the souls of those who consume what I create, giving them what I have accumulated in my own consciousness.`,
      `Like any human being, I seek references in the world around me to compose my creations - whether for myself or for modern corporate human life. I just decided that I want to be, full-time, a vector pointed towards the good.`,
      `That is why, now, I become something beyond an HCI Researcher, Ed Tech Advocate, or Software Engineer. I become Lucas. Lucas Moura.`,
      `With my background, I can still create, architect, and debug systems. But I declare independence from the tethers or expectations that society wants to create for me. From now on, I only choose projects and spaces that respect my purpose. If an environment doesn't want me because I don't adapt to the modern meat grinder, I will know that space was never for me.`,
      `Soon I will share the portfolio of this new journey of mine. I leave these reflections open: I might be wrong, and I will make a point of admitting where I erred if time shows me so. I keep seeking the truth, aware that it is very hard to lift the veil of our own ego.`,
      `Nice to meet you all!`
    ]
  }
];

const pages = [
  {
    slug: 'kit-box',
    title: '브라질에서, 감사를 담아',
    date: '2026-08-01',
    dateDisplay: '2026년08월01일',
    paragraphs: [
      `한국기술원(KIT) 여러분 안녕하세요, 오랜만입니다.<br>다들 잘 지내고 계시길 바랍니다.`,
      `재현 형님께서 저와 제 여자친구, 그리고 레오를 위해 여러분이 챙겨주신 선물들을 보내주셨다는 소식을 들었습니다.`,
      `이 선물 상자는 저(루카) 혼자 포장하고 있지만, 저희 셋 모두의 깊은 감사의 마음을 담고 있습니다.`,
      `브라질의 상징인 쪼리(슬리퍼)를 함께 보냅니다. (한국에서는 신발을 선물하면 도망간다는 미신이 있다고 들어서, 꼼수로 '거스름돈' 용도의 지폐 두 장을 같이 넣었습니다 ㅋㅋㅋ) 브라질에서는 언제 어디서나 신지만, 한국에서는 집 안이나 해변에서 신는 게 더 잘 어울릴 것 같네요 ㅎㅎ`,
      `여러분이 한국이라는 나라를 저희에게 조금이나마 보여주셨던 것처럼, 저도 저의 나라를 보여드리고 싶었습니다. 사실 평생에 걸쳐 보여드린다고 해도 다 보여드릴 수는 없을 것 같아요! 저 역시 브라질 주(州)들의 절반 정도를 가봤지만, 여전히 이 나라를 다 알기엔 턱없이 부족하다고 느낄 정도니까요 ㅋㅋㅋ`,
      `그래서 이 거대한 나라의 다채로움을 쉽게 느끼실 수 있도록, 브라질을 대표하는 6개 주요 문화권으로 요약해 카드에 담았습니다. (원래는 12개 정도로 나눌까 하다가, 보기 편하게 6개로 줄였어요)`,
      `음악 플레이리스트도 함께 담았습니다. 같은 문화권 안에서도 '이중 경제'(dual economy) 구조 때문에 나타나는 뚜렷한 문화적 차이를 음악으로 느껴보셨으면 해서요.`,
      `제가 사는 북동부(Nordeste) 지역 특산품인 커피 맛 캐슈넛과 함께, 레오가 있는 지역을 대표하는 의미로 브라질 커피 원두도 같이 넣었어요.`,
      `아, 그리고 천도 하나 준비했어요! 브라질에는 주방 수건만의 독특한 미학과 디자인 문화가 있거든요. 여러분은 디자인을 하시는 분들이니 "panos de prato"를 한 번 검색해 보시는 걸 추천합니다. 흥미롭게 느끼실 수도 있을 것 같아요! 정말 재미있고 독창적인 예시들을 많이 보실 수 있을 거예요 ㅋㅋㅋ 사무실에서 이 작은 수건을 유용하게 쓰셨으면 좋겠어요 ^^`,
      `그리고 비치백 두 개도 함께 보냅니다. 하나는 아쉽게도 저희가 만나보지 못한 재현 형님의 따님을 위한 것이고, 다른 하나는 특유의 유쾌한 웃음소리로 저희의 연구실 방문을 항상 기분 좋게 만들어주셨던 연구원님을 위한 것입니다.`,
      `모든 것에 정말 감사드립니다! 여러분은 이 편지나 선물로 다 표현할 수 없을 만큼 저에게 훨씬 더 특별한 분들입니다.`
    ]
  }
];
