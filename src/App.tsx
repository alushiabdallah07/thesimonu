
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Activity,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  Eye,
  History,
  LogOut,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Trophy,
  Users,
} from 'lucide-react';
import { supabase } from './lib/supabase';

type Team = 'EUA' | 'IRÃ';

type Delegate = {
  id: string;
  name: string;
  role_title: string;
  team: Team;
  active: boolean;
};

type Session = {
  id: number;
  title: string;
  duration_minutes: number;
};

type Criterion = {
  id: string;
  name: string;
  guidance: string;
  active: boolean;
  position: number;
};

type Evaluation = {
  id: string;
  delegate_id: string;
  session_id: number;
  moment: number;
  notes?: string;
  created_by?: string;
  scores: Record<string, number>;
};

type PublicData = {
  delegates: Delegate[];
  sessions: Session[];
  criteria: Criterion[];
  evaluations: Evaluation[];
};

type Page =
  | 'overview'
  | 'evaluations'
  | 'rankings'
  | 'history'
  | 'delegates';

const EMPTY_DATA: PublicData = {
  delegates: [],
  sessions: [],
  criteria: [],
  evaluations: [],
};

const DEFAULT_CRITERIA = [
  {
    name: 'Estratégia e qualidade das decisões',
    guidance: 'Avalie a lógica, a estratégia e a qualidade das decisões.',
  },
  {
    name: 'Coerência com a representação',
    guidance: 'Avalie a coerência com os interesses da representação.',
  },
  {
    name: 'Iniciativa e participação',
    guidance: 'Avalie a participação, iniciativa e contribuição.',
  },
  {
    name: 'Conhecimento do cenário',
    guidance: 'Avalie o domínio das informações e do contexto.',
  },
  {
    name: 'Diplomacia e articulação',
    guidance: 'Avalie a negociação, a comunicação e a articulação.',
  },
];

const MOMENTS = [
  { value: 1, label: '30 minutos' },
  { value: 2, label: '1 hora' },
  { value: 3, label: '1 hora e 30 minutos' },
  { value: 4, label: '2 horas' },
];

const styles = {
  app: {
    minHeight: '100vh',
    background: '#0b1020',
    color: '#f8fafc',
    fontFamily: 'Inter, system-ui, sans-serif',
  } as const,
  card: {
    background: '#151d31',
    border: '1px solid #29344b',
    borderRadius: 16,
    padding: 20,
  } as const,
  muted: { color: '#a5b4cc' } as const,
  button: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #34425d',
    background: '#202c45',
    color: '#fff',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  } as const,
  input: {
    width: '100%',
    padding: 11,
    borderRadius: 9,
    border: '1px solid #34425d',
    background: '#0d1528',
    color: '#fff',
    boxSizing: 'border-box' as const,
  },
};

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

function teamColor(team: Team) {
  return team === 'EUA' ? '#60a5fa' : '#f87171';
}

function scoreOf(evaluation: Evaluation, criteria: Criterion[]) {
  const values = criteria
    .filter((c) => evaluation.scores[c.id] !== undefined)
    .map((c) => Number(evaluation.scores[c.id]));
  return average(values);
}

function isPublicPath() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '');
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();
  return (
    path === '/publico' ||
    path.endsWith('/publico') ||
    hash === '#/publico' ||
    hash.includes('publico') ||
    search.includes('publico')
  );
}

function getDelegateStats(
  delegates: Delegate[],
  evaluations: Evaluation[],
  criteria: Criterion[],
  sessionId?: number,
  moment?: number,
  includeUnscored = false,
) {
  return delegates
    .map((delegate) => {
      const matching = evaluations.filter(
        (e) =>
          e.delegate_id === delegate.id &&
          (sessionId === undefined || e.session_id === sessionId) &&
          (moment === undefined || e.moment === moment),
      );

      const allScores = matching.flatMap((e) =>
        criteria
          .filter(
            (c) =>
              e.scores &&
              e.scores[c.id] !== undefined &&
              e.scores[c.id] !== null &&
              !isNaN(Number(e.scores[c.id])),
          )
          .map((c) => Number(e.scores[c.id])),
      );

      const avg = average(allScores);
      return {
        ...delegate,
        average: avg,
        evaluationsCount: matching.length,
        scoresCount: allScores.length,
        hasScores: allScores.length > 0,
      };
    })
    .filter((d) => (includeUnscored ? true : d.scoresCount > 0))
    .sort((a, b) => {
      if (a.hasScores && !b.hasScores) return -1;
      if (!a.hasScores && b.hasScores) return 1;
      return b.average - a.average || a.name.localeCompare(b.name);
    });
}

function rankBadge(index: number, hasScores = true) {
  if (!hasScores) return '—';
  if (index === 0) return '🥇 1º';
  if (index === 1) return '🥈 2º';
  if (index === 2) return '🥉 3º';
  return `${index + 1}º`;
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={styles.muted}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>{value}</div>
          <div style={{ ...styles.muted, fontSize: 12, marginTop: 5 }}>{detail}</div>
        </div>
        <div style={{ color: '#93c5fd' }}>{icon}</div>
      </div>
    </div>
  );
}

