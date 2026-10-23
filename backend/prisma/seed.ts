import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { computeBidHash } from "../src/lib/hash";
import { newAlias } from "../src/lib/alias";
import { prisma } from "../src/lib/prisma";

interface Artwork {
  id: number;
  title: string;
  artist: string | null;
  year: string | null;
  type: string | null;
  medium: string | null;
  dimensions: string | null;
  url: string;
  img: string;
}

interface ClevelandRaw {
  id: number;
  title: string;
  creation_date?: string | null;
  creators?: { description?: string | null }[] | null;
  technique?: string | string[] | null;
  measurements?: string | null;
  type?: string | null;
  url: string;
  images?: { web?: { url?: string } | null } | null;
}

const FALLBACK_ARTWORKS: Artwork[] = [
  {
    id: 141639,
    title: "Twilight in the Wilderness",
    artist: "Frederic Edwin Church",
    year: "1860",
    type: "Painting",
    medium: "Óleo sobre tela",
    dimensions: "101.6 x 162.6 cm",
    url: "https://clevelandart.org/art/1965.233",
    img: "https://openaccess-cdn.clevelandart.org/1965.233/1965.233_web.jpg",
  },
  {
    id: 135238,
    title: "Paul Lafond and Alphonse Cherfils Examining a Painting",
    artist: "Edgar Degas",
    year: "c. 1878–80",
    type: "Painting",
    medium: "Óleo sobre tela",
    dimensions: null,
    url: "https://clevelandart.org/art/1958.25",
    img: "https://openaccess-cdn.clevelandart.org/1958.25/1958.25_web.jpg",
  },
  {
    id: 136911,
    title: "View of Florence",
    artist: "Thomas Cole",
    year: "1837",
    type: "Painting",
    medium: "Óleo sobre tela",
    dimensions: null,
    url: "https://clevelandart.org/art/1961.39",
    img: "https://openaccess-cdn.clevelandart.org/1961.39/1961.39_web.jpg",
  },
  {
    id: 110180,
    title: "The Race Track (Death on a Pale Horse)",
    artist: "Albert Pinkham Ryder",
    year: "c. 1896–1908",
    type: "Painting",
    medium: "Óleo sobre tela",
    dimensions: null,
    url: "https://clevelandart.org/art/1928.8",
    img: "https://openaccess-cdn.clevelandart.org/1928.8/1928.8_web.jpg",
  },
  {
    id: 102578,
    title: "Portrait of Dora Wheeler",
    artist: "William Merritt Chase",
    year: "1882–83",
    type: "Painting",
    medium: "Óleo sobre tela",
    dimensions: null,
    url: "https://clevelandart.org/art/1921.1239",
    img: "https://openaccess-cdn.clevelandart.org/1921.1239/1921.1239_web.jpg",
  },
  {
    id: 151904,
    title: "The Biglin Brothers Turning the Stake",
    artist: "Thomas Eakins",
    year: "1873",
    type: "Painting",
    medium: "Óleo sobre tela",
    dimensions: null,
    url: "https://clevelandart.org/art/1927.1984",
    img: "https://openaccess-cdn.clevelandart.org/1927.1984/1927.1984_web.jpg",
  },
];

function normalize(raw: ClevelandRaw): Artwork | null {
  const img = raw.images?.web?.url;
  if (!raw.title || !img) return null;
  const technique = raw.technique;
  return {
    id: raw.id,
    title: raw.title,
    artist: raw.creators?.[0]?.description?.split(" (")[0] ?? null,
    year: raw.creation_date ?? null,
    type: raw.type ?? null,
    medium: Array.isArray(technique) ? technique.join(", ") : (technique ?? null),
    dimensions: raw.measurements ? raw.measurements.slice(0, 160) : null,
    url: raw.url,
    img,
  };
}

async function fetchArtworks(): Promise<Artwork[]> {
  try {
    const res = await fetch(
      "https://openaccess-api.clevelandart.org/api/artworks/?q=painting&has_image=1&limit=6",
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data?: ClevelandRaw[] };
    const items = (json.data ?? []).map(normalize).filter((item): item is Artwork => item !== null);
    if (items.length < 5) throw new Error("poucos itens com imagem retornados");
    return items;
  } catch (error) {
    console.warn("API da Cleveland indisponível no momento — usando itens de fallback. Motivo:", error);
    return FALLBACK_ARTWORKS;
  }
}

function lotData(art: Artwork) {
  return {
    title: art.title,
    artist: art.artist,
    year: art.year,
    medium: art.medium,
    dimensions: art.dimensions,
    imageUrl: art.img,
    sourceUrl: art.url,
    externalId: String(art.id),
    sourceName: "cleveland",
    description: `${art.type ?? "Obra de arte"} · The Cleveland Museum of Art — Open Access (CC0)`,
  };
}

async function wipeDemoData(): Promise<void> {
  await prisma.receipt.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.walletTransaction.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.user.deleteMany();
}

interface BidEntry {
  bidderId: string;
  amount: number;
  at: Date;
}

async function createBidsWithChain(lotId: string, entries: BidEntry[]): Promise<void> {
  let prevHash: string | null = null;
  let seq = 0;
  for (const entry of entries) {
    seq += 1;
    const hash = computeBidHash({
      lotId,
      seq,
      amount: entry.amount,
      bidderId: entry.bidderId,
      createdAt: entry.at,
      prevHash,
    });
    await prisma.bid.create({
      data: {
        lotId,
        bidderId: entry.bidderId,
        amount: entry.amount,
        seq,
        prevHash,
        hash,
        createdAt: entry.at,
      },
    });
    prevHash = hash;
  }
}

