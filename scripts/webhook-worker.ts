import hre from "hardhat";
import { readFile, writeFile } from "fs/promises";
import path from "path";

const { ethers } = hre;

type WebhookEventType = "file.uploaded" | "file.accessed" | "file.downloaded" | "subscription.paid";

interface DeliveryTarget {
  id: string;
  endpoint: string;
  eventType?: WebhookEventType;
}

interface ChainLog {
  blockNumber: number;
  transactionHash: string;
  index?: number;
  logIndex?: number;
  args?: unknown;
}

interface DropboxContract {
  filters: Record<string, () => unknown>;
  queryFilter: (filter: unknown, fromBlock: number, toBlock: number) => Promise<ChainLog[]>;
  getWebhookFileOwner: (fileId: bigint) => Promise<string>;
  webhooks: (webhookId: bigint) => Promise<unknown>;
}

const EVENT_NAMES: Record<WebhookEventType, string> = {
  "file.uploaded": "FileUploaded",
  "file.accessed": "FileAccessed",
  "file.downloaded": "FileDownloaded",
  "subscription.paid": "SubscriptionPaid",
};

const EVENT_FILE_ID_INDEX: Record<WebhookEventType, number> = {
  "file.uploaded": 0,
  "file.accessed": 0,
  "file.downloaded": 0,
  "subscription.paid": 1,
};

function jsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => Number.isNaN(Number(key)))
      .map(([key, item]) => [key, jsonSafe(item)]),
  );
}

async function readCheckpoint(filePath: string): Promise<Record<string, number>> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as Record<string, number>;
  } catch {
    return {};
  }
}

async function writeCheckpoint(filePath: string, state: Record<string, number>) {
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

async function readWebhookTargetRegistry(): Promise<DeliveryTarget[]> {
  const filePath = path.resolve(process.env.WEBHOOK_TARGETS_FILE || ".webhook-targets.json");
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as DeliveryTarget[]) : [];
  } catch {
    return [];
  }
}

function tupleValue(value: unknown, key: string, index: number) {
  if (value && typeof value === "object" && key in value) {
    return (value as Record<string, unknown>)[key];
  }
  if (Array.isArray(value)) return value[index];
  return undefined;
}

function normalizedAddress(value: unknown) {
  return String(value || "").toLowerCase();
}

function dedupeTargets(targets: DeliveryTarget[]) {
  const deduped = new Map<string, DeliveryTarget>();
  for (const target of targets) {
    if (!target.id || !target.endpoint) continue;
    const eventType = target.eventType || "file.uploaded";
    deduped.set(`${target.id}:${eventType}`, { ...target, eventType });
  }
  return Array.from(deduped.values());
}

async function webhookOwner(dropbox: DropboxContract, webhookId: string) {
  const hook = await dropbox.webhooks(BigInt(webhookId));
  return normalizedAddress(tupleValue(hook, "owner", 1));
}

function eventFileId(eventType: WebhookEventType, log: ChainLog) {
  const value = tupleValue(log.args, "fileId", EVENT_FILE_ID_INDEX[eventType]);
  if (value === undefined) throw new Error(`Missing fileId in ${eventType} event`);
  return BigInt(String(value));
}

async function rawFileOwner(dropbox: DropboxContract, fileId: bigint) {
  return normalizedAddress(await dropbox.getWebhookFileOwner(fileId));
}

async function main() {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const targetJson = process.env.WEBHOOK_DELIVERY_TARGETS || "[]";
  const deliverySecret = process.env.WEBHOOK_DELIVERY_SECRET;
  const configuredTargets = JSON.parse(targetJson) as DeliveryTarget[];
  const registryTargets = await readWebhookTargetRegistry();
  const targets = dedupeTargets([...configuredTargets, ...registryTargets]);
  const checkpointFile = path.resolve(process.env.WEBHOOK_CHECKPOINT_FILE || ".webhook-checkpoints.json");
  const workerKey = process.env.RELAYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!contractAddress) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is required");
  if (!deliverySecret) throw new Error("WEBHOOK_DELIVERY_SECRET is required");
  if (!workerKey) throw new Error("RELAYER_PRIVATE_KEY or PRIVATE_KEY is required for webhook owner lookups");
  if (!targets.length) {
    console.log("No webhook delivery targets configured.");
    return;
  }

  const latestBlock = await ethers.provider.getBlockNumber();
  const fallbackFromBlock = Math.max(0, latestBlock - Number(process.env.WEBHOOK_BLOCK_WINDOW || 5000));
  const workerSigner = new ethers.Wallet(workerKey, ethers.provider);
  const dropbox = (await ethers.getContractAt("FhenixDropBox", contractAddress)).connect(workerSigner) as unknown as DropboxContract;
  const checkpoint = await readCheckpoint(checkpointFile);

  for (const target of targets) {
    const eventType = target.eventType || "file.uploaded";
    const eventName = EVENT_NAMES[eventType];
    const checkpointKey = `${contractAddress.toLowerCase()}:${target.id}:${eventType}`;
    const lastCheckpoint = checkpoint[checkpointKey] ?? (fallbackFromBlock - 1);
    if (lastCheckpoint >= latestBlock) {
      console.log(`Webhook ${target.id} ${eventType}: no new blocks`);
      continue;
    }
    const fromBlock = lastCheckpoint + 1;
    const filterFactory = dropbox.filters[eventName];
    const owner = await webhookOwner(dropbox, target.id);

    if (!filterFactory) throw new Error(`Unsupported webhook event type: ${eventType}`);

    const logs = await dropbox.queryFilter(filterFactory(), fromBlock, latestBlock);
    const ownedLogs: ChainLog[] = [];
    for (const log of logs) {
      if (await rawFileOwner(dropbox, eventFileId(eventType, log)) === owner) {
        ownedLogs.push(log);
      }
    }

    for (const log of ownedLogs) {
      const response = await fetch(`${appBaseUrl}/api/webhooks/deliver`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FhenixDropBox-Webhook-Secret": deliverySecret,
        },
        body: JSON.stringify({
          webhookId: target.id,
          endpoint: target.endpoint,
          eventType,
          payload: {
            contract: contractAddress,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            logIndex: log.index ?? log.logIndex ?? 0,
            args: jsonSafe(log.args),
          },
        }),
      });

      console.log(`Webhook ${target.id} ${eventType} ${log.transactionHash}: ${response.status} ${response.statusText}`);
      if (!response.ok) {
        throw new Error(`Webhook ${target.id} delivery failed with ${response.status}`);
      }
    }

    checkpoint[checkpointKey] = latestBlock;
    console.log(`Webhook ${target.id} ${eventType}: delivered ${ownedLogs.length} event(s)`);
  }

  await writeCheckpoint(checkpointFile, checkpoint);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
