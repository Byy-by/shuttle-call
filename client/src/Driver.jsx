import { useEffect, useState } from 'react';

const DRIVER_ID = 1;
const POLL_INTERVAL_MS = 5000;

const callStatusLabels = {
  waiting: '等待接单',
  accepted: '已接单',
  arrived: '已到达',
};

const callStatusStyles = {
  waiting: 'bg-amber-100 text-amber-700',
  accepted: 'bg-sky-100 text-sky-700',
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

function Driver() {
  const [calls, setCalls] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeCallId, setActiveCallId] = useState(null);
  const [driverStatus, setDriverStatus] = useState('idle');

  useEffect(() => {
    const controller = new AbortController();
    let requestInFlight = false;

    async function loadPendingCalls() {
      if (requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch('/api/calls/pending', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Pending calls request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Pending calls response is not an array');
        }

        setCalls((currentCalls) => {
          const mergedCalls = new Map(
            data.map((call) => [call.id, call]),
          );

          for (const currentCall of currentCalls) {
            if (currentCall.status === 'accepted') {
              mergedCalls.set(currentCall.id, currentCall);
            }
          }

          return [...mergedCalls.values()].sort((left, right) =>
            left.created_at.localeCompare(right.created_at),
          );
        });
        setError('');
      } catch (requestError) {
        if (requestError.name === 'AbortError') {
          return;
        }

        console.error(requestError);
        setError('待处理呼叫加载失败，请稍后重试。');
      } finally {
        requestInFlight = false;

        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadPendingCalls();
    const intervalId = setInterval(loadPendingCalls, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      controller.abort();
    };
  }, []);

  async function handleCallAction(call) {
    if (activeCallId !== null) {
      return;
    }

    const action =
      call.status === 'waiting'
        ? 'accept'
        : call.status === 'accepted'
          ? 'arrive'
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
          : '更新到达状态失败，请稍后重试。',
      );
    } finally {
      setActiveCallId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-900">
      <section className="mx-auto w-full max-w-4xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-sky-600">
              DRIVER CONSOLE
            </p>
            <h1 className="text-4xl font-bold tracking-tight">司机端</h1>
            <p className="mt-3 text-slate-600">查看并按时间顺序处理等待中的学生呼叫。</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg shadow-slate-200/60">
            <span className="text-sm font-medium text-slate-500">1 号司机</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                driverStatus === 'busy'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {driverStatus === 'busy' ? '忙碌' : '空闲'}
            </span>
          </div>
        </header>

        <div className="rounded-3xl bg-white p-6 shadow-xl shadow-slate-200/70 sm:p-8">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">呼叫任务</h2>
            {!isLoading && !error && (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
                {calls.length} 条
              </span>
            )}
          </div>

          {isLoading && (
            <p className="rounded-2xl bg-slate-50 px-5 py-8 text-center text-slate-500">
              正在加载待处理呼叫...
            </p>
          )}

          {error && (
            <p
              className="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-600"
              role="alert"
            >
              {error}
            </p>
          )}

          {!isLoading && !error && calls.length === 0 && (
            <p className="rounded-2xl bg-slate-50 px-5 py-8 text-center text-slate-500">
              暂无待处理呼叫
            </p>
          )}

          {!isLoading && !error && calls.length > 0 && (
            <ul className="space-y-4">
              {calls.map((call) => (
                <li
                  key={call.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 transition hover:border-sky-200 hover:bg-white hover:shadow-md hover:shadow-slate-200/60"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-lg font-semibold text-slate-900">
                          {call.station_name}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${callStatusStyles[call.status]}`}
                        >
                          {callStatusLabels[call.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">
                        学生：{call.student_name}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        呼叫时间：
                        <time dateTime={call.created_at}>
                          {formatCallTime(call.created_at)}
                        </time>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCallAction(call)}
                      disabled={activeCallId !== null || call.status === 'arrived'}
                      className={`shrink-0 rounded-xl px-5 py-2.5 font-semibold text-white shadow-lg transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none ${
                        call.status === 'accepted'
                          ? 'bg-emerald-600 shadow-emerald-200 hover:bg-emerald-700 focus:ring-emerald-200'
                          : 'bg-sky-600 shadow-sky-200 hover:bg-sky-700 focus:ring-sky-200'
                      }`}
                    >
                      {activeCallId === call.id
                        ? '处理中...'
                        : call.status === 'accepted'
                          ? '标记到达'
                          : call.status === 'arrived'
                            ? '已完成'
                            : '接单'}
                    </button>
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
        </div>
      </section>
    </main>
  );
}

export default Driver;