async function main(): Promise<void> {
  console.log("Limpando dados de demonstração anteriores...");
  await wipeDemoData();

  const artworks = await fetchArtworks();

  const passwordHash = await bcrypt.hash("senha123", 10);

  const leiloeiro = await prisma.user.create({
    data: {
      email: "leiloeiro@demo.com",
      name: "Marina Leiloeira",
      passwordHash,
      role: "AUCTIONEER",
      alias: newAlias("Leiloeiro"),
      balance: 0,
    },
  });

  const licitante1 = await prisma.user.create({
    data: {
      email: "licitante1@demo.com",
      name: "Carlos Licita",
      passwordHash,
      role: "BIDDER",
      alias: newAlias("Licitante"),
      balance: 5000,
    },
  });

  const licitante2 = await prisma.user.create({
    data: {
      email: "licitante2@demo.com",
      name: "Beatriz Bela",
      passwordHash,
      role: "BIDDER",
      alias: newAlias("Licitante"),
      balance: 3000,
    },
  });

  await prisma.walletTransaction.createMany({
    data: [
      { userId: licitante1.id, type: "DEPOSIT", amount: 5000, note: "Depósito simulado (seed)" },
      { userId: licitante2.id, type: "DEPOSIT", amount: 3000, note: "Depósito simulado (seed)" },
    ],
  });

  const now = Date.now();
  const minutesFromNow = (minutes: number) => new Date(now + minutes * 60_000);

  // 1) Lote AO VIVO com lances abertos (disputa entre os dois licitantes)
  const liveLot = await prisma.lot.create({
    data: {
      sellerId: leiloeiro.id,
      status: "ACTIVE",
      ...lotData(artworks[0]!),
      startPrice: 500,
      increment: 50,
      startsAt: minutesFromNow(-5),
      endsAt: minutesFromNow(60),
    },
  });
  await createBidsWithChain(liveLot.id, [
    { bidderId: licitante1.id, amount: 500, at: minutesFromNow(-4) },
    { bidderId: licitante2.id, amount: 550, at: minutesFromNow(-3) },
    { bidderId: licitante1.id, amount: 600, at: minutesFromNow(-2) },
    { bidderId: licitante2.id, amount: 650, at: minutesFromNow(-1) },
  ]);

  // 2) Lote AGENDADO sem lances
  const scheduledLot = await prisma.lot.create({
    data: {
      sellerId: leiloeiro.id,
      status: "SCHEDULED",
      ...lotData(artworks[1]!),
      startPrice: 800,
      increment: 100,
      startsAt: minutesFromNow(120),
      endsAt: minutesFromNow(120 + 24 * 60),
    },
  });

  // 3) Lote ENCERRADO e liquidado (licitante 1 arrematou por 350)
  const closedLot = await prisma.lot.create({
    data: {
      sellerId: leiloeiro.id,
      status: "CLOSED",
      ...lotData(artworks[2]!),
      startPrice: 300,
      increment: 50,
      startsAt: minutesFromNow(-180),
      endsAt: minutesFromNow(-60),
    },
  });
  await createBidsWithChain(closedLot.id, [
    { bidderId: licitante2.id, amount: 300, at: minutesFromNow(-170) },
    { bidderId: licitante1.id, amount: 350, at: minutesFromNow(-165) },
  ]);
  await prisma.user.update({ where: { id: licitante1.id }, data: { balance: { decrement: 350 } } });
  await prisma.user.update({ where: { id: leiloeiro.id }, data: { balance: { increment: 350 } } });
  await prisma.walletTransaction.createMany({
    data: [
      { userId: licitante1.id, type: "LOT_DEBIT", amount: 350, lotId: closedLot.id, note: "Arremate" },
      { userId: leiloeiro.id, type: "LOT_CREDIT", amount: 350, lotId: closedLot.id, note: "Venda de lote" },
    ],
  });
  await prisma.receipt.create({
    data: {
      lotId: closedLot.id,
      winnerId: licitante1.id,
      sellerId: leiloeiro.id,
      amount: 350,
      token: randomUUID(),
    },
  });

  // 4) Lote ENCERRADO sem lances (fecha sem vencedor)
  await prisma.lot.create({
    data: {
      sellerId: leiloeiro.id,
      status: "CLOSED",
      ...lotData(artworks[3]!),
      startPrice: 1200,
      increment: 100,
      startsAt: minutesFromNow(-300),
      endsAt: minutesFromNow(-240),
    },
  });

  // 5) Lote CANCELADO (não aparece na vitrine)
  await prisma.lot.create({
    data: {
      sellerId: leiloeiro.id,
      status: "CANCELLED",
      ...lotData(artworks[4]!),
      startPrice: 900,
      increment: 50,
      startsAt: minutesFromNow(60),
      endsAt: minutesFromNow(60 + 24 * 60),
    },
  });

  console.log("");
  console.log("✔ Seed concluído!");
  console.log("");
  console.log("Contas de teste (senha para todas: senha123):");
  console.log(`  Leiloeiro  -> leiloeiro@demo.com   (alias ${leiloeiro.alias})`);
  console.log(`  Licitante 1-> licitante1@demo.com (saldo 4.650,00; alias ${licitante1.alias})`);
  console.log(`  Licitante 2-> licitante2@demo.com (saldo 3.000,00; comprometido 650,00; alias ${licitante2.alias})`);
  console.log("");
  console.log("Lotes:");
  console.log(`  AO VIVO     -> ${liveLot.title} (lance atual 650,00; fim em 60 min)`);
  console.log(`  AGENDADO    -> ${scheduledLot.title} (inicia em 2 h)`);
  console.log(`  ENCERRADO   -> ${closedLot.title} (arrematado por 350,00 pelo licitante1)`);
  console.log(`  SEM LANCES  -> (encerrado sem vencedor)`);
  console.log(`  CANCELADO   -> (oculto da vitrine)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
