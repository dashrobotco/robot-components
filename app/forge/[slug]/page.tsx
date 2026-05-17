import fs from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';
import ForgeStage from './ForgeStage';

export function generateStaticParams() {
  const forgeDir = path.join(process.cwd(), 'src', '_forge');
  if (!fs.existsSync(forgeDir)) return [];
  return fs
    .readdirSync(forgeDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => ({ slug: e.name }));
}

export default async function ForgeComponentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const componentDir = path.join(process.cwd(), 'src', '_forge', slug);
  if (!fs.existsSync(componentDir)) notFound();

  return <ForgeStage slug={slug} />;
}
