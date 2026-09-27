import { dayKey } from "../admin/metrics";
import { BandwidthDay } from "./bandwidth.model";

export interface BandwidthDelta {
  inboundBytes?: number;
  outboundBytes?: number;
  requests?: number;
  originals?: number;
  transforms?: number;
  uploads?: number;
}

export function recordBandwidth(delta: BandwidthDelta, at = new Date()) {
  const inboundBytes = Math.max(0, Math.floor(delta.inboundBytes ?? 0));
  const outboundBytes = Math.max(0, Math.floor(delta.outboundBytes ?? 0));
  const requests = Math.max(0, Math.floor(delta.requests ?? 0));
  const originals = Math.max(0, Math.floor(delta.originals ?? 0));
  const transforms = Math.max(0, Math.floor(delta.transforms ?? 0));
  const uploads = Math.max(0, Math.floor(delta.uploads ?? 0));
  if (inboundBytes + outboundBytes + requests + originals + transforms + uploads === 0) return;

  void BandwidthDay.updateOne(
    { day: dayKey(at) },
    {
      $inc: { inboundBytes, outboundBytes, requests, originals, transforms, uploads },
      $setOnInsert: { day: dayKey(at) },
    },
    { upsert: true },
  ).catch(() => undefined);
}
