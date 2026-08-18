# Audio Direction — «Зажги»

## Назначение

Документ задаёт звуковую систему, её адаптивную динамику и lifecycle. Перечень производимых файлов, вариантов и форматов находится в `ASSET_PLAN.md`.

## Music direction

Музыка — тёмная ритуальная электроакустика без хоррор-скримеров: низкий воздушный drone, приглушённый пульс, рамочные барабаны, металлические резонансы и синтетический хор без слов. Темп — `96 BPM`, размер `4/4`, гармонический центр D с устойчивым педальным тоном. Задача музыки — расти вместе с пламенем, не утомляя при частом tapping и не маскируя feedback.

Пять синхронных stem-loop по 8 тактов (`20 s` при 96 BPM), с одинаковыми точками начала/конца:

1. `music-dark-bed` — воздушный drone и очень редкие низкие текстуры; стадии 1–7.
2. `music-low-pulse` — мягкий пульс без резкой атаки; плавно входит со стадии 2.
3. `music-percussion` — редкая ритуальная перкуссия; стадии 4–7.
4. `music-infernal-tone` — металлический/хоровой слой без речи; стадии 5–7.
5. `music-inferno-climax` — высокая остинатная искра и усиление downbeat; только стадия 7.

Все stems музыкально полноценны в любой разрешённой комбинации и имеют phase-aligned master. Смена стадии меняет gain на следующей четверти с equal-power crossfade `1.25 s`; при быстром падении стадии слой может уйти сразу с `0.6 s` fade, но не обрывается. `stageProgress` тонко управляет фильтром/громкостью в пределах текущей стадии, а дискретный `stageChanged` включает состав слоёв. Gameplay меняет stage без гистерезиса; presentation crossfade не задерживает core transition.

## Ambient layers

| Слой | Содержание | Trigger / gain | Переход |
|---|---|---|---|
| `amb-dark-room` | Воздух большой каменной камеры, очень тихий низкий rumble | Всегда после первого user gesture, `-30…-27 LUFS` relative mix | Seamless loop, fade-in `1.5 s` |
| `amb-fire-crackle-a/b` | Два взаимозаменяемых loop углей/огня | A со стадии 1; B добавляется со стадии 4, gain следует normalized heat | Crossfade `1.0 s`, случайный swap каждые 2–4 loop cycles |
| `amb-chain-room` | Дальний металл и редкие цепи | Стадии 4–7, максимум один accent каждые `6 s` | Gain fade `1.5 s`, accents отдельно |
| `amb-whispers-texture` | Невербальная обратная гранулярная текстура, без слов | Стадии 6–7, очень тихо | Fade `2.0 s`; отключается при reduced sensory mode |

Ambient не меняет правила игры. Random accents используют детерминированный session seed, чтобы QA мог воспроизводить микс; timing jitter не влияет на game RNG.

## SFX

