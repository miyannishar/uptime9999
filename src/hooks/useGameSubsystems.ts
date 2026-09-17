// Pager, war room, status-page accuracy, stakeholders, post-mortems, achievements.
// Extracted from App so the component only renders. Every write goes through PATCH with an
// updater, so the several dispatches that land in one tick merge instead of clobbering.
import { useEffect, useRef } from 'react';
import { GameState } from '../sim/types';
import { GameAction } from '../sim/reducer';
import { STAKEHOLDERS, StakeholderMetrics } from '../data/stakeholders';
import { ACHIEVEMENTS, AchievementMetrics, persistAchievements } from '../data/achievements';
import { getScalingHint } from '../config/progressionConfig';
import { GAME_CONFIG } from '../config/gameConfig';

const CFG = GAME_CONFIG.subsystems;
const STATUS_LEVELS = ['operational', 'degraded', 'partial_outage', 'major_outage'];

type Dispatch = (a: GameAction) => void;

export function useGameSubsystems(state: GameState, dispatch: Dispatch) {
  const stateRef = useRef(state);
  const cooldowns = useRef(new Map<string, number>());
  const lowestReputation = useRef(100);
  const lastResolvedCount = useRef(0);

  stateRef.current = state;

  const reset = () => {
    cooldowns.current = new Map();
    lowestReputation.current = 100;
    lastResolvedCount.current = 0;
  };

  const active = state.aiSessionActive && !state.paused && !state.gameOver;

  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      const s = stateRef.current;
      if (s.paused || s.gameOver) return;
      const now = Date.now();
      const elapsed = (now - s.startTime) / 1000;
      const crits = s.activeIncidents.filter(i => i.severity === 'CRIT');
      const warns = s.activeIncidents.filter(i => i.severity === 'WARN').length;

      lowestReputation.current = Math.min(lowestReputation.current, s.reputation);

      const pushMessage = (character: string, icon: string, message: string, responses: Array<{ text: string; effect: string }>) =>
        dispatch({ type: 'PATCH', fn: c => ({
          stakeholderMessages: [...c.stakeholderMessages, {
            id: `sh_${now}_${character}`, character, icon, message, responses,
            timestamp: now, expiresAt: now + CFG.messageTtlMs,
          }],
        })});

      const pending = s.stakeholderMessages.filter(m => m.selectedResponse === undefined).length;

      // Stakeholder reactions to the current situation
      if (pending < CFG.maxPendingMessages) {
        const metrics: StakeholderMetrics = {
          reputation: s.reputation, uptime: s.uptime, cash: s.cash, revenue: s.revenue,
          costs: s.costs, critCount: crits.length, warnCount: warns,
          totalIncidents: s.totalIncidents, techDebt: s.techDebt, burnout: s.burnout,
          users: s.users, warRoomActive: s.warRoomActive, elapsedSeconds: elapsed,
        };
        for (const sh of STAKEHOLDERS) {
          if (now - (cooldowns.current.get(sh.id) ?? 0) < sh.cooldownMs) continue;
          if (!sh.triggerCondition(metrics)) continue;
          const { message, responses } = sh.generateMessage(metrics);
          cooldowns.current.set(sh.id, now);
          pushMessage(sh.character, sh.icon, message, responses);
          break; // one per tick; the rest stay eligible next tick
        }
      }

      // Nudge toward the next component the player should deploy
      const hint = getScalingHint(s.deployedComponents, s.users);
      if (hint?.stakeholderHint && s.lastScalingHintComponent !== hint.id && pending < CFG.maxPendingMessages) {
        const h = hint.stakeholderHint;
        dispatch({ type: 'PATCH', fn: c => ({
          lastScalingHintComponent: hint.id,
          stakeholderMessages: [...c.stakeholderMessages, {
            id: `hint_${now}_${hint.id}`, character: h.character, icon: h.icon, message: h.message,
            responses: [{ text: 'Good call — on it.', effect: 'none' }, { text: 'Later.', effect: 'none' }],
            timestamp: now, expiresAt: now + CFG.messageTtlMs,
          }],
        })});
      }

      // Pager
      if (!s.pagerActive && crits.length > 0) {
        const newest = crits.reduce((a, b) => (b.startTime > a.startTime ? b : a));
        dispatch({ type: 'PATCH', fn: () => ({
          pagerActive: true, pagerIncidentId: newest.id, pagerAcknowledged: false, pagerStartTime: now,
        })});
      } else if (s.pagerActive && crits.length === 0) {
        dispatch({ type: 'PATCH', fn: () => ({ pagerActive: false, pagerAcknowledged: false }) });
      } else if (s.pagerActive && !s.pagerAcknowledged && now - s.pagerStartTime > CFG.pagerTimeoutMs) {
        dispatch({ type: 'PATCH', fn: c => ({
          pagerActive: false, pagerAcknowledged: false,
          reputation: Math.max(0, c.reputation - CFG.pagerMissedRepPenalty),
          burnout: Math.min(100, c.burnout + CFG.pagerMissedBurnout),
        })});
      }

      // War room
      if (crits.length >= CFG.warRoomCritThreshold && !s.warRoomActive) {
        dispatch({ type: 'PATCH', fn: () => ({ warRoomActive: true, warRoomStartTime: now }) });
      } else if (crits.length < CFG.warRoomCritThreshold && s.warRoomActive) {
        dispatch({ type: 'PATCH', fn: c => ({
          warRoomActive: false, warRoomsSurvived: c.warRoomsSurvived + 1,
          reputation: Math.min(100, c.reputation + CFG.warRoomSurvivedRepBonus),
        })});
      }

      // Understating an outage on the status page costs trust
      const expected = crits.length >= 2 ? 'major_outage'
        : crits.length >= 1 ? 'partial_outage'
        : warns >= 2 ? 'degraded' : 'operational';
      if (elapsed > CFG.statusPageGraceSec && STATUS_LEVELS.indexOf(s.statusPageLevel) < STATUS_LEVELS.indexOf(expected) - 1) {
        dispatch({ type: 'PATCH', fn: c => ({ reputation: Math.max(0, c.reputation - CFG.statusPageUnderstatedPenalty) }) });
      }

      // Post-mortem after every third resolved incident, if the latest was critical
      if (s.resolvedIncidents > lastResolvedCount.current) {
        lastResolvedCount.current = s.resolvedIncidents;
        const latest = s.incidentHistory[s.incidentHistory.length - 1];
        if (s.resolvedIncidents % CFG.postMortemEveryNResolved === 0 && !s.postMortemQueue.length && latest?.severity === 'CRIT') {
          dispatch({ type: 'PATCH', fn: c => ({
            postMortemQueue: [...c.postMortemQueue, {
              incidentName: latest.name, severity: latest.severity, targetNode: latest.targetNode,
              startTime: latest.startTime, resolvedTime: latest.endTime,
              userImpact: c.users * CFG.postMortemUserImpactShare,
              revenueLost: (c.revenue * (latest.endTime - latest.startTime)) / 1000 * CFG.postMortemRevenueLostShare,
            }],
          })});
        }
      }

      // Achievements
      const am: AchievementMetrics = {
        uptime: s.uptime, uptimeStreak: s.uptimeStreak, reputation: s.reputation, cash: s.cash,
        users: s.users, resolvedIncidents: s.resolvedIncidents, totalIncidents: s.totalIncidents,
        warRoomsSurvived: s.warRoomsSurvived, postMortemsCompleted: s.postMortemsCompleted,
        techDebt: s.techDebt, elapsedSeconds: elapsed, activeIncidents: s.activeIncidents,
        appInstances: [...s.architecture.nodes.values()].filter(n => n.type === 'APP' && n.redundancyGroup === 'app_cluster').length,
        lowestReputation: lowestReputation.current, highestReputation: s.reputation,
      };
      const newlyUnlocked = ACHIEVEMENTS.filter(a => !s.achievements.has(a.id) && a.check(am));
      if (newlyUnlocked.length) {
        for (const a of newlyUnlocked) dispatch({ type: 'UNLOCK_ACHIEVEMENT', achievementId: a.id });
        persistAchievements(new Set([...s.achievements, ...newlyUnlocked.map(a => a.id)]));
      }

      // Ignoring a stakeholder has a cost
      const expiredCount = s.stakeholderMessages.filter(m => m.selectedResponse === undefined && m.expiresAt <= now).length;
      if (expiredCount > 0) {
        dispatch({ type: 'PATCH', fn: c => ({
          stakeholderMessages: c.stakeholderMessages.filter(m => m.selectedResponse !== undefined || m.expiresAt > now),
          reputation: Math.max(0, c.reputation - expiredCount * CFG.ignoredMessagePenalty),
        })});
      }
    }, CFG.tickMs);

    return () => clearInterval(id);
  }, [active, dispatch]);

  return reset;
}
