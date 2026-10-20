
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

function getDelegateStats(
  delegates: Delegate[],
  evaluations: Evaluation[],
  criteria: Criterion[],
  sessionId?: number,
  moment?: number,
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
          .filter((c) => e.scores[c.id] !== undefined)
          .map((c) => Number(e.scores[c.id])),
      );

      const avg = average(allScores);
      return {
        ...delegate,
        average: avg,
        evaluationsCount: matching.length,
        scoresCount: allScores.length,
      };
    })
    .filter((d) => d.scoresCount > 0)
    .sort((a, b) => b.average - a.average || a.name.localeCompare(b.name));
}

function rankBadge(index: number) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
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
  const podiumOrder = [1, 0, 2];
  const heights = [95, 135, 75];

  if (!rows.length) {
    return (
      <div style={{ ...styles.card, textAlign: 'center' }}>
        Ainda não há notas para montar o pódio.
      </div>
    );
  }

  return (
    <div style={{ ...styles.card, padding: 24 }}>
      <h3 style={{ textAlign: 'center', marginTop: 0 }}>🏆 Pódio do momento</h3>
      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          justifyContent: 'center',
          gap: 10,
          minHeight: 220,
        }}
      >
        {podiumOrder.map((rank, position) => {
          const d = rows[rank];
          if (!d) return <div key={position} style={{ flex: 1 }} />;
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
              <div style={{ fontSize: 25 }}>{rankBadge(rank)}</div>
              <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>
                {d.name}
              </strong>
              <div style={{ color: '#c4b5fd', margin: '5px 0 10px' }}>
                {fmt(d.average)}
              </div>
              <div
                style={{
                  height,
                  borderRadius: '12px 12px 0 0',
                  background:
                    rank === 0
                      ? 'linear-gradient(#a78bfa,#6d28d9)'
                      : rank === 1
                        ? 'linear-gradient(#94a3b8,#475569)'
                        : 'linear-gradient(#fdba74,#c2410c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 26,
                  fontWeight: 800,
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
  const [publicMode, setPublicMode] = useState(
    typeof window !== 'undefined' && window.location.pathname === '/publico',
  );

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
        setData((publicData as PublicData) || EMPTY_DATA);
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
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [publicMode]);

  useEffect(() => {
    const pathname = window.location.pathname;
    setPublicMode(pathname === '/publico');
  }, []);

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

  if (publicMode) {
    return (
      <main style={styles.app}>
        <header
          style={{
            padding: '25px 5%',
            borderBottom: '1px solid #29344b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ color: '#a5b4cc', fontSize: 12, letterSpacing: 2 }}>
              SIMONU · TEATRO DE OPERAÇÕES
            </div>
            <h1 style={{ margin: '8px 0' }}>Painel público ao vivo</h1>
            <p style={{ ...styles.muted, margin: 0 }}>
              Acompanhe a classificação e o desempenho das delegações.
            </p>
          </div>
          <button style={styles.button} onClick={() => void load()}>
            <RefreshCw size={16} /> Atualizar
          </button>
        </header>

        <div style={{ padding: '25px 5%', display: 'grid', gap: 20 }}>
          {error && (
            <div style={{ ...styles.card, borderColor: '#f87171', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {loading && !data.delegates.length ? (
            <p style={styles.muted}>Carregando os resultados...</p>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))',
                  gap: 15,
                }}
              >
                <StatCard
                  label="Delegados com notas"
                  value={overallRanking.length}
                  detail={`de ${activeDelegates.length} delegados ativos`}
                  icon={<Users />}
                />
                <StatCard
                  label="Avaliações registradas"
                  value={data.evaluations.length}
                  detail="Registros no sistema"
                  icon={<ClipboardCheck />}
                />
                <StatCard
                  label="Líder geral"
                  value={overallRanking[0]?.name || '—'}
                  detail={
                    overallRanking[0]
                      ? `Média ${fmt(overallRanking[0].average)} / 10`
                      : 'Aguardando avaliações'
                  }
                  icon={<Crown />}
                />
              </div>

              <Podium rows={overallRanking} />

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
                  gap: 18,
                }}
              >
                <TopThree title="🥇 Top 3 geral" rows={overallRanking} />
                <TopThree
                  title={`🔥 Top 3 da sessão ${filterSession}`}
                  rows={sessionRanking}
                />
                <TopThree
                  title={`⚡ Top 3 do momento ${filterMoment}`}
                  rows={currentMomentRanking}
                />
              </div>

              <section style={styles.card}>
                <h3 style={{ marginTop: 0 }}>Filtros do ranking</h3>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <label>
                    <span style={{ ...styles.muted, display: 'block', marginBottom: 6 }}>
                      Sessão
                    </span>
                    <select
                      style={styles.input}
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
                    <span style={{ ...styles.muted, display: 'block', marginBottom: 6 }}>
                      Momento
                    </span>
                    <select
                      style={styles.input}
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
              </section>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))',
                  gap: 18,
                }}
              >
                <BarChart title="Média por sessão" rows={sessionChart} />
                <BarChart title="Comparação entre delegações" rows={teamChart} />
              </div>

              <section style={styles.card}>
                <h3 style={{ marginTop: 0 }}>Classificação geral</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#a5b4cc', textAlign: 'left' }}>
                        <th style={{ padding: 10 }}>Posição</th>
                        <th style={{ padding: 10 }}>Delegado</th>
                        <th style={{ padding: 10 }}>Representação</th>
                        <th style={{ padding: 10 }}>Delegação</th>
                        <th style={{ padding: 10 }}>Média</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overallRanking.map((d, i) => (
                        <tr key={d.id} style={{ borderTop: '1px solid #29344b' }}>
                          <td style={{ padding: 10 }}>{rankBadge(i)}</td>
                          <td style={{ padding: 10 }}>{d.name}</td>
                          <td style={{ padding: 10 }}>{d.role_title}</td>
                          <td style={{ padding: 10, color: teamColor(d.team) }}>
                            {d.team}
                          </td>
                          <td style={{ padding: 10, fontWeight: 800 }}>
                            {fmt(d.average)} / 10
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <p style={{ ...styles.muted, fontSize: 12, textAlign: 'center' }}>
                Atualização automática a cada 5 segundos · Resultados sujeitos às
                avaliações registradas pela Mesa Diretora.
              </p>
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
      <main style={{ ...styles.app, display: 'grid', placeItems: 'center', padding: 20 }}>
        <form onSubmit={updatePassword} style={{ ...styles.card, width: '100%', maxWidth: 400 }}>
          <h1>Nova senha</h1>
          <p style={styles.muted}>Digite sua nova senha para continuar.</p>
          <input
            style={styles.input}
            type="password"
            minLength={8}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha (mínimo 8 caracteres)"
          />
          <button style={{ ...styles.button, width: '100%', marginTop: 12 }} type="submit">
            Atualizar senha
          </button>
          {message && <p>{message}</p>}
          {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        </form>
      </main>
    );
  }

  if (!user) {
    return (
      <main style={{ ...styles.app, display: 'grid', placeItems: 'center', padding: 20 }}>
        <div style={{ ...styles.card, width: '100%', maxWidth: 430 }}>
          <div style={{ color: '#a5b4cc', letterSpacing: 2, fontSize: 12 }}>SIMONU</div>
          <h1>{resetEmail ? 'Recuperar senha' : 'Mesa Diretora'}</h1>

          {resetEmail ? (
            <form onSubmit={requestPasswordReset}>
              <p style={styles.muted}>Enviaremos um link para o e-mail informado.</p>
              <input
                style={styles.input}
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="Seu e-mail"
              />
              <button style={{ ...styles.button, width: '100%', marginTop: 12 }}>
                Enviar link
              </button>
              <button
                type="button"
                style={{ ...styles.button, width: '100%', marginTop: 8 }}
                onClick={() => setResetEmail('')}
              >
                Voltar ao login
              </button>
            </form>
          ) : (
            <form onSubmit={signIn}>
              <p style={styles.muted}>Entre para avaliar e administrar a simulação.</p>
              <label style={{ display: 'block', marginBottom: 12 }}>
                E-mail
                <input
                  style={{ ...styles.input, marginTop: 6 }}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mesa@exemplo.com"
                />
              </label>
              <label style={{ display: 'block' }}>
                Senha
                <input
                  style={{ ...styles.input, marginTop: 6 }}
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                />
              </label>
              <button style={{ ...styles.button, width: '100%', marginTop: 16 }}>
                Entrar
              </button>
              <button
                type="button"
                style={{ ...styles.button, width: '100%', marginTop: 8 }}
                onClick={() => setResetEmail(email)}
              >
                Esqueci minha senha
              </button>
            </form>
          )}

          {message && <p style={{ color: '#86efac' }}>{message}</p>}
          {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
          <a href="/publico" style={{ color: '#93c5fd', display: 'inline-block', marginTop: 18 }}>
            <Eye size={15} style={{ verticalAlign: 'middle' }} /> Abrir painel público
          </a>
        </div>
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
          <a href="/publico" style={{ ...styles.button, textDecoration: 'none' }}>
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
