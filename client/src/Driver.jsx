import { useEffect, useState } from 'react';

const DRIVER_ID = 1;
const POLL_INTERVAL_MS = 5000;

const callStatusLabels = {
  waiting: '等待接单',
  scheduled: '预约待发',
  accepted: '已接单',
  en_route: '正在路上',
  arrived: '已到达',
};

const callStatusStyles = {
  waiting: 'bg-amber-100 text-amber-700',
  scheduled: 'bg-amber-100 text-amber-700',
  accepted: 'bg-sky-100 text-sky-700',
  en_route: 'bg-cyan-100 text-cyan-700',
  arrived: 'bg-emerald-100 text-emerald-700',
};

function formatCallTime(value) {
  if (!value) {
    return '--';
  }

  const normalizedValue = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatScheduledTime(value) {
  if (!value) {
    return '';
  }

  const normalizedValue = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function formatScheduledDateTime(value) {
  if (!value) {
    return '';
  }

  const normalizedValue = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function BusIcon({ className = 'h-6 w-6' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 16V7.5A3.5 3.5 0 0 1 8.5 4h7A3.5 3.5 0 0 1 19 7.5V16" />
      <path d="M4 12h16M8 4v8m8-8v8M6 16h12a2 2 0 0 1 2 2v1H4v-1a2 2 0 0 1 2-2Z" />
      <circle cx="8" cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PinIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function UsersIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ClockIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function RefreshIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-2.34 5.66M20 4v7h-7" />
    </svg>
  );
}

function Driver() {
  const [calls, setCalls] = useState([]);
  const [scheduledCalls, setScheduledCalls] = useState([]);
  const [activeTab, setActiveTab] = useState('live');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeCallId, setActiveCallId] = useState(null);
  const [driverStatus, setDriverStatus] = useState('idle');

  useEffect(() => {
    const controller = new AbortController();
    let requestInFlight = false;
    const isScheduledView = activeTab === 'scheduled';
    const endpoint = isScheduledView
      ? '/api/calls/scheduled'
      : '/api/calls/pending';

    setIsLoading(true);
    setError('');

    async function loadCalls() {
      if (requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch(endpoint, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Calls request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Pending calls response is not an array');
        }

        if (isScheduledView) {
          setScheduledCalls(data);
        } else {
          setCalls((currentCalls) => {
            const mergedCalls = new Map(
              data.map((call) => [call.id, call]),
            );

            for (const currentCall of currentCalls) {
              if (
                currentCall.status === 'accepted' ||
                currentCall.status === 'en_route'
              ) {
                mergedCalls.set(currentCall.id, currentCall);
              }
            }

            return [...mergedCalls.values()].sort((left, right) =>
              left.created_at.localeCompare(right.created_at),
            );
          });
        }
        setError('');
      } catch (requestError) {
        if (requestError.name === 'AbortError') {
          return;
        }

        console.error(requestError);
        setError(
          isScheduledView
            ? '预约排班加载失败，请稍后重试。'
            : '实时呼叫加载失败，请稍后重试。',
        );
      } finally {
        requestInFlight = false;

        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadCalls();
    const intervalId = setInterval(loadCalls, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      controller.abort();
    };
  }, [activeTab]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCalls((currentCalls) => {
        let changed = false;
        const updatedCalls = currentCalls.map((call) => {
          if (call.status !== 'en_route' || !call.departed_at) {
            return call;
          }

          const normalizedDepartedAt = call.departed_at.includes('T')
            ? call.departed_at
            : `${call.departed_at.replace(' ', 'T')}Z`;
          const departedAt = new Date(normalizedDepartedAt).getTime();

          if (
            !Number.isNaN(departedAt) &&
            departedAt + 3 * 60 * 1000 <= Date.now()
          ) {
            changed = true;
            return { ...call, status: 'arrived' };
          }

          return call;
        });

        return changed ? updatedCalls : currentCalls;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, []);

  async function handleCallAction(call) {
    if (activeCallId !== null) {
      return;
    }

    const action =
      call.status === 'waiting' || call.status === 'scheduled'
        ? 'accept'
        : call.status === 'accepted'
          ? 'depart'
          : null;

    if (!action) {
      return;
    }

    setActiveCallId(call.id);
    setActionError('');

    try {
      const response = await fetch(`/api/calls/${call.id}/${action}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driver_id: DRIVER_ID,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Call action failed with status ${response.status}`);
      }

      setCalls((currentCalls) =>
        currentCalls.map((currentCall) =>
          currentCall.id === call.id
            ? { ...currentCall, ...data.call }
            : currentCall,
        ),
      );
      setDriverStatus(data.driver.status);
    } catch (requestError) {
      console.error(requestError);
      setActionError(
        action === 'accept'
          ? '接单失败，请确认司机处于空闲状态。'
          : '出发状态更新失败，请稍后重试。',
      );
    } finally {
      setActiveCallId(null);
    }
  }

  const isScheduledView = activeTab === 'scheduled';
  const visibleCalls = isScheduledView ? scheduledCalls : calls;

  function handleTabChange(tab) {
    if (tab === activeTab) {
      return;
    }

    setActiveTab(tab);
    setIsLoading(true);
    setError('');
    setActionError('');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-blue-950 to-blue-700 px-5 py-8 text-white sm:px-8 lg:py-12">
      <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-[-10rem] h-[30rem] w-[30rem] rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-52 w-52 rounded-full bg-white/5 blur-3xl" />

      <section className="relative mx-auto w-full max-w-6xl">
        <nav className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-xl shadow-blue-950/30">
              <BusIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-[0.18em] text-cyan-200">
                SHUTTLE CALL
              </p>
              <p className="mt-0.5 text-xs text-blue-100/60">DRIVER OPERATIONS</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-blue-50 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" />
            在线调度中
          </div>
        </nav>

        <header className="mb-8 mt-12 max-w-2xl">
          <p className="mb-3 text-sm font-semibold tracking-[0.18em] text-cyan-200">
            TODAY'S DISPATCH
          </p>
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">司机工作台</h1>
          <p className="mt-4 text-base leading-7 text-blue-100/80">
            快速查看学生需求，确认乘车人数，并完成接单与到达流程。
          </p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-blue-950/25 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-100/70">当前司机</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    driverStatus === 'busy'
                      ? 'bg-amber-300/15 text-amber-200'
                      : 'bg-emerald-300/15 text-emerald-200'
                  }`}
                >
                  {driverStatus === 'busy' ? '忙碌' : '空闲'}
                </span>
              </div>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-cyan-300 to-blue-500 text-xl font-black text-white shadow-lg shadow-cyan-500/20">
                  张
                </div>
                <div>
                  <p className="text-lg font-bold text-white">1 号司机</p>
                  <p className="mt-1 text-sm text-blue-100/60">张师傅 · BUS-01</p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-950/30 px-4 py-3">
                  <p className="text-xs text-blue-200/60">实时任务</p>
                  <p className="mt-1 text-2xl font-bold text-white">{calls.length}</p>
                </div>
                <div className="rounded-2xl bg-blue-950/30 px-4 py-3">
                  <p className="text-xs text-blue-200/60">服务状态</p>
                  <p className="mt-1 text-sm font-bold text-cyan-200">
                    {driverStatus === 'busy' ? '执行任务' : '等待呼叫'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-5 shadow-xl shadow-blue-950/15 backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200">
                  <RefreshIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">自动同步</p>
                  <p className="mt-0.5 text-xs text-cyan-100/60">每 5 秒更新一次</p>
                </div>
              </div>
            </div>
          </aside>

          <section className="rounded-[2rem] border border-white/70 bg-white/95 p-5 text-slate-900 shadow-2xl shadow-blue-950/35 backdrop-blur-xl sm:p-8">
            <div
              className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5"
              role="tablist"
              aria-label="司机呼叫列表"
            >
              <button
                type="button"
                role="tab"
                aria-selected={!isScheduledView}
                onClick={() => handleTabChange('live')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition duration-200 ${
                  !isScheduledView
                    ? 'bg-white text-blue-700 shadow-md shadow-slate-200'
                    : 'text-slate-500 hover:bg-white/60 hover:text-blue-600'
                }`}
              >
                实时呼叫
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    !isScheduledView
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {calls.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isScheduledView}
                onClick={() => handleTabChange('scheduled')}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition duration-200 ${
                  isScheduledView
                    ? 'bg-white text-amber-700 shadow-md shadow-slate-200'
                    : 'text-slate-500 hover:bg-white/60 hover:text-amber-600'
                }`}
              >
                预约排班
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    isScheduledView
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {scheduledCalls.length}
                </span>
              </button>
            </div>

            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-[0.16em] text-blue-600">
                  {isScheduledView ? 'UPCOMING RESERVATIONS' : 'LIVE REQUESTS'}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight">
                  {isScheduledView ? '预约排班' : '实时呼叫'}
                </h2>
              </div>
              {!isLoading && !error && (
                <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
                  {visibleCalls.length} 条
                </span>
              )}
            </div>

            {isLoading && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-10 text-center text-blue-600">
                <RefreshIcon className="mx-auto h-6 w-6 animate-spin" />
                <p className="mt-3 text-sm font-medium">
                  {isScheduledView ? '正在加载预约排班...' : '正在加载实时呼叫...'}
                </p>
              </div>
            )}

            {error && (
              <p
                className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-600"
                role="alert"
              >
                {error}
              </p>
            )}

            {!isLoading && !error && visibleCalls.length === 0 && (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-5 py-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-500 shadow-sm">
                  <BusIcon className="h-7 w-7" />
                </div>
                <p className="mt-4 font-semibold text-slate-700">
                  {isScheduledView ? '暂无未来预约' : '暂无实时呼叫'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {isScheduledView
                    ? '新的预约会自动显示在这里。'
                    : '新呼叫会自动显示在这里。'}
                </p>
              </div>
            )}

            {!isLoading && !error && visibleCalls.length > 0 && (
              <ul className="space-y-4">
                {visibleCalls.map((call) => (
                  <li
                    key={call.id}
                    className="group rounded-3xl border border-slate-200/80 bg-linear-to-br from-white to-blue-50/70 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/70 sm:p-6"
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                            <PinIcon className="h-5 w-5" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-bold text-slate-900">
                                {call.station_name}
                              </p>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-bold ${callStatusStyles[call.status]}`}
                              >
                                {callStatusLabels[call.status]}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              学生：{call.student_name}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                          <span className="text-xs font-bold tracking-wide text-blue-500">
                            目的地
                          </span>
                          <span className="font-bold text-blue-800">
                            {call.destination}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {call.scheduled_time && (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-800">
                              <ClockIcon className="h-4 w-4" />
                              预约：{formatScheduledDateTime(call.scheduled_time)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700">
                            <UsersIcon className="h-4 w-4" />
                            乘车人数：{call.passenger_count} 人
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                            <ClockIcon className="h-4 w-4" />
                            <time dateTime={call.created_at}>
                              {formatCallTime(call.created_at)}
                            </time>
                          </span>
                        </div>
                      </div>
                      {isScheduledView ? (
                        <div className="shrink-0 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-center">
                          <p className="text-xs font-bold tracking-wide text-amber-600">
                            预约发车
                          </p>
                          <p className="mt-1 text-lg font-black text-amber-800">
                            {formatScheduledTime(call.scheduled_time)}
                          </p>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCallAction(call)}
                          disabled={
                            activeCallId !== null ||
                            call.status === 'en_route' ||
                            call.status === 'arrived'
                          }
                          className={`shrink-0 rounded-2xl bg-linear-to-r px-6 py-3 font-bold text-white shadow-lg transition duration-300 hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 active:translate-y-0 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none ${
                            call.status === 'accepted'
                              ? 'from-amber-500 to-orange-500 shadow-amber-200 hover:shadow-amber-300/50 focus:ring-amber-200'
                              : 'from-blue-600 to-cyan-500 shadow-blue-200 hover:shadow-blue-300/50 focus:ring-blue-200'
                          }`}
                        >
                          {activeCallId === call.id
                            ? '处理中...'
                            : call.status === 'accepted'
                              ? '出发前往'
                              : call.status === 'en_route'
                                ? '正在路上'
                              : call.status === 'arrived'
                                ? '已完成'
                                : '立即接单'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {actionError && (
              <p
                className="mt-4 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-600"
                role="alert"
              >
                {actionError}
              </p>
            )}
          </section>
        </div>

        <p className="mt-8 text-center text-xs text-blue-100/50 lg:text-left">
          SHUTTLE CALL DRIVER · 实时连接校园每一站
        </p>
      </section>
    </main>
  );
}

export default Driver;
