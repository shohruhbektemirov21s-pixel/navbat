# Uzbekistan onboarding locations

`uzbekistan_locations.json` contains 14 regions (12 provinces, Karakalpakstan,
and Tashkent city), 177 districts and 31 cities of regional subordination.
Districts and cities are separate entries, including Qarshi city vs Qarshi district.
The bot reads this versioned local directory; registration never depends on a
third-party geography API being available.

Verified on 2026-10-08 against the official Statistics Agency's 2026 directory:
https://api.siat.stat.uz/media/uploads/sdmx/sdmx_data_307.pdf
(indicator 2.01.01.0036, last updated 2026-06-12).
That table aggregates Namangan city's two districts. Davlatobod and Yangi Namangan
are listed separately here, confirmed by the regional statistics office:
https://namstat.uz/uz/haqida/hududiy-boshqarmalar

Display spellings were normalized for Marhamat, Shahrixon, Ellikqal’a, Hazorasp,
Shayxontohur, Sergeli and the missing space in Yangiyo‘l shahri, using the other
official sources listed in the JSON. Only names and administrative membership are
used; statistical time-series values are not copied.

The short region IDs and district IDs are persistent Telegram callback identifiers.
Keep them stable when correcting labels. Add/remove administrative units here and
update directory tests when official territorial changes occur. City records are
created on selection, and existing city references are preserved.