| Событие | Характер | Варианты | Cooldown / polyphony |
|---|---|---:|---|
| Обычный tap | Короткий сухой уголь + мягкий огненный tick, без резкого high-end | 6 | `25 ms`; pool 4, oldest-quietest voice steal |
| Critical tap | Более яркий snap с коротким tonal ping | 3 | `120 ms`; polyphony 2 |
| Заряд Резонанса | Низкий короткий pulse, четыре ступени высоты/яркости | 4 linked cues | Один на accepted rhythmic tap; polyphony 1 |
| Вспышка / Передышка | Тёплый expansion / мягкий contracting exhale | 1 / 1 | По одному на state transition; polyphony 1 |
| Stage-up | Ритуальный rise + удар, длительность до `1.4 s` | 7 связанных вариантов | `1.5 s`; polyphony 1; higher stage wins |
| Stage-down | Мягкое осыпание углей без fail-jingle | 2 | `800 ms`; polyphony 1 |
| Слуга: появление | Зольный swirl и короткая ухмылка-выдох без речи | 2 | `2 s`; polyphony 1 |
| Слуга: выдох/debuff | Направленный воздушный whoosh с холодным tail | 3 | `500 ms`; polyphony 2 |
| Слуга: порыв отменён | Короткий тёплый ash-pop | 2 | Один на успешные 4 taps; polyphony 1 |
| Демонесса: reveal | Низкий metallic bloom | 1 | Один раз за reveal; polyphony 1 |
| Демонесса: cast | Обратный рунический sweep + impact | 2 | `1 s`; polyphony 1 |
| Клеймо разрушено | Шесть осколочных accents, собранных в короткий release | 1 | Один на успешные 6 taps; polyphony 1 |
| Debuff active | Тихая cold shimmer-петля | 1 loop | Только один instance; fades `150 ms` |
| Debuff end | Тёплый release и возврат crackle | 2 | `500 ms`; polyphony 1 |
| Inferno entered | Самый полный rise/impact, без clipping | 1 | Один раз на вход; polyphony 1 |
| Окно жара | Собирающийся tonal ring / активный bright hiss | 1 / 1 | Telegraph и active; не чаще event schedule |
| Rewarded CTA | Тихий трёхнотный намёк, только по focus/hover | 1 | `2 s`; polyphony 1 |
| Rewarded confirmed | «Печать» из low impact, восходящей квинты и огненного bloom | 1 | Один раз только после rewarded callback |
| Rewarded ending | Три мягких затухающих tick в последние 3 секунды | 1 sequence | Один sequence; не перекрывает tap |
| Rewarded ended | Спокойное снятие ауры без fail-tone | 1 | Один раз; polyphony 1 |
| UI press / disabled | Сухой stone tick / muted knock | 2 / 1 | `80 ms`; общий pool 2 |
| Personal best | Короткий золотой chord, отличный от stage-up | 1 | Один раз за сессию при первом превышении |

## Tap feedback

- AudioContext создаётся/возобновляется только из первого `pointerdown` или другого явного user gesture; до этого игра визуально работает без ошибки.
- Sample уже декодирован и находится в пуле до активного gameplay. Цель: onset звука не позже `50 ms` после принятого input на target device.
- Шесть вариантов выбираются shuffle-bag алгоритмом: один и тот же вариант не играет дважды подряд. На каждый voice применяются pitch `±3%`, gain `±1.5 dB` и stereo pan максимум `±0.12` на desktop; на mono mobile pan отключается.
- При input быстрее `25 ms` новые звуки не наслаиваются бесконечно: лишние taps агрегируются в один более плотный accent на следующем `50 ms` окне. Визуальный и игровой tap при этом не теряются.
- Tap-bus немного ярче при heat, но общий gain ограничен. Ни скорость воспроизведения, ни pitch не растут без верхней границы.

## Progression audio

| Стадия | Music/ambient state | Особый акцент |
|---|---|---|
| 1. Тьма | Dark bed + room tone + тихий crackle A | Почти пустой спектр, редкие угольные clicks. |
| 2. Искра | Добавляется low pulse, crackle следует heat | Первый тёплый stage-up. |
| 3. Пепельный слуга | Состав стадии 2, появляется character SFX | Выдох кратко duck'ит crackle на `2 dB`. |
| 4. Алый порог | Добавляются percussion, chain ambience и crackle B | Удар врат/рунический rise. |
| 5. Демонесса угасания | Добавляется infernal tone | Cast duck'ит music на `3 dB` на `450 ms`; active cold loop обозначает debuff. |
| 6. Круг Инферно | Все слои кроме climax; whispers texture тихо | Перкуссия открывает фильтр, accents становятся плотнее. |
| 7. Инферно | Добавляется climax, stems достигают nominal gain | Уникальный enter cue; tap/score feedback остаётся впереди микса. |

При stage-down слой уходит, но музыка не «наказывает» диссонансом. Возврат в уже достигнутую стадию снова даёт stage-up cue, однако не чаще одного раза в `1.5 s`. Personal-best cue имеет приоритет выше обычного stage-up, а Inferno enter — выше personal best. Резонанс, Вспышка, Передышка, Порыв слуги, Клеймо и Окно жара используют отдельные cues и не зависят от слышимости музыки; при mute их полностью дублируют visual indicators из `ART_DIRECTION.md`.

## Rewarded boost audio

«Печать Инферно x2» даёт `tapPower×2` на 20 секунд активного gameplay и начинается только после `rewarded: true`, закрытия рекламы и фактического resume от platform adapter. На подтверждении звучит отдельный `sfx-boost-start`; active state добавляет тихий синхронный `music-boost-shimmer` stem и усиливает high crackle не более чем на `1.5 dB`. Последние 3 секунды обозначаются мягким countdown cue. В конце boost stem уходит за `350 ms`, звучит neutral end cue, основной mix продолжает текущую stage без reset.

