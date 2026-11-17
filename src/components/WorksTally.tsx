export function WorksTally({ yes, no, compact = false }: { yes: number; no: number; compact?: boolean }) {
  if (yes + no === 0) {
    return compact ? null : <span className="text-muted">No reports yet</span>;
  }
  if (compact) {
    return (
      <span className="text-xs">
        <span className="text-good">✓ {yes}</span>
        {no > 0 && <span className="text-bad"> ✗ {no}</span>}
      </span>
    );
  }
  return (
    <>
      <span className="text-good">✓ {yes} worked</span>
      {no > 0 && <span className="text-bad"> · ✗ {no} didn&apos;t</span>}
    </>
  );
}
