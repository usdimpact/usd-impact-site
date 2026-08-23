# Catalyst Brief Tier 8 tooling

- `generate-daily-card-catalyst-brief-candidates.mjs` builds a review-only queue from published Catalyst Brief evidence.
- `test-daily-card-catalyst-brief-candidates.mjs` enforces the no-auto-publish and no-event-specific-leakage boundary.
- The weekly Daily Card content queue uploads the generated review artifacts for editorial inspection.

This tooling does not add canonical cards or activate any outbound distribution.
