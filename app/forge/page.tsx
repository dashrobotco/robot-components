import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';

type ForgeComponent = {
  slug: string;
  name: string;
  description: string;
};

function loadComponents(): ForgeComponent[] {
  const forgeDir = path.join(process.cwd(), 'src', '_forge');
  if (!fs.existsSync(forgeDir)) return [];

  const entries = fs.readdirSync(forgeDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => {
      const metaPath = path.join(forgeDir, e.name, 'meta.json');
      let meta: Partial<ForgeComponent> = {};
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        } catch {}
      }
      return {
        slug: e.name,
        name: meta.name ?? e.name,
        description: meta.description ?? 'No description',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function ForgeGallery() {
  const components = loadComponents();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        gap: 32,
      }}
    >
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          className="btn-skin"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px #171717',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 20,
              height: 20,
              backgroundImage: 'url(/images/new-robot-logo.svg)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 500, marginBottom: 0, color: '#fff' }}>Forge</h1>
        <p style={{ color: '#737373', fontSize: 14 }}>Component playground</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 384 }}>
        {components.length === 0 ? (
          <div
            style={{
              padding: '24px 20px',
              backgroundColor: '#1a1a1a',
              borderRadius: 12,
              border: '1px dashed #333',
              color: '#737373',
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            No components yet. Drop a folder into <code style={{ color: '#a3a3a3' }}>src/_forge/</code> to get started.
          </div>
        ) : (
          components.map((component) => (
            <Link
              key={component.slug}
              href={`/forge/${component.slug}`}
              style={{
                display: 'block',
                padding: '16px 20px',
                backgroundColor: '#262626',
                borderRadius: 12,
                border: '1px solid #333',
                textDecoration: 'none',
                color: '#fff',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 15 }}>{component.name}</div>
              <div style={{ fontSize: 14, color: '#777', marginTop: 2 }}>{component.description}</div>
            </Link>
          ))
        )}
      </div>

      <p style={{ position: 'fixed', bottom: 24, fontSize: 13, color: '#525252' }}>
        <Link href="/" style={{ color: '#737373', textDecoration: 'none' }}>
          ← Back to public components
        </Link>
      </p>
    </div>
  );
}