function TopThree({
  title,
  rows,
}: {
  title: string;
  rows: ReturnType<typeof getDelegateStats>;
}) {
  return (
    <section style={styles.card}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {rows.length === 0 ? (
        <p style={styles.muted}>Ainda não existem notas suficientes para este ranking.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.slice(0, 3).map((d, i) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                borderRadius: 12,
                background: i === 0 ? '#2a2b45' : '#10182b',
                border: `1px solid ${i === 0 ? '#a78bfa' : '#29344b'}`,
              }}
            >
              <span style={{ fontSize: 25, width: 35 }}>{rankBadge(i)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{d.name}</strong>
                <div style={{ ...styles.muted, fontSize: 12 }}>
                  {d.role_title} · {d.team}
                </div>
              </div>
              <strong style={{ color: '#c4b5fd', fontSize: 20 }}>
                {fmt(d.average)}
              </strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function BarChart({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number; color?: string }[];
}) {
  const max = Math.max(10, ...rows.map((r) => r.value));

  return (
    <section style={styles.card}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {!rows.length ? (
        <p style={styles.muted}>Os gráficos aparecerão quando houver avaliações.</p>
      ) : (
        <div style={{ display: 'grid', gap: 15 }}>
          {rows.map((r) => (
            <div key={r.label}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <span>{r.label}</span>
                <strong>{fmt(r.value)}</strong>
              </div>
              <div
                style={{
                  height: 12,
                  borderRadius: 20,
                  background: '#0b1020',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.max(0, Math.min(100, (r.value / max) * 100))}%`,
                    background: r.color || '#818cf8',
                    borderRadius: 20,
                    transition: 'width .4s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Podium({
  rows,
}: {
  rows: ReturnType<typeof getDelegateStats>;
}) {
  const scoredRows = rows.filter((r) => r.hasScores || r.scoresCount > 0);
  const podiumOrder = [1, 0, 2];
  const heights = [105, 145, 85];

  if (!scoredRows.length) {
    return (
      <div style={{ ...styles.card, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
        <h3 style={{ margin: '0 0 6px' }}>Pódio ao vivo da simulação</h3>
        <p style={{ ...styles.muted, margin: 0, fontSize: 13 }}>
          O pódio será gerado em tempo real assim que a Mesa Diretora registrar as primeiras avaliações.
        </p>
      </div>
    );
  }

  return (
    <div style={{ ...styles.card, padding: 24 }}>
      <h3 style={{ textAlign: 'center', marginTop: 0 }}>🏆 Pódio dos Líderes</h3>
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'center',
          gap: 12,
          minHeight: 220,
        }}
      >
        {podiumOrder.map((rank, position) => {
          const d = scoredRows[rank];
          if (!d) return <div key={position} style={{ flex: 1, maxWidth: 180 }} />;
          const height = heights[position];

          return (
            <div
              key={d.id}
              style={{
                flex: 1,
                maxWidth: 180,
                textAlign: 'center',
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: 26, marginBottom: 4 }}>{rankBadge(rank)}</div>
              <strong style={{ display: 'block', overflowWrap: 'anywhere', fontSize: 14 }}>
                {d.name}
              </strong>
              <div style={{ fontSize: 11, color: teamColor(d.team), fontWeight: 700 }}>
                {d.team === 'EUA' ? '🇺🇸 EUA' : '🇮🇷 IRÃ'}
              </div>
              <div style={{ color: '#c4b5fd', margin: '4px 0 10px', fontWeight: 800 }}>
                Média {fmt(d.average)}
              </div>
              <div
                style={{
                  height,
                  borderRadius: '12px 12px 0 0',
                  background:
                    rank === 0
                      ? 'linear-gradient(180deg, #fbbf24 0%, #b45309 100%)'
                      : rank === 1
                      ? 'linear-gradient(180deg, #cbd5e1 0%, #475569 100%)'
                      : 'linear-gradient(180deg, #fdba74 0%, #c2410c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#fff',
                  boxShadow: rank === 0 ? '0 0 25px rgba(251, 191, 36, 0.3)' : 'none',
                }}
              >
                {rank + 1}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<PublicData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [page, setPage] = useState<Page>('overview');
  const [publicMode, setPublicMode] = useState(isPublicPath);
  const [publicFilterTeam, setPublicFilterTeam] = useState<'ALL' | 'EUA' | 'IRÃ'>('ALL');
  const [publicFilterSession, setPublicFilterSession] = useState<'all' | number>('all');
  const [publicFilterMoment, setPublicFilterMoment] = useState<'all' | number>('all');
  const [publicSearch, setPublicSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const goToPublic = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      window.history.pushState(null, '', '/publico');
    } catch {
      window.location.hash = '#/publico';
    }
    setPublicMode(true);
  };

  const goToPrivate = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    try {
      window.history.pushState(null, '', '/');
    } catch {
      window.location.hash = '';
    }
    setPublicMode(false);
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);

  const [selectedDelegate, setSelectedDelegate] = useState('');
  const [selectedSession, setSelectedSession] = useState(1);
  const [selectedMoment, setSelectedMoment] = useState(1);
  const [notes, setNotes] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});

  const [filterSession, setFilterSession] = useState(1);
  const [filterMoment, setFilterMoment] = useState(1);
  const [historySession, setHistorySession] = useState('all');

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');

  const [showCriterionForm, setShowCriterionForm] = useState(false);
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [criterionName, setCriterionName] = useState('');
  const [criterionGuidance, setCriterionGuidance] = useState('');
  const [criterionActive, setCriterionActive] = useState(true);

  const [delegateName, setDelegateName] = useState('');
  const [delegateRole, setDelegateRole] = useState('');
  const [delegateTeam, setDelegateTeam] = useState<Team>('EUA');

  const activeDelegates = useMemo(
    () => data.delegates.filter((d) => d.active),
    [data.delegates],
  );

  const activeCriteria = useMemo(
    () => data.criteria.filter((c) => c.active),
    [data.criteria],
  );

  const selectedEval = useMemo(
    () =>
      data.evaluations.find(
        (e) =>
          e.delegate_id === selectedDelegate &&
          e.session_id === selectedSession &&
          e.moment === selectedMoment,
      ),
    [data.evaluations, selectedDelegate, selectedSession, selectedMoment],
  );

  const overallRanking = useMemo(
    () => getDelegateStats(activeDelegates, data.evaluations, activeCriteria),
    [activeDelegates, data.evaluations, activeCriteria],
  );

  const sessionRanking = useMemo(
    () =>
      getDelegateStats(
        activeDelegates,
        data.evaluations,
        activeCriteria,
        filterSession,
      ),
    [activeDelegates, data.evaluations, activeCriteria, filterSession],
  );

  const momentRanking = useMemo(
    () =>
      getDelegateStats(
        activeDelegates,
        data.evaluations,
        activeCriteria,
        filterSession,
        filterMoment,
      ),
    [
      activeDelegates,
      data.evaluations,
      activeCriteria,
      filterSession,
      filterMoment,
    ],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (publicMode) {
        const { data: publicData, error: publicError } = await supabase.rpc(
          'public_simonu_dashboard',
        );

        if (publicError) throw publicError;

        const rawData = (publicData as any) || {};
        const rawDelegates = Array.isArray(rawData.delegates) ? (rawData.delegates as Delegate[]) : [];
        const rawSessions = Array.isArray(rawData.sessions) ? (rawData.sessions as Session[]) : [];
        const rawCriteria = Array.isArray(rawData.criteria) ? (rawData.criteria as Criterion[]) : [];
        const rawEvaluations = Array.isArray(rawData.evaluations) ? rawData.evaluations : [];

        const normalizedEvaluations: Evaluation[] = rawEvaluations.map((e: any) => {
          let scores: Record<string, number> = {};

          if (e.scores && typeof e.scores === 'object' && !Array.isArray(e.scores)) {
            scores = e.scores;
          } else if (Array.isArray(e.evaluation_scores)) {
            for (const item of e.evaluation_scores) {
              if (item && item.criterion_id) {
                scores[item.criterion_id] = Number(item.score);
              }
            }
          } else if (Array.isArray(e.scores)) {
            for (const item of e.scores) {
              if (item && item.criterion_id) {
                scores[item.criterion_id] = Number(item.score);
              }
            }
          }

          return {
            id: String(e.id || ''),
            delegate_id: String(e.delegate_id || ''),
            session_id: Number(e.session_id || 1),
            moment: Number(e.moment || 1),
            notes: typeof e.notes === 'string' ? e.notes : '',
            created_by: e.created_by,
            scores,
          };
        });

        setData({
          delegates: rawDelegates,
          sessions: rawSessions,
          criteria: rawCriteria,
          evaluations: normalizedEvaluations,
        });
        setLastUpdated(new Date());
      } else {
        const [
          delegatesResult,
          sessionsResult,
          criteriaResult,
          evaluationsResult,
          scoresResult,
        ] = await Promise.all([
          supabase.from('delegates').select('*').order('name'),
          supabase.from('sessions').select('*').order('id'),
          supabase.from('evaluation_criteria').select('*').order('position'),
          supabase.from('evaluations').select('*').order('created_at', {
            ascending: false,
          }),
          supabase.from('evaluation_scores').select('*'),
        ]);

        const firstError = [
          delegatesResult.error,
          sessionsResult.error,
          criteriaResult.error,
          evaluationsResult.error,
          scoresResult.error,
        ].find(Boolean);

        if (firstError) throw firstError;

        const scoreMap: Record<string, Record<string, number>> = {};
        for (const row of scoresResult.data || []) {
          scoreMap[row.evaluation_id] ||= {};
          scoreMap[row.evaluation_id][row.criterion_id] = Number(row.score);
        }

        setData({
          delegates: (delegatesResult.data || []) as Delegate[],
          sessions: (sessionsResult.data || []) as Session[],
          criteria: (criteriaResult.data || []) as Criterion[],
          evaluations: (evaluationsResult.data || []).map((e: any) => ({
            ...e,
            scores: scoreMap[e.id] || {},
          })) as Evaluation[],
        });
        setLastUpdated(new Date());
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [publicMode]);

  useEffect(() => {
    const handleLocationChange = () => {
      setPublicMode(isPublicPath());
    };
    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('simonu-realtime-public-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evaluations' },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'evaluation_scores' },
        () => {
          void load();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'delegates' },
        () => {
          void load();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!mounted) return;
      setUser(sessionData.session?.user ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setRecoveryMode(_event === 'PASSWORD_RECOVERY');
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (publicMode || user) void load();
  }, [publicMode, user, load]);

  // Atualiza o painel público a cada 5 segundos.
  // Para eventos instantâneos, também é possível configurar Supabase Realtime.
  useEffect(() => {
    if (!publicMode) return;
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, [publicMode, load]);

  useEffect(() => {
    if (!selectedDelegate && activeDelegates.length) {
      setSelectedDelegate(activeDelegates[0].id);
    }
  }, [activeDelegates, selectedDelegate]);

  useEffect(() => {
    if (selectedEval) {
      setScores(selectedEval.scores || {});
      setNotes(selectedEval.notes || '');
    } else {
      setScores({});
      setNotes('');
    }
  }, [selectedEval]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) setError(signInError.message);
  }

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      resetEmail,
      {
        redirectTo: `${window.location.origin}/`,
      },
    );

    if (resetError) setError(resetError.message);
    else setMessage('Se o e-mail estiver cadastrado, você receberá um link de redefinição.');
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) setError(updateError.message);
    else {
      setRecoveryMode(false);
      setNewPassword('');
      setMessage('Senha atualizada com sucesso.');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
  }

  async function saveEvaluation(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!user) {
      setError('Faça login para registrar avaliações.');
      return;
    }

    if (!selectedDelegate || !selectedSession || !selectedMoment) {
      setError('Selecione o delegado, a sessão e o momento.');
      return;
    }

    if (!activeCriteria.length) {
      setError('Cadastre ou ative pelo menos um critério de avaliação.');
      return;
    }

    const missing = activeCriteria.filter(
      (criterion) => scores[criterion.id] === undefined,
    );

    if (missing.length) {
      setError(`Preencha todos os critérios. Falta: ${missing[0].name}.`);
      return;
    }

    try {
      let evaluationId = selectedEval?.id;

      if (evaluationId) {
        const { error: updateError } = await supabase
          .from('evaluations')
          .update({ notes: notes.trim() })
          .eq('id', evaluationId);

        if (updateError) throw updateError;
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('evaluations')
          .insert({
            delegate_id: selectedDelegate,
            session_id: selectedSession,
            moment: selectedMoment,
            notes: notes.trim(),
            created_by: user.id,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        evaluationId = inserted.id;
      }

      const rows = activeCriteria.map((criterion) => ({
        evaluation_id: evaluationId,
        criterion_id: criterion.id,
        score: Number(scores[criterion.id]),
      }));

      const { error: scoresError } = await supabase
        .from('evaluation_scores')
        .upsert(rows, {
          onConflict: 'evaluation_id,criterion_id',
        });

      if (scoresError) throw scoresError;

      await load();
      setMessage('Avaliação salva com sucesso!');
    } catch (err: any) {
      setError(
        `${err?.message || 'Não foi possível salvar.'} Verifique seu login e as políticas RLS do Supabase.`,
      );
    }
  }

  async function resetEvaluations() {
    setError('');
    setMessage('');

    if (resetConfirmation !== 'RESETAR') {
      setError('Digite RESETAR para confirmar a operação.');
      return;
    }

    try {
      const { data: rows, error: readError } = await supabase
        .from('evaluations')
        .select('id');

      if (readError) throw readError;

      const ids = (rows || []).map((row) => row.id);

      if (ids.length) {
        const { error: scoresDeleteError } = await supabase
          .from('evaluation_scores')
          .delete()
          .in('evaluation_id', ids);

        if (scoresDeleteError) throw scoresDeleteError;

        const { error: evaluationsDeleteError } = await supabase
          .from('evaluations')
          .delete()
          .in('id', ids);

        if (evaluationsDeleteError) throw evaluationsDeleteError;
      }

      setShowResetDialog(false);
      setResetConfirmation('');
      await load();
      setMessage('Avaliações resetadas. Delegados, sessões e critérios foram mantidos.');
    } catch (err: any) {
      setError(
        `${err?.message || 'Não foi possível resetar.'} Verifique as permissões RLS.`,
      );
    }
  }

  function startCriterionEdit(criterion?: Criterion) {
    setEditingCriterionId(criterion?.id || null);
    setCriterionName(criterion?.name || '');
    setCriterionGuidance(criterion?.guidance || '');
    setCriterionActive(criterion?.active ?? true);
    setShowCriterionForm(true);
  }

  async function saveCriterion(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const name = criterionName.trim();
    if (!name) {
      setError('Informe o nome do critério.');
      return;
    }

    try {
      const payload = {
        name,
        guidance: criterionGuidance.trim(),
        active: criterionActive,
      };

      const result = editingCriterionId
        ? await supabase
            .from('evaluation_criteria')
            .update(payload)
            .eq('id', editingCriterionId)
        : await supabase.from('evaluation_criteria').insert({
            ...payload,
            position: data.criteria.length + 1,
          });

      if (result.error) throw result.error;

      setShowCriterionForm(false);
      setEditingCriterionId(null);
      setCriterionName('');
      setCriterionGuidance('');
      await load();
      setMessage('Critério atualizado com sucesso.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o critério.');
    }
  }

  async function addDelegate(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!delegateName.trim() || !delegateRole.trim()) {
      setError('Preencha o nome e a representação.');
      return;
    }

    const { error: insertError } = await supabase.from('delegates').insert({
      name: delegateName.trim(),
      role_title: delegateRole.trim(),
      team: delegateTeam,
      active: true,
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDelegateName('');
    setDelegateRole('');
    await load();
    setMessage('Delegado cadastrado.');
  }

  async function toggleDelegate(delegate: Delegate) {
    const { error: updateError } = await supabase
      .from('delegates')
      .update({ active: !delegate.active })
      .eq('id', delegate.id);

    if (updateError) setError(updateError.message);
    else {
      await load();
      setMessage('Status do delegado atualizado.');
    }
  }

  function exportCSV() {
    const header = [
      'Delegado',
      'Representação',
      'Delegação',
      'Sessão',
      'Momento',
      ...activeCriteria.map((c) => c.name),
      'Média',
    ];

    const rows = data.evaluations.map((evaluation) => {
      const delegate = data.delegates.find((d) => d.id === evaluation.delegate_id);
      const session = data.sessions.find((s) => s.id === evaluation.session_id);

      return [
        delegate?.name || '',
        delegate?.role_title || '',
        delegate?.team || '',
        session?.title || evaluation.session_id,
        MOMENTS.find((m) => m.value === evaluation.moment)?.label || evaluation.moment,
        ...activeCriteria.map((c) => evaluation.scores[c.id] ?? ''),
        fmt(scoreOf(evaluation, activeCriteria)),
      ];
    });

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(';'),
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'simonu-avaliacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const currentMomentRanking = getDelegateStats(
    activeDelegates,
    data.evaluations,
    activeCriteria,
    filterSession,
    filterMoment,
  );

  const sessionChart = data.sessions.map((session) => {
    const ranking = getDelegateStats(
      activeDelegates,
      data.evaluations,
      activeCriteria,
      session.id,
    );

    return {
      label: session.title || `Sessão ${session.id}`,
      value: average(ranking.map((d) => d.average)),
      color: '#818cf8',
    };
  });

  const teamChart = (['EUA', 'IRÃ'] as Team[]).map((team) => {
    const members = overallRanking.filter((d) => d.team === team);
    return {
      label: team,
      value: average(members.map((d) => d.average)),
      color: teamColor(team),
    };
  });

  // Rankings e métricas específicas para o painel público em tempo real
  const publicRankingAll = useMemo(() => {
    const sId = publicFilterSession === 'all' ? undefined : Number(publicFilterSession);
    const mId = publicFilterMoment === 'all' ? undefined : Number(publicFilterMoment);
    const stats = getDelegateStats(
      activeDelegates,
      data.evaluations,
      activeCriteria,
      sId,
      mId,
      true, // garante que todos os delegados apareçam e a tela nunca fique vazia
    );

    return stats.filter((d) => {
      const matchTeam = publicFilterTeam === 'ALL' || d.team === publicFilterTeam;
      const q = publicSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.role_title.toLowerCase().includes(q) ||
        d.team.toLowerCase().includes(q);
      return matchTeam && matchSearch;
    });
  }, [
    activeDelegates,
    data.evaluations,
    activeCriteria,
    publicFilterSession,
    publicFilterMoment,
    publicFilterTeam,
    publicSearch,
  ]);

  const publicPodiumRows = useMemo(() => {
    const sId = publicFilterSession === 'all' ? undefined : Number(publicFilterSession);
    const mId = publicFilterMoment === 'all' ? undefined : Number(publicFilterMoment);
    return getDelegateStats(
      activeDelegates,
      data.evaluations,
      activeCriteria,
      sId,
      mId,
      false,
    );
  }, [
    activeDelegates,
    data.evaluations,
    activeCriteria,
    publicFilterSession,
    publicFilterMoment,
  ]);

  const scoredCount = useMemo(
    () => activeDelegates.filter((d) => data.evaluations.some((e) => e.delegate_id === d.id)).length,
    [activeDelegates, data.evaluations],
  );

  const euaDelegates = useMemo(() => activeDelegates.filter((d) => d.team === 'EUA'), [activeDelegates]);
  const iraDelegates = useMemo(() => activeDelegates.filter((d) => d.team === 'IRÃ'), [activeDelegates]);
  const publicLeader = publicPodiumRows[0] || null;

  if (publicMode) {
    return (
      <main style={styles.app}>
        <header
          style={{
            padding: '20px 4%',
            borderBottom: '1px solid #29344b',
            background: 'linear-gradient(180deg, #10182b 0%, #0b1020 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 8px 20px rgba(59, 130, 246, 0.3)',
              }}
            >
              <Trophy size={24} color="#fff" />
            </div>
            <div>
              <div
                style={{
                  color: '#38bdf8',
                  fontSize: 11,
                  letterSpacing: 2,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                SIMONU · TEATRO DE OPERAÇÕES 2027
              </div>
              <h1 style={{ margin: '3px 0 2px', fontSize: 24, fontWeight: 800 }}>
                Painel Público de Classificação
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#86efac',
                    background: '#052e1699',
                    border: '1px solid #166534',
                    padding: '3px 9px',
                    borderRadius: 20,
                  }}
                >
                  <span className="live-dot" />
                  AO VIVO · TEMPO REAL
                </span>
                <span style={{ ...styles.muted, fontSize: 12 }}>
                  Última sincronização: {lastUpdated.toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              style={{ ...styles.button, background: '#1e293b' }}
              onClick={() => void load()}
              title="Recarregar dados agora"
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
              Atualizar
            </button>
            <button
              style={{
                ...styles.button,
                background: 'linear-gradient(135deg, #312e81, #1e1b4b)',
                borderColor: '#4338ca',
                color: '#c7d2fe',
              }}
              onClick={goToPrivate}
              title="Acessar o centro de comando da Mesa Diretora"
            >
              <Shield size={15} />
              Acesso Mesa Diretora
            </button>
          </div>
        </header>

        <div style={{ padding: '24px 4%', display: 'grid', gap: 20 }}>
          {error && (
            <div
              style={{
                ...styles.card,
                borderColor: '#7f1d1d',
                background: '#450a0a55',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          )}

          {loading && !data.delegates.length ? (
            <div style={{ ...styles.card, textAlign: 'center', padding: 40 }}>
              <RefreshCw size={32} className="spin" style={{ color: '#60a5fa', margin: '0 auto 12px' }} />
              <p style={{ ...styles.muted, margin: 0 }}>Carregando dados da simulação em tempo real...</p>
            </div>
          ) : (
            <>
              {/* Cards de Métricas Principais */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
                  gap: 14,
                }}
              >
                <StatCard
                  label="Delegados Ativos"
                  value={activeDelegates.length}
                  detail={`${euaDelegates.length} EUA · ${iraDelegates.length} IRÃ`}
                  icon={<Users />}
                />
                <StatCard
                  label="Delegados Ranqueados"
                  value={scoredCount}
                  detail={`de ${activeDelegates.length} participantes`}
                  icon={<ClipboardCheck />}
                />
                <StatCard
                  label="Avaliações Registradas"
                  value={data.evaluations.length}
                  detail="Registros da Mesa Diretora"
                  icon={<Activity />}
                />
                <StatCard
                  label="Líder Geral"
                  value={publicLeader ? publicLeader.name : '—'}
                  detail={
                    publicLeader
                      ? `${publicLeader.team} · Média ${fmt(publicLeader.average)} / 10`
                      : 'Aguardando avaliações'
                  }
                  icon={<Crown />}
                />
              </div>

              {/* Pódio dos Líderes */}
              <Podium rows={publicPodiumRows} />

              {/* Top 3 Destaques */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
                  gap: 18,
                }}
              >
                <TopThree title="🥇 Top 3 Geral" rows={overallRanking} />
                <TopThree
                  title={`🔥 Top 3 da Sessão ${filterSession}`}
                  rows={sessionRanking}
                />
                <TopThree
                  title={`⚡ Top 3 do Momento ${filterMoment}`}
                  rows={currentMomentRanking}
                />
              </div>

              {/* Seção de Filtros e Busca */}
              <section
                style={{
                  ...styles.card,
                  background: '#131b2e',
                  border: '1px solid #23314d',
                  display: 'grid',
                  gap: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={18} color="#60a5fa" />
                    Rankings e Classificação ao Vivo
                  </h3>
                  <span style={{ ...styles.muted, fontSize: 12 }}>
                    Mostrando <strong>{publicRankingAll.length}</strong> de {activeDelegates.length} delegados
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                  }}
                >
                  {/* Filtro de Delegação */}
                  <div>
                    <label style={{ ...styles.muted, fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Delegação
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['ALL', 'EUA', 'IRÃ'] as const).map((team) => (
                        <button
                          key={team}
                          type="button"
                          onClick={() => setPublicFilterTeam(team)}
                          style={{
                            ...styles.button,
                            flex: 1,
                            padding: '8px 10px',
                            fontSize: 12,
                            fontWeight: publicFilterTeam === team ? 800 : 500,
                            background:
                              publicFilterTeam === team
                                ? team === 'EUA'
                                  ? '#1e3a8a'
                                  : team === 'IRÃ'
                                  ? '#831843'
                                  : '#4338ca'
                                : '#1a2234',
                            borderColor:
                              publicFilterTeam === team
                                ? team === 'EUA'
                                  ? '#3b82f6'
                                  : team === 'IRÃ'
                                  ? '#ec4899'
                                  : '#6366f1'
                                : '#2d3b55',
                          }}
                        >
                          {team === 'ALL' ? 'Todas' : team === 'EUA' ? '🇺🇸 EUA' : '🇮🇷 IRÃ'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filtro de Sessão */}
                  <div>
                    <label style={{ ...styles.muted, fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Sessão
                    </label>
                    <select
                      style={styles.input}
                      value={publicFilterSession}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPublicFilterSession(val === 'all' ? 'all' : Number(val));
                      }}
                    >
                      <option value="all">Todas as sessões (Geral)</option>
                      {data.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title || `Sessão ${s.id}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro de Momento */}
                  <div>
                    <label style={{ ...styles.muted, fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Momento da Sessão
                    </label>
                    <select
                      style={styles.input}
                      value={publicFilterMoment}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPublicFilterMoment(val === 'all' ? 'all' : Number(val));
                      }}
                    >
                      <option value="all">Todos os momentos</option>
                      {MOMENTS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Campo de Busca */}
                  <div>
                    <label style={{ ...styles.muted, fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Buscar delegado
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={{ ...styles.input, paddingRight: 32 }}
                        placeholder="Nome, cargo ou país..."
                        value={publicSearch}
                        onChange={(e) => setPublicSearch(e.target.value)}
                      />
                      {publicSearch && (
                        <button
                          type="button"
                          onClick={() => setPublicSearch('')}
                          style={{
                            position: 'absolute',
                            right: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: 4,
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Tabela de Classificação dos Delegados */}
              <section style={styles.card}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#94a3b8', textAlign: 'left', borderBottom: '2px solid #29344b' }}>
                        <th style={{ padding: '12px 14px', width: 90 }}>Posição</th>
                        <th style={{ padding: '12px 14px' }}>Delegado</th>
                        <th style={{ padding: '12px 14px' }}>Representação</th>
                        <th style={{ padding: '12px 14px', width: 110 }}>Delegação</th>
                        <th style={{ padding: '12px 14px', width: 120 }}>Avaliações</th>
                        <th style={{ padding: '12px 14px', width: 180 }}>Média / Desempenho</th>
                        <th style={{ padding: '12px 14px', width: 130 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {publicRankingAll.map((d) => {
                        const isRanked = d.hasScores;
                        const rankIdx = publicPodiumRows.findIndex((p) => p.id === d.id);
                        const rankLabel = isRanked && rankIdx >= 0 ? rankBadge(rankIdx) : '—';
                        const isTop1 = isRanked && rankIdx === 0;
                        const isTop2 = isRanked && rankIdx === 1;
                        const isTop3 = isRanked && rankIdx === 2;

                        return (
                          <tr
                            key={d.id}
                            style={{
                              borderTop: '1px solid #1f293d',
                              background: isTop1
                                ? 'rgba(234, 179, 8, 0.05)'
                                : isTop2
                                ? 'rgba(148, 163, 184, 0.04)'
                                : isTop3
                                ? 'rgba(249, 115, 22, 0.04)'
                                : 'transparent',
                              transition: 'background 0.2s',
                            }}
                          >
                            <td style={{ padding: '14px', fontWeight: 800, fontSize: 15 }}>
                              {rankLabel}
                            </td>
                            <td style={{ padding: '14px' }}>
                              <strong style={{ display: 'block', fontSize: 14 }}>
                                {d.name}
                              </strong>
                            </td>
                            <td style={{ padding: '14px', color: '#cbd5e1', fontSize: 13 }}>
                              {d.role_title}
                            </td>
                            <td style={{ padding: '14px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  background: d.team === 'EUA' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: d.team === 'EUA' ? '#93c5fd' : '#fca5a5',
                                  border: `1px solid ${d.team === 'EUA' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                                }}
                              >
                                {d.team === 'EUA' ? '🇺🇸 EUA' : '🇮🇷 IRÃ'}
                              </span>
                            </td>
                            <td style={{ padding: '14px', color: '#94a3b8', fontSize: 12 }}>
                              {d.evaluationsCount} {d.evaluationsCount === 1 ? 'nota' : 'notas'}
                            </td>
                            <td style={{ padding: '14px' }}>
                              {isRanked ? (
                                <div>
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: 4,
                                    }}
                                  >
                                    <span style={{ fontWeight: 800, fontSize: 14, color: '#f8fafc' }}>
                                      {fmt(d.average)}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#64748b' }}>/ 10</span>
                                  </div>
                                  <div
                                    style={{
                                      height: 6,
                                      borderRadius: 4,
                                      background: '#0b1020',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        height: '100%',
                                        width: `${Math.max(0, Math.min(100, (d.average / 10) * 100))}%`,
                                        background:
                                          d.average >= 8
                                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                                            : d.average >= 6
                                            ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                                            : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                                        borderRadius: 4,
                                      }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span style={{ color: '#64748b', fontSize: 12, fontStyle: 'italic' }}>
                                  Aguardando avaliação
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px' }}>
                              {isTop1 ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#fde047',
                                    background: 'rgba(234, 179, 8, 0.15)',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(234, 179, 8, 0.4)',
                                  }}
                                >
                                  Líder Geral
                                </span>
                              ) : isTop2 || isTop3 ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: '#a5b4fc',
                                    background: 'rgba(99, 102, 241, 0.15)',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                    border: '1px solid rgba(99, 102, 241, 0.4)',
                                  }}
                                >
                                  Pódio
                                </span>
                              ) : isRanked ? (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#38bdf8',
                                    background: 'rgba(56, 189, 248, 0.1)',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                  }}
                                >
                                  Avaliado
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#64748b',
                                    background: 'rgba(100, 116, 139, 0.1)',
                                    padding: '3px 8px',
                                    borderRadius: 6,
                                  }}
                                >
                                  Pendente
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {publicRankingAll.length === 0 && (
                    <div style={{ padding: '30px 20px', textAlign: 'center', color: '#94a3b8' }}>
                      Nenhum delegado encontrado com os filtros selecionados.
                    </div>
                  )}
                </div>
              </section>

              {/* Gráficos Comparativos */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
                  gap: 18,
                }}
              >
                <BarChart title="Média de Desempenho por Sessão" rows={sessionChart} />
                <BarChart title="Comparação Entre Delegações (EUA vs IRÃ)" rows={teamChart} />
              </div>

              {/* Rodapé Informativo */}
              <footer
                style={{
                  ...styles.muted,
                  fontSize: 12,
                  textAlign: 'center',
                  padding: '20px 0 10px',
                  borderTop: '1px solid #1e293b',
                  marginTop: 10,
                }}
              >
                <p style={{ margin: '0 0 6px', fontWeight: 600 }}>
                  SIMONU 2027 · Sistema Oficial de Avaliação e Rankings em Tempo Real
                </p>
                <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>
                  Dados sincronizados via Supabase Realtime e atualizados a cada 5 segundos · Notas registradas exclusivamente pela Mesa Diretora.
                </p>
              </footer>
            </>
          )}
        </div>
      </main>
    );
  }

  if (authLoading) {
    return <main style={{ ...styles.app, padding: 40 }}>Carregando SIMONU...</main>;
  }

  if (recoveryMode) {
    return (
      <main className="auth-screen">
        <style>{`
        .auth-screen{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);background:#0b1020;color:#f8fafc;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .auth-art{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;gap:32px;padding:clamp(28px,5vw,72px);background:radial-gradient(ellipse at 20% 15%,rgba(99,102,241,.24),transparent 42%),radial-gradient(ellipse at 80% 85%,rgba(14,165,233,.14),transparent 38%),linear-gradient(145deg,#111a30 0%,#0b1020 72%);border-right:1px solid #29344b}
        .auth-art:before{content:"";position:absolute;width:420px;height:420px;border:1px solid rgba(129,140,248,.15);border-radius:50%;right:-170px;top:18%;box-shadow:0 0 0 45px rgba(129,140,248,.025),0 0 0 90px rgba(129,140,248,.02)}
        .auth-art>*{position:relative;z-index:1}
        .auth-logo{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:900;letter-spacing:1.8px}
        .auth-logo-mark{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#0ea5e9);box-shadow:0 10px 30px #4f46e533}
        .auth-eyebrow{font-size:11px;letter-spacing:2.2px;font-weight:800;color:#a5b4fc;margin:0 0 18px}
        .auth-art h1{font-size:clamp(36px,4vw,60px);line-height:1.08;letter-spacing:-1.8px;margin:0;max-width:620px}
        .auth-description{color:#a5b4cc;font-size:16px;line-height:1.8;max-width:510px;margin-top:22px}
        .auth-stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
        .auth-stat{display:flex;align-items:center;gap:9px;border:1px solid #34425d;background:#151d31aa;border-radius:12px;padding:12px 14px;color:#dbeafe;font-size:12px}
        .auth-foot{color:#65758f;font-size:10px;letter-spacing:1.5px}
        .auth-form-side{display:flex;align-items:center;justify-content:center;padding:clamp(24px,5vw,64px);background:linear-gradient(160deg,#0d1425,#0b1020)}
        .auth-form{width:100%;max-width:430px}
        .auth-mobile-logo{display:none;margin-bottom:30px}
        .auth-form h2{font-size:30px;letter-spacing:-.8px;margin:0 0 10px}
        .auth-muted{color:#91a0ba;line-height:1.7;font-size:14px;margin:0 0 28px}
        .auth-field{display:block;color:#dbe4f4;font-size:13px;font-weight:650;margin-bottom:18px}
        .auth-field input{display:block;box-sizing:border-box;width:100%;margin-top:9px;padding:14px 15px;border:1px solid #34425d;border-radius:11px;background:#0a1120;color:#f8fafc;font:inherit;outline:none;transition:border .2s,box-shadow .2s}
        .auth-field input:focus{border-color:#818cf8;box-shadow:0 0 0 3px #818cf826}
        .auth-primary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid #6366f1;border-radius:11px;padding:14px 16px;background:linear-gradient(100deg,#4f46e5,#6366f1);color:white;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 12px 30px #4f46e526}
        .auth-secondary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid #34425d;border-radius:11px;padding:12px 16px;margin-top:9px;background:#151d31;color:#c7d2fe;font-size:13px;cursor:pointer}
        .auth-alert{border:1px solid;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;margin-bottom:18px;overflow-wrap:anywhere}
        .auth-error{border-color:#7f1d1d;background:#450a0a55;color:#fca5a5}
        .auth-success{border-color:#166534;background:#052e1655;color:#86efac}
        .auth-public{display:inline-flex;align-items:center;gap:7px;margin-top:22px;color:#93c5fd;font-size:12px;text-decoration:none}
        @media(max-width:820px){.auth-screen{grid-template-columns:1fr}.auth-art{display:none}.auth-form-side{min-height:100vh;padding:28px 22px}.auth-mobile-logo{display:flex}.auth-form h2{font-size:27px}}
`}</style>
        <section className="auth-art">
          <div className="auth-logo"><span className="auth-logo-mark"><Shield size={25} /></span><span>SIMONU</span></div>
          <div>
            <p className="auth-eyebrow">RECUPERAÇÃO DE ACESSO</p>
            <h1>Uma nova senha. O debate continua.</h1>
            <p className="auth-description">Crie uma nova senha para voltar ao centro de comando da Mesa Diretora e continuar acompanhando a simulação.</p>
          </div>
          <small className="auth-foot">SIMONU · SIMULAÇÃO ACADÊMICA FICTÍCIA</small>
        </section>
        <section className="auth-form-side">
          <form className="auth-form" onSubmit={updatePassword}>
            <div className="auth-logo auth-mobile-logo"><span className="auth-logo-mark"><Shield size={23} /></span><span>SIMONU</span></div>
            <p className="auth-eyebrow">SEGURANÇA DA CONTA</p>
            <h2>Definir nova senha</h2>
            <p className="auth-muted">Digite sua nova senha para continuar.</p>
            {error && <div className="auth-alert auth-error">{error}</div>}
            {message && <div className="auth-alert auth-success">{message}</div>}
            <label className="auth-field">Nova senha
              <input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Nova senha (mínimo 8 caracteres)" />
            </label>
            <button className="auth-primary" type="submit"><CheckCircle2 size={17} /> Atualizar senha</button>
          </form>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <style>{`
        .auth-screen{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);background:#0b1020;color:#f8fafc;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .auth-art{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;gap:32px;padding:clamp(28px,5vw,72px);background:radial-gradient(ellipse at 20% 15%,rgba(99,102,241,.24),transparent 42%),radial-gradient(ellipse at 80% 85%,rgba(14,165,233,.14),transparent 38%),linear-gradient(145deg,#111a30 0%,#0b1020 72%);border-right:1px solid #29344b}
        .auth-art:before{content:"";position:absolute;width:420px;height:420px;border:1px solid rgba(129,140,248,.15);border-radius:50%;right:-170px;top:18%;box-shadow:0 0 0 45px rgba(129,140,248,.025),0 0 0 90px rgba(129,140,248,.02)}
        .auth-art>*{position:relative;z-index:1}
        .auth-logo{display:flex;align-items:center;gap:12px;font-size:20px;font-weight:900;letter-spacing:1.8px}
        .auth-logo-mark{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,#6366f1,#0ea5e9);box-shadow:0 10px 30px #4f46e533}
        .auth-eyebrow{font-size:11px;letter-spacing:2.2px;font-weight:800;color:#a5b4fc;margin:0 0 18px}
        .auth-art h1{font-size:clamp(36px,4vw,60px);line-height:1.08;letter-spacing:-1.8px;margin:0;max-width:620px}
        .auth-description{color:#a5b4cc;font-size:16px;line-height:1.8;max-width:510px;margin-top:22px}
        .auth-stats{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}
        .auth-stat{display:flex;align-items:center;gap:9px;border:1px solid #34425d;background:#151d31aa;border-radius:12px;padding:12px 14px;color:#dbeafe;font-size:12px}
        .auth-foot{color:#65758f;font-size:10px;letter-spacing:1.5px}
        .auth-form-side{display:flex;align-items:center;justify-content:center;padding:clamp(24px,5vw,64px);background:linear-gradient(160deg,#0d1425,#0b1020)}
        .auth-form{width:100%;max-width:430px}
        .auth-mobile-logo{display:none;margin-bottom:30px}
        .auth-form h2{font-size:30px;letter-spacing:-.8px;margin:0 0 10px}
        .auth-muted{color:#91a0ba;line-height:1.7;font-size:14px;margin:0 0 28px}
        .auth-field{display:block;color:#dbe4f4;font-size:13px;font-weight:650;margin-bottom:18px}
        .auth-field input{display:block;box-sizing:border-box;width:100%;margin-top:9px;padding:14px 15px;border:1px solid #34425d;border-radius:11px;background:#0a1120;color:#f8fafc;font:inherit;outline:none;transition:border .2s,box-shadow .2s}
        .auth-field input:focus{border-color:#818cf8;box-shadow:0 0 0 3px #818cf826}
        .auth-primary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid #6366f1;border-radius:11px;padding:14px 16px;background:linear-gradient(100deg,#4f46e5,#6366f1);color:white;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 12px 30px #4f46e526}
        .auth-secondary{width:100%;display:flex;align-items:center;justify-content:center;gap:9px;border:1px solid #34425d;border-radius:11px;padding:12px 16px;margin-top:9px;background:#151d31;color:#c7d2fe;font-size:13px;cursor:pointer}
        .auth-alert{border:1px solid;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.5;margin-bottom:18px;overflow-wrap:anywhere}
        .auth-error{border-color:#7f1d1d;background:#450a0a55;color:#fca5a5}
        .auth-success{border-color:#166534;background:#052e1655;color:#86efac}
        .auth-public{display:inline-flex;align-items:center;gap:7px;margin-top:22px;color:#93c5fd;font-size:12px;text-decoration:none}
        @media(max-width:820px){.auth-screen{grid-template-columns:1fr}.auth-art{display:none}.auth-form-side{min-height:100vh;padding:28px 22px}.auth-mobile-logo{display:flex}.auth-form h2{font-size:27px}}
`}</style>
        <section className="auth-art">
          <div className="auth-logo"><span className="auth-logo-mark"><Shield size={25} /></span><span>SIMONU</span></div>
          <div>
            <p className="auth-eyebrow">TEATRO DE OPERAÇÕES · 2027</p>
            <h1>Centro de comando da Mesa Diretora.</h1>
            <p className="auth-description">Registre avaliações, acompanhe os rankings e mantenha o histórico do debate em um único lugar.</p>
            <div className="auth-stats">
              <div className="auth-stat"><Users size={17} /> 20 representações</div>
              <div className="auth-stat"><Activity size={17} /> 5 sessões · 20 checkpoints</div>
            </div>
          </div>
          <small className="auth-foot">SIMONU · SIMULAÇÃO ACADÊMICA FICTÍCIA</small>
        </section>
        <section className="auth-form-side">
          <div className="auth-form">
            <div className="auth-logo auth-mobile-logo"><span className="auth-logo-mark"><Shield size={23} /></span><span>SIMONU</span></div>
            {resetEmail ? (
              <form onSubmit={requestPasswordReset}>
                <p className="auth-eyebrow">RECUPERAÇÃO DE ACESSO</p>
                <h2>Recupere sua senha</h2>
                <p className="auth-muted">Informe o e-mail da sua conta. Você receberá um link para redefinir sua senha, se o endereço estiver cadastrado.</p>
                {error && <div className="auth-alert auth-error">{error}</div>}
                {message && <div className="auth-alert auth-success">{message}</div>}
                <label className="auth-field">E-mail
                  <input type="email" autoComplete="email" required value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="voce@exemplo.com" />
                </label>
                <button className="auth-primary" type="submit"><RefreshCw size={16} /> Enviar link de recuperação</button>
                <button className="auth-secondary" type="button" onClick={() => { setResetEmail(''); setError(''); setMessage(''); }}>Voltar ao login</button>
              </form>
            ) : (
              <form onSubmit={signIn}>
                <p className="auth-eyebrow">ACESSO RESTRITO</p>
                <h2>Entrar na plataforma</h2>
                <p className="auth-muted">Use o e-mail e a senha de um usuário autorizado para acessar o centro de comando.</p>
                {error && <div className="auth-alert auth-error">{error}</div>}
                {message && <div className="auth-alert auth-success">{message}</div>}
                <label className="auth-field">E-mail
                  <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mesa@exemplo.com" />
                </label>
                <label className="auth-field">Senha
                  <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" />
                </label>
                <button className="auth-primary" type="submit"><Shield size={17} /> Entrar na plataforma</button>
                <button className="auth-secondary" type="button" onClick={() => { setResetEmail(email); setError(''); setMessage(''); }}>Esqueci minha senha</button>
              </form>
            )}
            <a className="auth-public" href="/publico" onClick={goToPublic}><Eye size={15} /> Abrir painel público ao vivo</a>
          </div>
        </section>
      </main>
    );
  }

  const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Visão geral', icon: <Activity size={17} /> },
    { id: 'evaluations', label: 'Avaliações', icon: <ClipboardCheck size={17} /> },
    { id: 'rankings', label: 'Rankings e gráficos', icon: <BarChart3 size={17} /> },
    { id: 'history', label: 'Histórico', icon: <History size={17} /> },
    { id: 'delegates', label: 'Delegados e critérios', icon: <Users size={17} /> },
  ];

  return (
    <main style={styles.app}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 15,
          padding: '22px 4%',
          borderBottom: '1px solid #29344b',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#a5b4cc', letterSpacing: 2 }}>SIMONU</div>
          <h1 style={{ margin: '5px 0' }}>Painel da Mesa Diretora</h1>
          <div style={{ ...styles.muted, fontSize: 12 }}>{user.email}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/publico" onClick={goToPublic} style={{ ...styles.button, textDecoration: 'none' }}>
            <Eye size={16} /> Painel público
          </a>
          <button style={styles.button} onClick={() => void load()}>
            <RefreshCw size={16} /> Atualizar
          </button>
          <button style={styles.button} onClick={() => void signOut()}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px minmax(0,1fr)',
          gap: 20,
          padding: '24px 4%',
        }}
      >
        <nav style={{ ...styles.card, alignSelf: 'start', display: 'grid', gap: 8 }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              style={{
                ...styles.button,
                justifyContent: 'flex-start',
                background: page === item.id ? '#4338ca' : '#202c45',
              }}
              onClick={() => setPage(item.id)}
            >
              {item.icon} {item.label}
            </button>
          ))}
          <div style={{ borderTop: '1px solid #29344b', marginTop: 10, paddingTop: 10 }}>
            <button
              style={{ ...styles.button, width: '100%', color: '#fca5a5' }}
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw size={16} /> Resetar avaliações
            </button>
          </div>
        </nav>

        <section style={{ minWidth: 0, display: 'grid', gap: 18 }}>
          {message && (
            <div style={{ ...styles.card, borderColor: '#166534', color: '#86efac' }}>
              <CheckCircle2 size={16} style={{ verticalAlign: 'middle' }} /> {message}
            </div>
          )}
          {error && (
            <div style={{ ...styles.card, borderColor: '#7f1d1d', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {loading && <p style={styles.muted}>Atualizando os dados...</p>}

          {page === 'overview' && (
            <>
              <div>
                <h2>Visão geral</h2>
                <p style={styles.muted}>Acompanhe a simulação e os indicadores principais.</p>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))',
                  gap: 14,
                }}
              >
                <StatCard
                  label="Delegados ativos"
                  value={activeDelegates.length}
                  detail="Participantes cadastrados"
                  icon={<Users />}
                />
                <StatCard
                  label="Avaliações"
                  value={data.evaluations.length}
                  detail="Sessão e momento registrados"
                  icon={<ClipboardCheck />}
                />
                <StatCard
                  label="Critérios ativos"
                  value={activeCriteria.length}
                  detail="Itens utilizados nas notas"
                  icon={<Shield />}
                />
                <StatCard
                  label="Líder geral"
                  value={overallRanking[0]?.name || '—'}
                  detail={
                    overallRanking[0]
                      ? `Média ${fmt(overallRanking[0].average)}`
                      : 'Sem notas registradas'
                  }
                  icon={<Crown />}
                />
              </div>
              <Podium rows={overallRanking} />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
                  gap: 16,
                }}
              >
                <TopThree title="Top 3 geral" rows={overallRanking} />
                <TopThree title="Top 3 da sessão" rows={sessionRanking} />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
                  gap: 16,
                }}
              >
                <BarChart title="Média por sessão" rows={sessionChart} />
                <BarChart title="Média por delegação" rows={teamChart} />
              </div>
            </>
          )}

          {page === 'evaluations' && (
            <>
              <div>
                <h2>Registrar avaliação</h2>
                <p style={styles.muted}>
                  Cada avaliação é identificada por delegado, sessão e momento.
                </p>
              </div>
              <form onSubmit={saveEvaluation} style={{ ...styles.card, display: 'grid', gap: 16 }}>
                <label>
                  Delegado
                  <select
                    style={{ ...styles.input, marginTop: 6 }}
                    required
                    value={selectedDelegate}
                    onChange={(e) => setSelectedDelegate(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {activeDelegates.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} — {d.role_title} ({d.team})
                      </option>
                    ))}
                  </select>
                </label>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))',
                    gap: 12,
                  }}
                >
                  <label>
                    Sessão
                    <select
                      style={{ ...styles.input, marginTop: 6 }}
                      value={selectedSession}
                      onChange={(e) => setSelectedSession(Number(e.target.value))}
                    >
                      {data.sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title || `Sessão ${s.id}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Momento
                    <select
                      style={{ ...styles.input, marginTop: 6 }}
                      value={selectedMoment}
                      onChange={(e) => setSelectedMoment(Number(e.target.value))}
                    >
                      {MOMENTS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedEval && (
                  <div style={{ color: '#fcd34d', fontSize: 13 }}>
                    Esta avaliação já existe. Ao salvar, suas notas serão atualizadas.
                  </div>
                )}

                {activeCriteria.map((criterion) => (
                  <label
                    key={criterion.id}
                    style={{
                      ...styles.card,
                      background: '#10182b',
                      display: 'grid',
                      gap: 8,
                    }}
                  >
                    <strong>{criterion.name}</strong>
                    {criterion.guidance && (
                      <span style={{ ...styles.muted, fontSize: 12 }}>
                        {criterion.guidance}
                      </span>
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(11,minmax(0,1fr))',
                        gap: 4,
                      }}
                    >
                      {Array.from({ length: 21 }, (_, i) => i / 2).map((score) => (
                        <button
                          key={score}
                          type="button"
                          style={{
                            padding: '7px 0',
                            borderRadius: 6,
                            border: '1px solid #34425d',
                            background:
                              scores[criterion.id] === score ? '#4f46e5' : '#202c45',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: 11,
                          }}
                          onClick={() =>
                            setScores((current) => ({
                              ...current,
                              [criterion.id]: score,
                            }))
                          }
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                    <span style={{ color: '#c4b5fd', fontSize: 13 }}>
                      Nota: {scores[criterion.id] ?? 'não selecionada'} / 10
                    </span>
                  </label>
                ))}

                <label>
                  Observações privadas da Mesa
                  <textarea
                    style={{ ...styles.input, marginTop: 6, minHeight: 90 }}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Essas observações não aparecem no painel público."
                  />
                </label>

                <button style={{ ...styles.button, background: '#4338ca' }} type="submit">
                  <CheckCircle2 size={17} /> Salvar avaliação
                </button>
              </form>
            </>
          )}

          {page === 'rankings' && (
            <>
              <div>
                <h2>Rankings e gráficos</h2>
                <p style={styles.muted}>Compare os resultados gerais, por sessão e por momento.</p>
              </div>
              <div
                style={{
                  ...styles.card,
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <label>
                  Sessão
                  <select
                    style={{ ...styles.input, marginTop: 6 }}
                    value={filterSession}
                    onChange={(e) => setFilterSession(Number(e.target.value))}
                  >
                    {data.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || `Sessão ${s.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Momento
                  <select
                    style={{ ...styles.input, marginTop: 6 }}
                    value={filterMoment}
                    onChange={(e) => setFilterMoment(Number(e.target.value))}
                  >
                    {MOMENTS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Podium rows={momentRanking} />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))',
                  gap: 16,
                }}
              >
                <TopThree title="Top 3 geral" rows={overallRanking} />
                <TopThree title="Top 3 da sessão" rows={sessionRanking} />
                <TopThree title="Top 3 do momento" rows={momentRanking} />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(270px,1fr))',
                  gap: 16,
                }}
              >
                <BarChart title="Média por sessão" rows={sessionChart} />
                <BarChart title="Comparação entre delegações" rows={teamChart} />
              </div>
              <button style={styles.button} onClick={exportCSV}>
                <BarChart3 size={16} /> Exportar CSV
              </button>
            </>
          )}

          {page === 'history' && (
            <>
              <div>
                <h2>Histórico de avaliações</h2>
                <p style={styles.muted}>Consulte as avaliações registradas e exporte os dados.</p>
              </div>
              <div style={styles.card}>
                <label>
                  Filtrar sessão
                  <select
                    style={{ ...styles.input, marginTop: 6, maxWidth: 300 }}
                    value={historySession}
                    onChange={(e) => setHistorySession(e.target.value)}
                  >
                    <option value="all">Todas as sessões</option>
                    {data.sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title || `Sessão ${s.id}`}
                      </option>
                    ))}
                  </select>
                </label>
                <button style={{ ...styles.button, marginTop: 14 }} onClick={exportCSV}>
                  Exportar CSV
                </button>
                <div style={{ overflowX: 'auto', marginTop: 16 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: '#a5b4cc' }}>
                        <th style={{ padding: 10 }}>Delegado</th>
                        <th style={{ padding: 10 }}>Sessão</th>
                        <th style={{ padding: 10 }}>Momento</th>
                        <th style={{ padding: 10 }}>Média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.evaluations
                        .filter(
                          (e) =>
                            historySession === 'all' ||
                            e.session_id === Number(historySession),
                        )
                        .map((e) => {
                          const d = data.delegates.find((x) => x.id === e.delegate_id);
                          const s = data.sessions.find((x) => x.id === e.session_id);
                          return (
                            <tr key={e.id} style={{ borderTop: '1px solid #29344b' }}>
                              <td style={{ padding: 10 }}>{d?.name || 'Delegado removido'}</td>
                              <td style={{ padding: 10 }}>{s?.title || `Sessão ${e.session_id}`}</td>
                              <td style={{ padding: 10 }}>
                                {MOMENTS.find((m) => m.value === e.moment)?.label}
                              </td>
                              <td style={{ padding: 10 }}>
                                {fmt(scoreOf(e, activeCriteria))}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {page === 'delegates' && (
            <>
              <div>
                <h2>Delegados e critérios</h2>
                <p style={styles.muted}>Gerencie os participantes e configure a rubrica de avaliação.</p>
              </div>

              <form onSubmit={addDelegate} style={{ ...styles.card, display: 'grid', gap: 12 }}>
                <h3 style={{ marginTop: 0 }}>Cadastrar delegado</h3>
                <input
                  style={styles.input}
                  value={delegateName}
                  onChange={(e) => setDelegateName(e.target.value)}
                  placeholder="Nome do delegado"
                  required
                />
                <input
                  style={styles.input}
                  value={delegateRole}
                  onChange={(e) => setDelegateRole(e.target.value)}
                  placeholder="Representação (ex.: Estados Unidos)"
                  required
                />
                <select
                  style={styles.input}
                  value={delegateTeam}
                  onChange={(e) => setDelegateTeam(e.target.value as Team)}
                >
                  <option value="EUA">EUA</option>
                  <option value="IRÃ">IRÃ</option>
                </select>
                <button style={styles.button} type="submit">
                  <Plus size={16} /> Cadastrar delegado
                </button>
              </form>

              <section style={styles.card}>
                <h3 style={{ marginTop: 0 }}>Delegados cadastrados</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.delegates.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        flexWrap: 'wrap',
                        padding: 12,
                        border: '1px solid #29344b',
                        borderRadius: 10,
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <strong>{d.name}</strong>
                        <div style={styles.muted}>
                          {d.role_title} · {d.team}
                        </div>
                      </div>
                      <span style={{ color: d.active ? '#86efac' : '#fca5a5' }}>
                        {d.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <button style={styles.button} onClick={() => void toggleDelegate(d)}>
                        {d.active ? 'Desativar' : 'Reativar'}
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              <section style={styles.card}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>Critérios de avaliação</h3>
                    <p style={{ ...styles.muted, fontSize: 12 }}>
                      As notas continuam na escala de 0 a 10, em intervalos de 0,5.
                    </p>
                  </div>
                  <button style={styles.button} onClick={() => startCriterionEdit()}>
                    <Plus size={16} /> Novo critério
                  </button>
                </div>

                {showCriterionForm && (
                  <form
                    onSubmit={saveCriterion}
                    style={{
                      display: 'grid',
                      gap: 12,
                      padding: 14,
                      margin: '16px 0',
                      border: '1px solid #4338ca',
                      borderRadius: 12,
                    }}
                  >
                    <h4 style={{ margin: 0 }}>
                      {editingCriterionId ? 'Editar critério' : 'Novo critério'}
                    </h4>
                    <input
                      style={styles.input}
                      value={criterionName}
                      onChange={(e) => setCriterionName(e.target.value)}
                      placeholder="Nome do critério"
                      required
                    />
                    <textarea
                      style={{ ...styles.input, minHeight: 70 }}
                      value={criterionGuidance}
                      onChange={(e) => setCriterionGuidance(e.target.value)}
                      placeholder="Orientação para quem avalia"
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={criterionActive}
                        onChange={(e) => setCriterionActive(e.target.checked)}
                      />
                      Critério ativo
                    </label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button style={styles.button} type="submit">Salvar critério</button>
                      <button
                        style={styles.button}
                        type="button"
                        onClick={() => setShowCriterionForm(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                )}

                <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                  {data.criteria.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: 12,
                        border: '1px solid #29344b',
                        borderRadius: 10,
                        opacity: c.active ? 1 : 0.6,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'start',
                          gap: 12,
                        }}
                      >
                        <div>
                          <strong>{c.name}</strong>
                          <div style={{ ...styles.muted, fontSize: 12, marginTop: 5 }}>
                            {c.guidance || 'Sem orientação adicional.'}
                          </div>
                          <div style={{ fontSize: 12, marginTop: 5 }}>
                            {c.active ? 'Ativo' : 'Inativo'}
                          </div>
                        </div>
                        <button
                          style={styles.button}
                          onClick={() => startCriterionEdit(c)}
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </section>
      </div>

      {showResetDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000b',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            zIndex: 100,
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void resetEvaluations();
            }}
            style={{ ...styles.card, width: '100%', maxWidth: 460 }}
          >
            <h2 style={{ color: '#fca5a5', marginTop: 0 }}>
              <RotateCcw size={20} style={{ verticalAlign: 'middle' }} /> Resetar avaliações
            </h2>
            <p>
              Esta ação apagará todas as avaliações e suas notas. Os delegados,
              sessões e critérios serão mantidos. A operação não pode ser desfeita.
            </p>
            <p style={styles.muted}>
              Para confirmar, digite <strong>RESETAR</strong>.
            </p>
            <input
              style={styles.input}
              value={resetConfirmation}
              onChange={(e) => setResetConfirmation(e.target.value)}
              placeholder="Digite RESETAR"
              required
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button
                style={{ ...styles.button, background: '#991b1b', flex: 1 }}
                type="submit"
              >
                Confirmar reset
              </button>
              <button
                style={{ ...styles.button, flex: 1 }}
                type="button"
                onClick={() => {
                  setShowResetDialog(false);
                  setResetConfirmation('');
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
