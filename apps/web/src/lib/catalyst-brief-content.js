const catalystBriefFiles = import.meta.glob('../content/catalyst-briefs/*.md');

export const hasCatalystBriefFiles = Object.keys(catalystBriefFiles).length > 0;
