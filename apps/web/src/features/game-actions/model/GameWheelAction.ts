export interface GameWheelAction {
  enabled: boolean;
  id:
    | 'attack'
    | 'capture'
    | 'deploy'
    | 'initiative'
    | 'maneuver'
    | 'move'
    | 'pass'
    | 'recruit'
    | 'reinforce'
    | 'tactic';
}
