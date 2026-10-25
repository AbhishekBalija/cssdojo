import { EventEmitter } from "node:events";

/** In-process "this submission is scored" events, used by the waiting API request. */
export const scoreEvents = new EventEmitter();
scoreEvents.setMaxListeners(1000);
