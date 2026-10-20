export type Team = 'EUA' | 'IRÃ' | 'EXTERNOS';
export type Delegate = { id: string; name: string; role_title: string; team: Team; active: boolean };
export type Session = { id: number; title: string; duration_minutes: number };
export type Criterion = { id: string; name: string; guidance: string | null; active: boolean; position: number };
export type Evaluation = { id: string; delegate_id: string; session_id: number; moment: number; notes: string | null; created_at: string; updated_at: string; created_by: string | null; delegate?: Delegate; evaluation_scores?: { criterion_id: string; score: number }[] };
