import { describe, it, expect } from 'vitest';
import { createMinimalArchitecture, deployComponent } from '../src/data/architecture';
import { COMPONENT_BLUEPRINTS } from '../src/config/progressionConfig';

function deploy(arch: ReturnType<typeof createMinimalArchitecture>, id: string) {
  const bp = COMPONENT_BLUEPRINTS.find(b => b.id === id)!;
  deployComponent(arch, id, bp.edges);
}

describe('deployment topology', () => {
  it('routes traffic through rlb instead of bypassing it', () => {
    const arch = createMinimalArchitecture();
    for (const id of ['cdn', 'waf', 'rlb']) deploy(arch, id);
    expect(arch.edges.some(e => e.to === 'rlb')).toBe(true);
    expect(arch.edges.some(e => e.from === 'waf' && e.to === 'app')).toBe(false);
  });

  it('does not double-route when glb is deployed', () => {
    const arch = createMinimalArchitecture();
    for (const id of ['cdn', 'waf', 'rlb', 'glb']) deploy(arch, id);
    expect(arch.edges.some(e => e.from === 'waf' && e.to === 'app')).toBe(false);
    const wafOut = arch.edges.filter(e => e.from === 'waf');
    expect(wafOut).toHaveLength(1);
    expect(wafOut[0].to).toBe('glb');
  });
});
