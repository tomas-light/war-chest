export interface GameWheelAction {
  enabled: boolean;
  id: 'deploy' | 'initiative' | 'maneuver' | 'pass' | 'recruit' | 'reinforce';
}
