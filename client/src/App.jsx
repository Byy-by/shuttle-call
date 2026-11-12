import { useEffect, useState } from 'react';

function App() {
  const [stations, setStations] = useState([]);
  const [selectedStation, setSelectedStation] = useState('');
  const [studentName, setStudentName] = useState('');
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

  async function handleCall(event) {
    event.preventDefault();

    const normalizedName = studentName.trim();

    if (!selectedStation || !normalizedName) {
      setCallError('请选择站点并填写学生姓名。');
      return;
    }

    setIsSubmitting(true);
    setCallError('');

    try {
      const response = await fetch('/api/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          station_id: Number(selectedStation),
          student_name: normalizedName,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Call request failed with status ${response.status}`);
      }

      window.alert('呼叫已发送，请等待司机接单');
      setStudentName('');
    } catch (requestError) {
      console.error(requestError);
      setCallError('呼叫发送失败，请稍后重试。');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 text-slate-900">
      <section className="w-full max-w-2xl rounded-3xl bg-white p-10 shadow-xl shadow-slate-200/70">
        <p className="mb-3 text-sm font-semibold tracking-[0.2em] text-amber-600">
          SHUTTLE CALL
        </p>
        <h1 className="text-4xl font-bold tracking-tight">请选择校车站点</h1>
        <p className="mt-4 leading-7 text-slate-600">
          项目骨架已就绪，后续可以在这里添加校车呼叫相关功能。
        </p>

        <div className="mt-8">
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
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
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
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <form onSubmit={handleCall} className="mt-5">
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
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
            />
            <button
              type="submit"
              disabled={isSubmitting || isLoading || stations.length === 0}
              className="mt-4 w-full rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600 focus:outline-none focus:ring-4 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isSubmitting ? '正在发送...' : '呼叫校车'}
            </button>
            {callError && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {callError}
              </p>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}

export default App;
