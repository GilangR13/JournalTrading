"""Refresh the public BLS release calendar used by the screenshot news filter.

Run only from GitHub Actions. A failed official fetch leaves the existing feed intact.
"""

import json
import re
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent
FEED = ROOT / "official-news.json"
URL = "https://www.bls.gov/schedule/news_release/bls.ics"
HEADERS = {"User-Agent": "JournalTrading calendar updater (GitHub Actions; official BLS release calendar)"}


def unfold_ical(text):
    lines = []
    for line in text.splitlines():
        if line.startswith((" ", "\t")) and lines:
            lines[-1] += line[1:]
        else:
            lines.append(line)
    return lines


def event_key(summary):
    title = summary.lower()
    if "consumer price index" in title:
        return "US_CPI"
    if "producer price index" in title:
        return "US_PPI"
    if "employment situation" in title:
        return "US_NFP"
    if "job openings and labor turnover" in title:
        return "US_JOLTS"
    return None


def start_wib(value, parameter):
    match = re.match(r"^(\d{8})T(\d{4})(\d{2})?(Z?)$", value)
    if not match:
        return None
    date_part, hm, second, zulu = match.groups()
    zone_match = re.search(r"TZID=([^;:]+)", parameter)
    zone = timezone.utc if zulu else ZoneInfo(zone_match.group(1)) if zone_match else ZoneInfo("America/New_York")
    instant = datetime.strptime(date_part + hm + (second or "00"), "%Y%m%d%H%M%S").replace(tzinfo=zone)
    return instant.astimezone(ZoneInfo("Asia/Jakarta"))


def main():
    request = urllib.request.Request(URL, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=25) as response:
        source = response.read().decode("utf-8-sig", errors="replace")
    if "BEGIN:VCALENDAR" not in source or "BEGIN:VEVENT" not in source:
        raise RuntimeError("BLS calendar response is not an iCalendar document")

    items, event = [], None
    now = datetime.now(timezone.utc)
    for line in unfold_ical(source):
        if line == "BEGIN:VEVENT":
            event = {}
        elif line == "END:VEVENT":
            if event:
                key = event_key(event.get("SUMMARY", ""))
                when = event.get("when")
                if key and when and now - timedelta(days=14) <= when.astimezone(timezone.utc) <= now + timedelta(days=180):
                    items.append({
                        "key": key,
                        "dateWib": when.date().isoformat(),
                        "timeWib": when.strftime("%H:%M"),
                        "source": "Bureau of Labor Statistics - release calendar",
                        "url": "https://www.bls.gov/schedule/news_release/bls.ics",
                    })
            event = None
        elif event is not None and ":" in line:
            left, value = line.split(":", 1)
            field = left.split(";", 1)[0]
            if field == "SUMMARY":
                event["SUMMARY"] = value.replace("\\,", ",")
            elif field == "DTSTART":
                event["when"] = start_wib(value, left)

    if len(items) < 3:
        raise RuntimeError(f"Only {len(items)} matching BLS events found; feed not replaced")
    unique = {(item["key"], item["dateWib"], item["timeWib"]): item for item in items}
    payload = {
        "updatedAt": now.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "coverage": "BLS AS: CPI, PPI, Employment Situation, JOLTS. Other events are not verified by this feed.",
        "events": sorted(unique.values(), key=lambda x: (x["dateWib"], x["timeWib"], x["key"])),
    }
    FEED.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {len(payload['events'])} official BLS events")


if __name__ == "__main__":
    main()
