/**
 * Zero-dependency Global Online WSS Relay Transport (MQTT 3.1.1 over TLS WebSocket).
 * Works directly from static HTTPS hosting (GitHub Pages) across ANY two devices
 * on different networks (4G/5G mobile, Wi-Fi, PC, Android, iOS) with zero NAT/TURN issues.
 */

const RELAY_ENDPOINTS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081',
] as const;

export const RELAY_PREFIX = 'drizzycraft/s09/v1';

const te = new TextEncoder();
const td = new TextDecoder();

function encodeRemainingLength(len: number): number[] {
  const out: number[] = [];
  let x = len;
  do {
    let byte = x % 128;
    x = Math.floor(x / 128);
    if (x > 0) byte |= 0x80;
    out.push(byte);
  } while (x > 0);
  return out;
}

function encodeUtf8String(str: string): Uint8Array {
  const bytes = te.encode(str);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = (bytes.length >> 8) & 0xff;
  out[1] = bytes.length & 0xff;
  out.set(bytes, 2);
  return out;
}

export function buildMqttConnectPacket(clientId: string, keepAliveSec = 30): Uint8Array {
  const cid = encodeUtf8String(clientId);
  // Protocol Name "MQTT" (6) + Level 4 (1) + Flags CleanSession 0x02 (1) + KeepAlive (2) = 10
  const remLen = 10 + cid.length;
  const rl = encodeRemainingLength(remLen);
  const pkt = new Uint8Array(1 + rl.length + remLen);
  let o = 0;
  pkt[o++] = 0x10; // CONNECT
  pkt.set(rl, o);
  o += rl.length;
  pkt.set([0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, (keepAliveSec >> 8) & 0xff, keepAliveSec & 0xff], o);
  o += 10;
  pkt.set(cid, o);
  return pkt;
}

export function buildMqttSubscribePacket(packetId: number, topicFilter: string): Uint8Array {
  const tf = encodeUtf8String(topicFilter);
  const remLen = 2 + tf.length + 1;
  const rl = encodeRemainingLength(remLen);
  const pkt = new Uint8Array(1 + rl.length + remLen);
  let o = 0;
  pkt[o++] = 0x82; // SUBSCRIBE (QoS 1 required)
  pkt.set(rl, o);
  o += rl.length;
  pkt[o++] = (packetId >> 8) & 0xff;
  pkt[o++] = packetId & 0xff;
  pkt.set(tf, o);
  o += tf.length;
  pkt[o] = 0x00; // Requested QoS 0
  return pkt;
}

export function buildMqttUnsubscribePacket(packetId: number, topicFilter: string): Uint8Array {
  const tf = encodeUtf8String(topicFilter);
  const remLen = 2 + tf.length;
  const rl = encodeRemainingLength(remLen);
  const pkt = new Uint8Array(1 + rl.length + remLen);
  let o = 0;
  pkt[o++] = 0xa2; // UNSUBSCRIBE
  pkt.set(rl, o);
  o += rl.length;
  pkt[o++] = (packetId >> 8) & 0xff;
  pkt[o++] = packetId & 0xff;
  pkt.set(tf, o);
  return pkt;
}

export function buildMqttPublishPacket(
  topic: string,
  payloadStr: string,
  retain = false
): Uint8Array {
  const tBytes = encodeUtf8String(topic);
  const pBytes = te.encode(payloadStr);
  const remLen = tBytes.length + pBytes.length;
  const rl = encodeRemainingLength(remLen);
  const pkt = new Uint8Array(1 + rl.length + remLen);
  let o = 0;
  pkt[o++] = retain ? 0x31 : 0x30; // PUBLISH QoS 0
  pkt.set(rl, o);
  o += rl.length;
  pkt.set(tBytes, o);
  o += tBytes.length;
  pkt.set(pBytes, o);
  return pkt;
}

export function buildMqttPingReqPacket(): Uint8Array {
  return new Uint8Array([0xc0, 0x00]);
}

export interface ParsedMqttPacket {
  type: number;
  topic?: string;
  payload?: string;
}

export function parseMqttPackets(buf: Uint8Array): { packets: ParsedMqttPacket[]; rest: Uint8Array } {
  const packets: ParsedMqttPacket[] = [];
  let offset = 0;

  while (offset + 2 <= buf.length) {
    const header = buf[offset];
    const type = (header >> 4) & 0x0f;

    // Decode variable-length Remaining Length
    let mult = 1;
    let remLen = 0;
    let lenBytes = 0;
    let completeHeader = false;
    for (let i = 1; i <= 4; i++) {
      if (offset + i >= buf.length) break;
      const b = buf[offset + i];
      remLen += (b & 0x7f) * mult;
      mult *= 128;
      lenBytes = i;
      if ((b & 0x80) === 0) {
        completeHeader = true;
        break;
      }
    }
    if (!completeHeader) break;
    const totalLen = 1 + lenBytes + remLen;
    if (offset + totalLen > buf.length) break;

    const bodyStart = offset + 1 + lenBytes;
    const bodyEnd = offset + totalLen;

    if (type === 3) {
      // PUBLISH
      const qos = (header >> 1) & 0x03;
      if (bodyStart + 2 <= bodyEnd) {
        const topicLen = (buf[bodyStart] << 8) | buf[bodyStart + 1];
        const topicStart = bodyStart + 2;
        const topicEnd = topicStart + topicLen;
        if (topicEnd <= bodyEnd) {
          const topic = td.decode(buf.subarray(topicStart, topicEnd));
          const payloadStart = qos > 0 ? topicEnd + 2 : topicEnd;
          const payload =
            payloadStart <= bodyEnd ? td.decode(buf.subarray(payloadStart, bodyEnd)) : '';
          packets.push({ type, topic, payload });
        }
      }
    } else {
      packets.push({ type });
    }

    offset += totalLen;
  }

  return { packets, rest: buf.subarray(offset) };
}

