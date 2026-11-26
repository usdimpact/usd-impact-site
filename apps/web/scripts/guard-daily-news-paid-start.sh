#!/usr/bin/env bash
set -euo pipefail

# A native GitHub schedule can be delivered hours late. Never make a
# provider-billed request after the backstop's 07:10 New York launch cutoff.
# This guard does not approve a merge, an editorial claim or a deployment.
utc_day="$(date -u +%F)"
utc_weekday="$(date -u +%u)"
us_day="$(TZ=America/New_York date +%F)"
us_time="$(TZ=America/New_York date +%H:%M)"
# GNU date silently treats an unavailable America/New_York zone as UTC.
# Require a recognized local abbreviation AND matching UTC offset; if the
# system zone database is absent, fail closed before either paid POST.
us_zone="$(TZ=America/New_York date +%Z 2>/dev/null || true)"
us_offset="$(TZ=America/New_York date +%z 2>/dev/null || true)"
case "$us_zone:$us_offset" in
  EST:-0500|EDT:-0400) ;;
  *) echo '::error::America/New_York time-zone data could not be verified; HOLD without provider call.'; exit 1 ;;
esac

if [[ ! "$utc_day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] \
  || [[ ! "$utc_weekday" =~ ^[1-7]$ ]] \
  || [[ ! "$us_day" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]] \
  || [[ ! "$us_time" =~ ^([01][0-9]|2[0-3]):[0-5][0-9]$ ]]; then
  echo '::error::Daily paid-start window cannot be established; HOLD without provider call.'
  exit 1
fi
if [ "$utc_weekday" -gt 5 ] || [ "$utc_day" != "$us_day" ]; then
  echo '::error::Daily paid-start is outside the same-date US weekday window; HOLD without provider call.'
  exit 1
fi
if [[ "$us_time" > "07:10" || "$us_time" == "07:10" ]]; then
  echo "::error::Daily paid-start is after the 07:10 America/New_York cutoff ($us_day $us_time); use separately reviewed no-paid late editorial recovery."
  exit 1
fi

echo "::notice::Daily paid-start window verified ($us_day $us_time America/New_York); all later publication gates remain active."
