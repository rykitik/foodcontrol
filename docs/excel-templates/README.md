# Шаблоны Excel-документов

PNG-шаблоны собраны из `C:\Users\Yakimov_IS\Downloads\Питание_2025.xlsm`.

Включены листы:
- `ведомость малоимущих` -> `vedomost-maloimuschie.png`
- `табель малоимущих` -> `tabel-maloimuschie.png`
- `ведомость ОВЗ` -> `vedomost-ovz.png`
- `табель ОВЗ завтрак` -> `tabel-ovz-zavtrak.png`
- `табель ОВЗ обед` -> `tabel-ovz-obed.png`
- `ведомость сирот` -> `vedomost-sirot.png`
- `табель сирот` -> `tabel-sirot.png`
- `ведомость мног` -> `vedomost-mnogodetnye.png`
- `табель мног завтрак` -> `tabel-mnogodetnye-zavtrak.png`
- `табель мног обед` -> `tabel-mnogodetnye-obed.png`
- `ведомость сух.паек` -> `vedomost-suhpaek.png`

Из шаблонов убраны:
- ФИО студентов, группы, даты справок, отметки по дням, суммы и формулы.
- Служебные расчетные хвосты за пределами печатной части листов.
- Техническая пометка на листе `ведомость сух.паек`.

Не включались как служебные или вспомогательные листы:
- `СТУДЕНТЫ`
- `расчет сирот`
- `СТОЛОВАЯ`

Если нужно пересобрать шаблоны после правок диапазонов или правил очистки, используйте:

```powershell
python -X utf8 scripts/generate_excel_form_templates.py
```