- Cancel/error/ad unavailable: reward audio и active layer не запускаются; после возврата восстанавливается прежний mix.
- Duplicate callback: lifecycle token позволяет выдать cue и reward ровно один раз.
- Pause/background во время active boost: аудио и 20-секундный active-time таймер заморожены одной политикой; после resume остаток эффекта продолжается, новый start cue не звучит.

## Loop requirements

- Music stems: ровно `20.000 s`, `48 kHz`, phase-aligned, одинаковые loop markers `0` и `960000` samples, stereo.
- Ambient loops: `8–30 s`, sample-accurate end-to-start, mono где spatial width не нужна; перед экспортом проверяются на click и DC offset.
- Active debuff/boost loops: `5–10 s`, отдельные fade-in/out до `350 ms`; baked fade на границе loop запрещён.
- Primary delivery — Opus `48 kHz`; fallback — MP3 `44.1/48 kHz`. Runtime выбирает ровно один совместимый format pack и не загружает оба.
- Metadata/loop points фиксируются в asset manifest, а не только в имени файла. Все source masters остаются lossless вне release bundle; в `assets/audio/` планируются только оптимизированные exports.

## Громкость и микс

- Master target при полном составе: `-14 LUFS-I`, true peak не выше `-1 dBTP`.
- Music stems как группа: nominal `-20 LUFS`, ambience `-30…-25 LUFS`, tap transient peaks около `-12 dBFS`, stage/reward cues не выше `-8 dBFS` до master limiter.
- Tap/critical cue sidechain-duck'ит music максимум на `1.5 dB`/`80 ms`; enemy cast — максимум `3 dB`/`450 ms`; UI не duck'ит музыку.
- One-shot limiter защищает от rapid taps, но не должен заметно pump'ить ambient. Проверка проходит на максимальной разрешённой input rate.
- Controls: явная mute/unmute кнопка, состояние сохраняется; стартовое значение следует сохранённой настройке, при её отсутствии — unmuted, но звук не стартует до user gesture. Изменение system volume не симулируется.
- При reduced sensory mode whispers выключены, high-frequency crackle ниже на `3 dB`, все важные состояния сохраняют distinct cues.

## Pause, focus и реклама

Единый audio lifecycle управляется application state machine, а не отдельными рекламными callbacks:

1. Перед показом рекламы gameplay переводится в pause, new one-shots блокируются, master плавно уходит в silence за `100 ms`, после чего AudioContext suspends.
2. `visibilitychange=hidden`, blur или platform pause применяют ту же idempotent pause-операцию. Несколько причин хранятся как set; один resume не снимает другие причины.
3. После закрытия рекламы platform adapter возвращает callback. Resume допускается один раз только когда callback завершён, document visible, window focused и пользователь не включил mute.
4. AudioContext resumes из допустимого gesture/callback path; loop transport синхронизируется с сохранённой musical phase, затем master возвращается за `250 ms`. Просроченные one-shots не доигрываются.
5. При отказе браузера возобновить context UI остаётся рабочим и показывает ненавязчивый mute/audio-locked state; следующий pointerdown повторяет resume.
6. Reward cue воспроизводится только после confirmed reward и после допустимого resume. При cancel/error восстанавливается прежняя stage mix без reward cue.

Таймеры boost/debuff и audio lifecycle должны следовать одной gameplay pause policy. Нельзя продолжать boost countdown, пока platform pause останавливает игру.

## Handoff и риски

- Решено: five-stem adaptive score, отдельные ambient/SFX buses, bounded tap polyphony, sample-accurate loops и idempotent ad/focus lifecycle.
- Главный риск — fatigue от частых taps. Митигация: shuffle bag, малые randomization ranges, 25 ms cooldown, voice aggregation и ограниченный high-end.
- Риск рассинхронизации stems после suspend/resume требует общего transport clock и automated phase/duplicate-resume test.
- Риск размера bundle снижается codec selection, lazy preload будущих layers и лимитами `ASSET_PLAN.md`.
- Финальные audio files на planning stage не создаются; до производства необходимы лицензия/provenance и loudness/loop QA каждого export.
