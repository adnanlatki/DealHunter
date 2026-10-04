import { sendText } from "../whatsapp";

// READY: official Meta WhatsApp Cloud API.
export const enabled = () => !!(process.env.WHATSAPP_TOKEN && process.env.PHONE_NUMBER_ID);
export const send = (to, text) => sendText(to, text);
