import { useEffect, useState } from 'react';

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

function ArrowIcon({ className = 'h-5 w-5' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

function toDateTimeLocalValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function formatDateTime(value) {
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

function parseDatabaseDate(value) {
  if (!value) {
    return null;
  }

  const normalizedValue = value.includes('T')
    ? value
    : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const studentCallStatusLabels = {
  waiting: '等待司机接单',
  scheduled: '预约等待',
  accepted: '司机已接单',
  en_route: '正在路上',
  arrived: '已到达站点',
};

const studentCallStatusStyles = {
  waiting: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-amber-100 text-amber-700',
  accepted: 'bg-sky-100 text-sky-700',
  en_route: 'bg-cyan-100 text-cyan-700',
  arrived: 'bg-emerald-100 text-emerald-700',
};

const currentCallStatusMeta = {
  waiting: {
    label: '等待接单',
    message: '正在等待司机接单...',
    progress: 28,
    card: 'border-amber-200 bg-linear-to-br from-amber-50 via-white to-orange-50',
    accent: 'text-amber-700',
    icon: 'bg-amber-100 text-amber-700',
    bar: 'from-amber-400 to-orange-500',
  },
  accepted: {
    label: '司机赶来中',
    message: '司机已接单，正在赶来！',
    progress: 64,
    card: 'border-sky-200 bg-linear-to-br from-sky-50 via-white to-blue-50',
    accent: 'text-sky-700',
    icon: 'bg-sky-100 text-sky-700',
    bar: 'from-sky-400 to-blue-600',
  },
  en_route: {
    label: '车辆前往站点',
    message: '司机正在路上，请前往候车点。',
    progress: 82,
    card: 'border-cyan-200 bg-linear-to-br from-cyan-50 via-white to-blue-50',
    accent: 'text-cyan-700',
    icon: 'bg-cyan-100 text-cyan-700',
    bar: 'from-cyan-400 to-blue-600',
  },
  arrived: {
    label: '已到站',
    message: '校车已到达，请上车！',
    progress: 100,
    card: 'border-emerald-300 bg-linear-to-br from-emerald-50 via-white to-green-100',
    accent: 'text-emerald-700',
    icon: 'bg-emerald-100 text-emerald-700',
    bar: 'from-emerald-400 to-green-600',
  },
};

function App() {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [studentName, setStudentName] = useState('');
  const [destination, setDestination] = useState('');
  const [passengerCount, setPassengerCount] = useState('1');
  const [callType, setCallType] = useState('immediate');
  const [scheduledTime, setScheduledTime] = useState('');
  const [myCalls, setMyCalls] = useState([]);
  const [myCallsVersion, setMyCallsVersion] = useState(0);
  const [isLoadingMyCalls, setIsLoadingMyCalls] = useState(false);
  const [myCallsError, setMyCallsError] = useState('');
  const [cancellingCallId, setCancellingCallId] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [callError, setCallError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadStations() {
      try {
        const response = await fetch('/api/stations', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Station request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error('Station response is not an array');
        }

        setStations(data);
        setError('');
      } catch (requestError) {
        if (requestError.name === 'AbortError') {
          return;
        }

        console.error(requestError);
        setError('站点加载失败，请稍后重试。');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadStations();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const normalizedName = studentName.trim();

    if (!normalizedName) {
      setMyCalls([]);
      setIsLoadingMyCalls(false);
      setMyCallsError('');
      return undefined;
    }

    const controller = new AbortController();
    let intervalId = null;
    let requestInFlight = false;

    setIsLoadingMyCalls(true);
    setMyCallsError('');

    async function loadMyCalls() {
      if (requestInFlight) {
        return;
      }

      requestInFlight = true;

      try {
        const response = await fetch(
          `/api/calls/mine?student_name=${encodeURIComponent(normalizedName)}`,
          { signal: controller.signal },
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load calls');
        }

        if (!Array.isArray(data)) {
          throw new Error('Calls response is not an array');
        }

        setMyCalls(data);
        setMyCallsError('');
      } catch (requestError) {
        if (requestError.name === 'AbortError') {
          return;
        }

        console.error(requestError);
        setMyCallsError('我的呼叫加载失败，请稍后重试。');
      } finally {
        requestInFlight = false;

        if (!controller.signal.aborted) {
          setIsLoadingMyCalls(false);
        }
      }
    }

    const timeoutId = setTimeout(() => {
      loadMyCalls();
      intervalId = setInterval(loadMyCalls, 5000);
    }, 350);

    return () => {
      clearTimeout(timeoutId);

      if (intervalId !== null) {
        clearInterval(intervalId);
      }

      controller.abort();
    };
  }, [studentName, myCallsVersion]);

  const hasEnRouteCall = myCalls.some((call) => call.status === 'en_route');

  useEffect(() => {
    if (!hasEnRouteCall) {
      return undefined;
    }

    setClockNow(Date.now());
    const intervalId = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [hasEnRouteCall]);

  async function handleCall(event) {
    event.preventDefault();

    const normalizedName = studentName.trim();
    const normalizedDestination = destination.trim();
    const normalizedPassengerCount = Number(passengerCount);
    let normalizedScheduledTime = null;

    if (callType === 'scheduled') {
      const scheduledDate = new Date(scheduledTime);

      if (
        !scheduledTime ||
        Number.isNaN(scheduledDate.getTime()) ||
        scheduledDate.getTime() <= Date.now()
      ) {
        setCallError('请选择未来的预约时间。');
        return;
      }

      normalizedScheduledTime = scheduledDate.toISOString();
    }

    if (
      !selectedStation ||
      !normalizedName ||
      !normalizedDestination ||
      !Number.isInteger(normalizedPassengerCount) ||
      normalizedPassengerCount < 1 ||
      normalizedPassengerCount > 5
    ) {
      setCallError('请选择站点，填写学生姓名、目的地和 1-5 人的乘车人数。');
      return;
    }

    setIsSubmitting(true);
    setCallError('');

    try {
      const payload = {
        station_id: Number(selectedStation),
        student_name: normalizedName,
        destination: normalizedDestination,
        passenger_count: normalizedPassengerCount,
      };

      if (normalizedScheduledTime) {
        payload.scheduled_time = normalizedScheduledTime;
      }

      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Call request failed with status ${response.status}`);
      }

      window.alert(
        callType === 'scheduled'
          ? '预约呼叫已提交，请等待司机接单'
          : '呼叫已发送，请等待司机接单',
      );
      setPassengerCount('1');
      setDestination('');
      setCallType('immediate');
      setScheduledTime('');
      setMyCallsVersion((version) => version + 1);
    } catch (requestError) {
      console.error(requestError);
      setCallError('呼叫发送失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelCall(call) {
    const ownerName = studentName.trim();

    if (!ownerName || cancellingCallId !== null) {
      return;
    }

    setCancellingCallId(call.id);
    setMyCallsError('');

    try {
      const response = await fetch(`/api/calls/${call.id}/cancel`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_name: ownerName,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Cancel request failed with status ${response.status}`);
      }

      setMyCalls((currentCalls) =>
        currentCalls.filter((currentCall) => currentCall.id !== call.id),
      );
    } catch (requestError) {
      console.error(requestError);
      setMyCallsError(requestError.message || '取消呼叫失败，请稍后重试。');
    } finally {
      setCancellingCallId(null);
    }
  }

  const normalizedStudentName = studentName.trim();
  const matchingCalls = myCalls.filter(
    (call) => call.student_name === normalizedStudentName,
  );
  const currentCall =
    matchingCalls.find((call) => call.status === 'en_route') ||
    matchingCalls.find((call) => call.status === 'accepted') ||
    matchingCalls.find((call) => call.status === 'waiting') ||
    matchingCalls.find((call) => call.status === 'arrived') ||
    null;
  const currentCallMeta = currentCall
    ? currentCallStatusMeta[currentCall.status]
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-linear-to-br from-slate-950 via-blue-900 to-cyan-600 px-5 py-10 text-slate-900 sm:px-8 lg:py-16">
      <div className="pointer-events-none absolute -left-32 -top-28 h-96 w-96 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-blue-400/25 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <section className="text-white">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-cyan-50 backdrop-blur-md">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </span>
            校园班车实时服务
          </div>

          <h1 className="mt-7 max-w-xl text-5xl font-black leading-[1.08] tracking-tight sm:text-6xl">
            校园出行
            <span className="mt-2 block bg-linear-to-r from-cyan-200 to-white bg-clip-text text-transparent">
              随叫随到
            </span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-blue-100/90 sm:text-lg">
            即时出发或提前预约，提交乘车人数后，司机端会实时收到需求。
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
            {[
              ['01', '快速呼叫'],
              ['02', '实时响应'],
              ['03', '人数透明'],
            ].map(([number, label]) => (
              <div
                key={number}
                className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
              >
                <p className="text-xs font-bold tracking-[0.18em] text-cyan-200">
                  {number}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex max-w-xl items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/15 text-cyan-200">
              <BusIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">舒适、便捷、准时</p>
              <p className="mt-1 text-xs text-blue-100/70">
                班车服务全天候连接校园每个角落
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/70 bg-white/95 p-7 shadow-2xl shadow-blue-950/35 backdrop-blur-xl sm:p-9">
          <div className="flex items-start justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/30">
                <BusIcon className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-blue-600">
                  STUDENT PORTAL
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  请选择校车站点
                </h2>
              </div>
            </div>
            {!isLoading && !error && (
              <span className="hidden rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex">
                {stations.length} 个站点可用
              </span>
            )}
          </div>

          <p className="mt-5 text-sm leading-6 text-slate-500">
            填写本次乘车信息，提交后将立即通知附近司机。
          </p>

          <div className="mt-7">
            <label
              htmlFor="station"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              校车站点
            </label>
            <select
              id="station"
              value={selectedStation}
              onChange={(event) => setSelectedStation(event.target.value)}
              disabled={isLoading || Boolean(error) || stations.length === 0}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-slate-900 outline-none transition duration-200 hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              <option value="">
                {isLoading
                  ? '正在加载站点...'
                  : stations.length === 0
                    ? '暂无可用站点'
                    : '请选择站点'}
              </option>
              {stations.map((station) => (
                <option key={station.id} value={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <form onSubmit={handleCall} className="mt-5">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                <div>
                  <label
                    htmlFor="student-name"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    学生姓名
                  </label>
                  <input
                    id="student-name"
                    type="text"
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    placeholder="请输入学生姓名"
                    autoComplete="name"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor="passenger-count"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    乘车人数
                  </label>
                  <input
                    id="passenger-count"
                    type="number"
                    min="1"
                    max="5"
                    step="1"
                    inputMode="numeric"
                    value={passengerCount}
                    onChange={(event) => setPassengerCount(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-slate-900 outline-none transition duration-200 hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label
                  htmlFor="destination"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  目的地
                </label>
                <input
                  id="destination"
                  type="text"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="请输入您的目的地"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3.5 text-slate-900 outline-none transition duration-200 placeholder:text-slate-400 hover:border-blue-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400">可填写 1-5 人。</p>

              <fieldset className="mt-5">
                <legend className="mb-2 block text-sm font-semibold text-slate-700">
                  呼叫方式
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition duration-200 ${
                      callType === 'immediate'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-blue-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="call-type"
                      value="immediate"
                      checked={callType === 'immediate'}
                      onChange={(event) => setCallType(event.target.value)}
                      className="sr-only"
                    />
                    <span
                      className={`h-3 w-3 rounded-full border-2 ${
                        callType === 'immediate'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300'
                      }`}
                    />
                    立即呼叫
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition duration-200 ${
                      callType === 'scheduled'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100'
                        : 'border-slate-200 bg-slate-50/70 text-slate-600 hover:border-blue-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="call-type"
                      value="scheduled"
                      checked={callType === 'scheduled'}
                      onChange={(event) => setCallType(event.target.value)}
                      className="sr-only"
                    />
                    <span
                      className={`h-3 w-3 rounded-full border-2 ${
                        callType === 'scheduled'
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300'
                      }`}
                    />
                    预约呼叫
                  </label>
                </div>
              </fieldset>

              {callType === 'scheduled' && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                  <label
                    htmlFor="scheduled-time"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    预约时间
                  </label>
                  <input
                    id="scheduled-time"
                    type="datetime-local"
                    min={toDateTimeLocalValue(new Date(Date.now() + 60000))}
                    value={scheduledTime}
                    onChange={(event) => setScheduledTime(event.target.value)}
                    required
                    className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-slate-900 outline-none transition duration-200 hover:border-blue-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                  <p className="mt-2 text-xs text-blue-600/70">
                    请选择当前时间之后的乘车时间。
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isLoading || stations.length === 0}
                className="group mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-blue-600 to-cyan-500 px-6 py-4 font-bold text-white shadow-xl shadow-blue-500/25 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-blue-500/35 focus:outline-none focus:ring-4 focus:ring-blue-200 active:translate-y-0 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
              >
                <BusIcon className="h-5 w-5" />
                {isSubmitting ? '正在发送...' : '呼叫校车'}
                {!isSubmitting && (
                  <ArrowIcon className="h-5 w-5 transition duration-300 group-hover:translate-x-1" />
                )}
              </button>

              {callError && (
                <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600" role="alert">
                  {callError}
                </p>
              )}
            </form>
          </div>
        </section>
      </div>

      <section className="relative mx-auto mt-8 w-full max-w-6xl rounded-[2rem] border border-white/70 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-blue-950/30 backdrop-blur-xl sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-blue-600">
              MY REQUESTS
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight">我的呼叫</h2>
          </div>
          {!isLoadingMyCalls && !myCallsError && studentName.trim() && (
            <span className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
              {myCalls.length} 条进行中
            </span>
          )}
        </div>

        {currentCall && currentCallMeta && (
          <div
            className={`mt-5 overflow-hidden rounded-3xl border p-5 shadow-lg shadow-blue-100/50 sm:p-6 ${currentCallMeta.card}`}
            aria-live="polite"
          >
            <div className="flex items-start gap-4">
              <div
                className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${currentCallMeta.icon}`}
              >
                <BusIcon className="h-6 w-6" />
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full border-2 border-white bg-current" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`text-xs font-bold tracking-[0.14em] ${currentCallMeta.accent}`}>
                    当前呼叫 · {currentCallMeta.label}
                  </p>
                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-500">
                    {currentCall.station_name}
                  </span>
                </div>
                <p className={`mt-2 text-xl font-black tracking-tight ${currentCallMeta.accent}`}>
                  {currentCallMeta.message}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  目的地：<span className="font-semibold text-slate-700">{currentCall.destination}</span>
                  <span className="mx-2 text-slate-300">·</span>
                  {currentCall.passenger_count} 人乘车
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/80 shadow-inner">
                <div
                  className={`h-full rounded-full bg-linear-to-r transition-all duration-700 ${currentCallMeta.bar}`}
                  style={{ width: `${currentCallMeta.progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] font-semibold text-slate-400">
                <span className={currentCall.status === 'waiting' ? currentCallMeta.accent : ''}>
                  等待接单
                </span>
                <span
                  className={
                    ['accepted', 'en_route'].includes(currentCall.status)
                      ? currentCallMeta.accent
                      : ''
                  }
                >
                  司机赶来
                </span>
                <span className={currentCall.status === 'arrived' ? currentCallMeta.accent : ''}>
                  车辆到站
                </span>
              </div>
            </div>
          </div>
        )}

        {!studentName.trim() && (
          <div className="mt-5 rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 px-5 py-8 text-center">
            <p className="font-semibold text-slate-700">输入学生姓名查看呼叫</p>
            <p className="mt-1 text-sm text-slate-500">
              上方填写姓名后，会自动展示等待中和已预约的呼叫。
            </p>
          </div>
        )}

        {studentName.trim() && isLoadingMyCalls && (
          <div className="mt-5 flex items-center justify-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 px-5 py-8 text-sm font-medium text-blue-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
            正在查询我的呼叫...
          </div>
        )}

        {studentName.trim() && myCallsError && (
          <p
            className="mt-5 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-600"
            role="alert"
          >
            {myCallsError}
          </p>
        )}

        {studentName.trim() &&
          !isLoadingMyCalls &&
          !myCallsError &&
          myCalls.length === 0 && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
              <p className="font-semibold text-slate-700">暂无进行中的呼叫</p>
              <p className="mt-1 text-sm text-slate-500">
                新提交的呼叫会自动出现在这里。
              </p>
            </div>
          )}

        {studentName.trim() &&
          !isLoadingMyCalls &&
          !myCallsError &&
          myCalls.length > 0 && (
          <ul className="mt-5 grid gap-4 lg:grid-cols-2">
            {myCalls.map((call) => {
              const isScheduledCall = Boolean(call.scheduled_time);
              const canCancel =
                call.status === 'waiting' || call.status === 'scheduled';
              const departedAt = parseDatabaseDate(call.departed_at);
              const remainingSeconds =
                call.status === 'en_route' && departedAt
                  ? Math.max(
                      0,
                      Math.ceil(
                        (departedAt.getTime() + 3 * 60 * 1000 - clockNow) / 1000,
                      ),
                    )
                  : null;

              return (
                <li
                  key={call.id}
                  className="rounded-3xl border border-slate-200 bg-linear-to-br from-white to-blue-50/60 p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-100/70"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-slate-900">
                          {call.station_name}
                        </h3>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            isScheduledCall
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {isScheduledCall ? '预约呼叫' : '立即呼叫'}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            studentCallStatusStyles[call.status] ||
                            'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {studentCallStatusLabels[call.status] || call.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        乘车人数：{call.passenger_count} 人
                      </p>
                      <p className="mt-1 text-sm font-semibold text-blue-700">
                        目的地：{call.destination}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {isScheduledCall
                          ? `预约时间：${formatDateTime(call.scheduled_time)}`
                          : `呼叫时间：${formatDateTime(call.created_at)}`}
                      </p>
                      {call.driver_name && (
                        <p className="mt-1 text-sm text-slate-500">
                          司机：{call.driver_name}
                          {call.bus_number ? ` · ${call.bus_number}` : ''}
                        </p>
                      )}

                      {call.status === 'accepted' && (
                        <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700">
                          司机已接单，车辆正在准备出发。
                        </p>
                      )}

                      {call.status === 'en_route' && (
                        <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3">
                          <p className="font-bold text-cyan-800">正在路上</p>
                          <p className="mt-1 text-sm text-cyan-700">
                            预计到达：
                            <span className="ml-1 font-mono text-base font-black">
                              {formatCountdown(remainingSeconds ?? 0)}
                            </span>
                          </p>
                        </div>
                      )}

                      {call.status === 'arrived' && (
                        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                          已到达站点
                        </p>
                      )}
                    </div>
                  </div>

                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancelCall(call)}
                      disabled={cancellingCallId !== null}
                      className="mt-5 w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition duration-200 hover:-translate-y-0.5 hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-lg hover:shadow-red-200 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {cancellingCallId === call.id ? '正在取消...' : '取消呼叫'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="relative mx-auto mt-10 max-w-6xl text-center text-xs text-blue-100/60 lg:text-left">
        CAMPUS SHUTTLE · 让校园出行更简单
      </p>
    </main>
  );
}

export default App;
