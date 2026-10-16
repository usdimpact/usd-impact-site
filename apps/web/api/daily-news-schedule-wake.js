import { createScheduleWakeHandler } from '../src/lib/daily-news-schedule-wake.js';

// Inert in Preview and unless explicitly enabled in Production.
// No cron is registered by this file; activation is a separate reviewed change.
export default createScheduleWakeHandler();
