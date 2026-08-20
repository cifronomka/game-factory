# Corrective Cycle 02 — живое пламя, персонажи, сложность и звук

## Статус

**SUPERSEDED — historical only.** Этот brief описывает закрытый cycle 02 и больше не является текущим gameplay-контрактом. Решение о Stage-4 seal отменено corrective cycle 03: все семь стадий доступны без provider, rewarded даёт только optional ×2 на 20 active seconds. Актуальные правила находятся в `PRODUCT_SPEC.md`, `GAME_DESIGN.md`, `MONETIZATION.md` и V4 fixtures. Visual/audio решения этого файла сохраняют историческую трассировку, но пункты о seal нельзя использовать для implementation или release acceptance.

Ниже сохранён исходный текст cycle 02 без переписывания истории.

## Цель цикла

Сохранить прямой tap/decay core и layered scene, но устранить четыре заметных недостатка:

1. огонь не должен выглядеть как одна картинка с деформацией/переливом;
2. Ash Servant и Demoness должны появляться, жить в idle и явно выполнять воздействие на огонь;
3. без подтверждённого boost игрок не должен пройти дальше Stage 4;
4. звук должен восприниматься как живой древесный огонь и раздувание опахалом, а не газовая горелка.

## 1. Flame animation — обязательная переделка

- Текущие одиночные `flame-core` и `flame-outer` изображения нельзя считать полной animation system.
- Создать отдельные authored transparent animation frames как минимум для core и outer flame. В каждом loop должны реально меняться контур, развилки, длина и направление языков, а не только tint, slice offset или scale.
- Core и outer проигрываются независимо с согласованным hearth anchor; цикл не должен иметь заметного скачка на шве.
- Heat продолжает плавно управлять общей высотой, шириной, светом, частицами и reveal. Покадровая анимация не превращает progression в переключение семи статичных sprites.
- Tap даёт короткий burst/impulse, но не сбрасывает loop и не создаёт flicker.
- При смене Stage presentation выполняет отдельный transition: текущий вид не исчезает мгновенно, новая интенсивность/слой входит через согласованный crossfade/morph и stage FX. Переход вверх и вниз должен быть читаемым и без pop.
- Reduced Motion использует спокойный authored loop с меньшим fps/amplitude, а не полностью мёртвую картинку.
- Примитивное геометрическое пламя и одиночный static-card fallback в production path запрещены.

## 2. Character animation — обязательная переделка

Для Ash Servant и Demoness нужны раздельные authored frame/state sets:

- `appearance`: персонаж возникает из тьмы/пепла/дымного reveal, а не просто становится видимым;
- `idle`: дыхание, перенос веса, движение головы/рук/одежды; силуэт явно живой даже без события;
- `attack`: отдельное действие, синхронизированное с gameplay hazard;
- `return/settle`: контролируемое возвращение в idle без snap.

Ash Servant:

- перед эффектом набирает воздух;
- затем наклоняется и дует в сторону hearth;
- authored pose frames и отдельный поток воздуха/пепла показывают направление;
- flame визуально пригибается в тот же интервал, когда активен increased decay.

Demoness:

- проходит silhouette/reveal;
- в idle сохраняет живое движение;
- attack имеет явный cast/hold/release с authored pose frames и отдельным spell FX;
- flame реагирует именно во время активного decay hazard.

Один cutout, который только масштабируется/вращается, больше не проходит visual acceptance.

## 3. Stage 4 seal и временный boost stub

- Каждый валидный tap по-прежнему немедленно даёт heat/score; cadence, Resonance и rate cap не возвращаются.
- До первого подтверждённого boost текущего run heat может расти только до верхней границы Stage 4. Попытка пройти порог показывает понятную `Infernal Seal`, а не молча игнорирует input.
- Первая успешная активация boost в run навсегда ломает seal для этого run и одновременно запускает существующий `×2` на `20 active seconds`.
- После разрушения seal поздние stages остаются доступны и после окончания 20 секунд; повторно открывать progression gate в том же run нельзя.
- Пока рекламный SDK не подключён, Web/dev CTA явно помечается `Получить ×2 (тест)` и вызывает тот же подтверждённый reward-success command. Это временный platform stub, а не симуляция просмотренной рекламы.
- Cancel/error/duplicate callback не ломают seal. Restart создаёт новый run и снова закрывает seal.
- Headless test обязан доказать: no-boost trace с высокой частотой tap остаётся на Stage 4; boosted trace проходит seal и достигает Inferno; 60/30/15 FPS дают одинаковый результат.

## 4. Audio direction

- Текущий непрерывный звук, воспринимаемый как газовая горелка, удалить из production manifest/path.
- Базовый ambience: натуральный древесный/угольный огонь — нерегулярный crackle, ember pops, низкий room body; без ровного газового hiss/roar.
- Разгорание получает отдельный мягкий `bellows/fanning whoosh`: ощущение движения воздуха/опахала, а не электронный tap sound.
- Whoosh агрегируется по короткому окну rapid taps и меняет intensity, поэтому при 8–12 taps/s не запускаются десятки overlapping voices.
- Servant blow и Demoness cast имеют собственные атмосферные cues, но gameplay остаётся полностью понятным без звука.
- Никаких oscillators, arcade beeps, pitch ladder, casino/reward jingles или повторяющегося звука на каждый tap.
- Нужны OGG/MP3 либо OGG/FLAC fallback, provenance/license/hash, loop-seam QA, pause/ad/mute lifecycle и два независимых прослушивания с вопросами `wood fire or gas burner?` и `bellows/fanning or synthetic whoosh?`.

## 5. Evidence и stop condition

До завершения цикла обязательны:

- manifest/provenance всех новых sprite frames и audio files;
- unit tests animator frame selection, state transitions, pause freeze, no duplicate loads/voices;
- deterministic gameplay tests no-boost seal/boost unlock/restart reset;
- browser evidence минимум на `390×844`, `768×1024`, `1366×768`, `800×360`;
- motion evidence для flame idle, stage transition, Servant appearance/idle/attack и Demoness appearance/idle/attack — не только один still;
- visual QA подтверждает, что без HUD пламя выглядит горящим, а не деформируемой карточкой;
- character QA без подписей различает appearance/idle/attack и причинно-следственную связь hazard → flame reaction;
- audio QA двумя слушателями не классифицирует ambience как газовую горелку и распознаёт fanning/bellows cue;
- performance budget включает все resident atlases/audio и Stage 7 stress;
- все новые acceptance rows PASS, открытых Critical/High нет.

## 6. Implementation order

1. Согласовать gameplay seal/boost contract и обновить docs/tests fixtures.
2. Создать asset specifications и новые authored frames.
3. Реализовать generic atlas/frame animator и asset loading.
4. Интегрировать flame loops и stage transitions.
5. Интегрировать character appearance/idle/attack state machines.
6. Реализовать Stage 4 seal и временный Web/dev boost stub.
7. Заменить ambience и добавить агрегированный fanning cue.
8. Пройти browser motion QA, difficulty regression, audio listening и performance audit.
9. Обновить reports и только после этого сформировать release candidate.
