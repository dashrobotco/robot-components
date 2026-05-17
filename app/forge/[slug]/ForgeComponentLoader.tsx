'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

function MissingExport() {
  return (
    <div style={{ color: '#737373', fontSize: 14, textAlign: 'center', maxWidth: 420 }}>
      Couldn't load this component. Make sure <code style={{ color: '#a3a3a3' }}>src/_forge/&lt;slug&gt;/index.tsx</code>{' '}
      exists and has a default export.
    </div>
  );
}

export default function ForgeComponentLoader({ slug }: { slug: string }) {
  const Component = useMemo(
    () =>
      dynamic(
        () =>
          import(`../../../src/_forge/${slug}/index.tsx`).catch(() => ({
            default: MissingExport,
          })),
        { ssr: false }
      ),
    [slug]
  );

  return <Component />;
}
