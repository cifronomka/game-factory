# Visual references

Эта директория содержит concept art и референсы, а не автоматически готовые production assets. Изображение нельзя без анализа использовать как единый плоский игровой экран: это обычно ломает адаптивность, состояния UI, анимацию, hit areas и визуальную прогрессию.

Перед реализацией Art Agent должен:

1. Определить, что в материале является настроением, композицией, стилем, а что — конкретным элементом.
2. Проверить provenance/права и записать допустимое использование.
3. Разложить нужный результат на отдельные backgrounds/layers, characters/poses, UI elements/states, FX и при необходимости sprite sheets.
4. Описать правила в `docs/ART_DIRECTION.md`, а каждый production asset — в `docs/ASSET_PLAN.md`.
5. Экспортировать production-файлы в соответствующие подкаталоги `assets/`, сохраняя прозрачность, размеры и naming convention.

Подкаталоги:

- `concepts/` — mood, общие композиции и ранние исследования;
- `ui-mockups/` — layout и состояния интерфейса;
- `characters/` — силуэты, позы, expressions, animation references;
- `stage-references/` — окружение, уровни, backgrounds и lighting.

Если референсы конфликтуют со спецификацией, mobile constraints или читаемостью, агент фиксирует конфликт и предлагает адаптацию; референс не переопределяет требования молча.

## Локальный reference set

В `stage-references/` сохранены семь browser-captured reference views и один contact sheet, соответствующие remote-последовательности `22_45_07`, `22_45_14`, `22_45_23`, `22_45_28`, `22_45_33`, `22_45_40`, `22_45_46` из `cifronomka/game-factory/main`. Они нужны для воспроизводимого mood/composition review в рабочей копии, но не являются оригинальными production masters и не копируются в `assets/` или `dist/`.

Production ImageGen outputs имеют независимый brief/provenance в `assets/PROVENANCE.md`; пиксели reference views не отгружаются.