export type RelayMessageHandler = (topic: string, payload: string) => void;

export class OnlineRelayTransport {
  private ws: WebSocket | null = null;
  private rxBuf = new Uint8Array(0);
  private nextPacketId = 1;
  private subscriptions = new Set<string>();
  private messageHandlers = new Set<RelayMessageHandler>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingSentAt = 0;
  private connected = false;

  public pingMs: number | null = null;
  public onPingUpdate: ((ms: number) => void) | null = null;
  public onDisconnect: (() => void) | null = null;

  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  onMessage(handler: RelayMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  async connect(timeoutPerEndpointMs = 3800): Promise<boolean> {
    if (this.isConnected()) return true;
    if (typeof WebSocket === 'undefined') return false;

    for (const url of RELAY_ENDPOINTS) {
      const ok = await this.tryConnectEndpoint(url, timeoutPerEndpointMs);
      if (ok) return true;
    }
    return false;
  }

  private tryConnectEndpoint(url: string, timeoutMs: number): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const fail = () => {
        if (settled) return;
        settled = true;
        this.cleanup();
        resolve(false);
      };

      const timer = setTimeout(fail, timeoutMs);
      try {
        const ws = new WebSocket(url, ['mqtt']);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;
        this.rxBuf = new Uint8Array(0);

        ws.onopen = () => {
          const clientId = `dc09_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36).slice(-4)}`;
          this.lastPingSentAt = Date.now();
          ws.send(buildMqttConnectPacket(clientId, 30));
        };

        ws.onmessage = (ev) => {
          const chunk =
            ev.data instanceof ArrayBuffer
              ? new Uint8Array(ev.data)
              : new Uint8Array(0);
          if (chunk.length === 0) return;

          const merged = new Uint8Array(this.rxBuf.length + chunk.length);
          merged.set(this.rxBuf, 0);
          merged.set(chunk, this.rxBuf.length);
          const { packets, rest } = parseMqttPackets(merged);
          this.rxBuf = new Uint8Array(rest);

          for (const pkt of packets) {
            if (pkt.type === 2 && !settled) {
              // CONNACK
              settled = true;
              clearTimeout(timer);
              this.connected = true;
              const rtt = Math.max(1, Date.now() - this.lastPingSentAt);
              this.pingMs = rtt;
              this.onPingUpdate?.(rtt);
              // Re-subscribe any active topics
              for (const topic of this.subscriptions) {
                this.sendSubscribe(topic);
              }
              this.startPingLoop();
              resolve(true);
            } else if (pkt.type === 13) {
              // PINGRESP
              if (this.lastPingSentAt > 0) {
                const rtt = Math.max(1, Date.now() - this.lastPingSentAt);
                this.pingMs = rtt;
                this.onPingUpdate?.(rtt);
              }
            } else if (pkt.type === 3 && pkt.topic !== undefined && pkt.payload !== undefined) {
              for (const h of this.messageHandlers) {
                try {
                  h(pkt.topic, pkt.payload);
                } catch {
                  // isolate handler errors
                }
              }
            }
          }
        };

        ws.onerror = () => {
          clearTimeout(timer);
          fail();
        };

        ws.onclose = () => {
          clearTimeout(timer);
          if (!settled) {
            fail();
            return;
          }
          const wasConnected = this.connected;
          this.cleanup();
          if (wasConnected) {
            this.onDisconnect?.();
          }
        };
      } catch {
        clearTimeout(timer);
        fail();
      }
    });
  }

  subscribe(topicFilter: string): void {
    this.subscriptions.add(topicFilter);
    if (this.isConnected()) {
      this.sendSubscribe(topicFilter);
    }
  }

  unsubscribe(topicFilter: string): void {
    this.subscriptions.delete(topicFilter);
    if (this.isConnected() && this.ws) {
      const id = this.nextPacketId++ & 0xffff || 1;
      try {
        this.ws.send(buildMqttUnsubscribePacket(id, topicFilter));
      } catch {
        // ignore
      }
    }
  }

  publish(topic: string, payloadObj: unknown, retain = false): boolean {
    if (!this.isConnected() || !this.ws) return false;
    try {
      const str = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
      this.ws.send(buildMqttPublishPacket(topic, str, retain));
      return true;
    } catch {
      return false;
    }
  }

  private sendSubscribe(topicFilter: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const id = this.nextPacketId++ & 0xffff || 1;
    try {
      this.ws.send(buildMqttSubscribePacket(id, topicFilter));
    } catch {
      // ignore
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingTimer = setInterval(() => {
      if (this.isConnected() && this.ws) {
        this.lastPingSentAt = Date.now();
        try {
          this.ws.send(buildMqttPingReqPacket());
        } catch {
          // ignore
        }
      }
    }, 12000);
  }

  private stopPingLoop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private cleanup(): void {
    this.stopPingLoop();
    this.connected = false;
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  disconnect(): void {
    this.subscriptions.clear();
    this.cleanup();
    this.pingMs = null;
  }
}
