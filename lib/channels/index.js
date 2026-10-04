import * as whatsapp from "./whatsapp";
import * as instagram from "./instagram";
import * as texnity from "./texnity";

const ALL = { whatsapp, instagram, texnity };

export const channelStatus = () => Object.entries(ALL).map(([id, a]) => ({ id, enabled: a.enabled() }));

// Send a reply on whichever channel the customer used.
export async function deliver(channel, to, text) {
  if (channel === "website") throw new Error("Website visitors cannot be messaged here. Contact them on the phone number they left.");
  const a = ALL[channel];
  if (!a) throw new Error(`Unknown channel "${channel}".`);
  if (!a.enabled()) throw new Error(`The ${channel} channel is not configured yet.`);
  return a.send(to, text);
}
