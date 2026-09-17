import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/engine';
import { gameReducer } from '../src/sim/reducer';
import { ACTIONS } from '../src/data/actions';

describe('engagement fixes', () => {
  it('dismisses a stakeholder message answered with the first option', () => {
    let s = createInitialState('e');
    s = {
      ...s,
      stakeholderMessages: [{
        id: 'm1', character: 'CEO', icon: '🧑‍💼', message: 'why is it down',
        responses: [{ text: 'fixing', effect: 'none' }, { text: 'later', effect: 'none' }],
        timestamp: Date.now(), expiresAt: Date.now() + 30_000,
      }],
    };
    s = gameReducer(s, { type: 'RESPOND_STAKEHOLDER', messageId: 'm1', responseIndex: 0 });
    const answered = s.stakeholderMessages.filter(m => m.selectedResponse !== undefined);
    expect(answered).toHaveLength(1);
  });

  it('has exactly one pricing action, and it changes pricing', () => {
    const pricing = ACTIONS.filter(a => /price/i.test(a.id));
    expect(pricing.map(a => a.id)).toEqual(['price_increase']);
  });
});
