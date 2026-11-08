import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const LINKS_FILE = path.join(DATA_DIR, "links.json");

export type BankLink = {
  requisitionId: string;
  institutionId: string;
  institutionName: string;
  createdAt: string;
};

async function ensure() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(LINKS_FILE);
  } catch {
    await fs.writeFile(LINKS_FILE, "[]", "utf8");
  }
}

export async function getLinks(): Promise<BankLink[]> {
  await ensure();
  return JSON.parse(await fs.readFile(LINKS_FILE, "utf8")) as BankLink[];
}

export async function saveLink(link: BankLink) {
  const links = await getLinks();
  const idx = links.findIndex((l) => l.requisitionId === link.requisitionId);
  if (idx >= 0) links[idx] = link;
  else links.unshift(link);
  await fs.writeFile(LINKS_FILE, JSON.stringify(links, null, 2), "utf8");
}
