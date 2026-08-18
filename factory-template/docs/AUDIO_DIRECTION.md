# Audio Direction — {{GAME_TITLE}}

## Назначение

Задаёт звуковую систему, динамику и lifecycle audio. Список файлов и форматов фиксируется в `ASSET_PLAN.md`.

## Инструкции владельцу: Audio Agent

Свяжи каждый звук с игровым событием, приоритетом и ограничением одновременного воспроизведения. Предусмотри autoplay restrictions, mute, потерю focus, рекламу и fallback форматов браузера.

## Music direction

{{GENRE_TEMPO_MOOD_INSTRUMENTATION}}

## Ambient layers

{{LAYERS_TRIGGERS_CROSSFADE}}

## SFX

| Событие | Характер | Варианты | Cooldown/polyphony |
|---|---|---:|---|
| {{EVENT}} | {{DESCRIPTION}} | {{COUNT}} | {{RULE}}

## Tap feedback

{{LATENCY_VARIATION_ANTI_FATIGUE}}

## Progression audio

{{MILESTONES_INTENSITY_LAYERING}}

## Rewarded boost audio

{{START_ACTIVE_END_CANCELLED_CUES}}

## Loop requirements

{{SEAMLESS_POINTS_DURATION_CROSSFADE_METADATA}}

## Громкость и микс

{{LUFS_PEAK_TARGETS_DUCKING_USER_CONTROLS}}

## Pause и реклама

До рекламы gameplay/music/SFX корректно паузятся; после закрытия resume выполняется один раз только после platform callback и с учётом focus/mute. Политика: {{PLATFORM_LIFECYCLE_DETAILS}}.
