// app/api/agency/whatsapp/route.ts
// Inbound WhatsApp: text your agents from your phone. Twilio calls this when you message the sandbox number.
// Security: the request must carry a valid Twilio signature AND come from the owner's own number.
import { after } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { executeAgenticAgent } from '@/lib/agency/agenticRunner';
import { AGENCY_AGENTS } from '@/lib/agency/agentRegistry';
import { sendWhatsAppReply } from '@/lib/agency/notify';

export const runtime = 'nodejs';
export const maxDuration = 300;

const digits = (v: string) => v.replace(/\D/g, '');
const twiml = (msg = '') => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${msg ? `<Message>${msg.replace(/[<&>]/g, '')}</Message>` : ''}</Response>`, { headers: { 'content-type': 'text/xml' } });

function validSignature(url: string, params: Record<string, string>, signature: string): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function render(d: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof d.summary === 'string' && d.summary) parts.push(d.summary);
  const body = d.deliverable;
  if (typeof body === 'string' && body) parts.push(body);
  else if (body && typeof body === 'object' && Object.keys(body as object).length) parts.push(JSON.stringify(body).slice(0, 700));
  if (Array.isArray(d.recommendations) && d.recommendations.length) parts.push(d.recommendations.slice(0, 4).map((r) => `• ${r}`).join('\n'));
  return parts.join('\n\n') || 'The agent returned nothing.';
}

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  if (!form) return new Response('Bad request', { status: 400 });
  const params: Record<string, string> = {};
  form.forEach((v, k) => { if (typeof v === 'string') params[k] = v; });

  const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const url = `${base}/api/agency/whatsapp`;
  if (!validSignature(url, params, req.headers.get('x-twilio-signature') || '')) return new Response('Forbidden', { status: 403 });

  const owner = digits(process.env.ALERT_WHATSAPP || '');
  if (!owner || digits(params.From || '') !== owner) return twiml(); // ignore anyone else silently

  const text = (params.Body || '').trim();
  if (!text) return twiml();

  if (/^(help|agents|\?)$/i.test(text)) {
    return twiml('Text me anything and the Orchestrator answers. To pick an agent, start with @ and its number, e.g. "@12 write a caption". Reply "list" for agent numbers.');
  }
  if (/^list$/i.test(text)) {
    return twiml(AGENCY_AGENTS.slice(0, 60).map((a) => `${a.number} ${a.name}`).join(' | ').slice(0, 1400));
  }

  let agent = AGENCY_AGENTS.find((a) => a.number === 1) ?? AGENCY_AGENTS[0];
  let goal = text;
  const m = text.match(/^@(\d{1,2})\s+([\s\S]+)/);
  if (m) {
    const picked = AGENCY_AGENTS.find((a) => a.number === Number(m[1]));
    if (!picked) return twiml(`No agent #${m[1]}. Reply "list" for the numbers.`);
    agent = picked;
    goal = m[2];
  }
  goal = goal.slice(0, 1900);

  // Reply immediately (Twilio gives webhooks ~15s), then finish the real agent run in the background.
  after(async () => {
    try {
      const out = await executeAgenticAgent(agent.id, goal, {});
      await sendWhatsAppReply(`${agent.name}:\n${render(out.deliverable)}`);
    } catch (e) {
      await sendWhatsAppReply(`${agent.name} could not finish: ${e instanceof Error ? e.message.slice(0, 300) : 'error'}`);
    }
  });
  return twiml(`${agent.name} is on it. I'll text you the answer here.`);
}
